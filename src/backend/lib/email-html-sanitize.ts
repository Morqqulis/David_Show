/**
 * Allow-list HTML sanitiser for email templates.
 *
 * Why hand-rolled rather than a library: this exact function has to run in
 * three places — the browser (live preview as an admin types), the Next.js
 * server (hardening on save, so we never persist markup we would refuse to
 * render) and `bun test`. `DOMParser` exists only in the browser, and no
 * sanitiser package is installed. A single dependency-free scanner is the only
 * shape that satisfies all three.
 *
 * Posture: everything is denied unless it appears in ALLOWED_TAGS. Attributes
 * are denied unless listed for that specific tag. `style` and `class` are
 * deliberately absent — CSS can smuggle `url(javascript:…)` and legacy
 * `expression()`, and email clients strip most of it anyway.
 */

/** Every tag an email body, header or footer may contain. */
const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr', 'div', 'span', 'strong', 'em', 'u', 's',
  'h1', 'h2', 'h3', 'h4', 'blockquote', 'ul', 'ol', 'li',
  'a', 'img', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
])

/** Attributes permitted per tag. Any tag absent here carries no attributes at all. */
const ALLOWED_ATTRS: Record<string, readonly string[]> = {
  a: ['href', 'title', 'target', 'rel'],
  img: ['src', 'alt', 'width', 'height'],
  table: ['width', 'align', 'border', 'cellpadding', 'cellspacing'],
  td: ['colspan', 'rowspan', 'align', 'width'],
  th: ['colspan', 'rowspan', 'align', 'width'],
}

const NO_ATTRS: readonly string[] = []

/** Legacy/presentational tags folded onto their modern equivalent. */
const TAG_ALIASES: Record<string, string> = { b: 'strong', i: 'em', strike: 's', del: 's' }

const VOID_TAGS = new Set(['br', 'hr', 'img'])

/**
 * Tags that implicitly close a still-open sibling, mirroring how a browser
 * parses them. Without this, `<p>one<p>two` nests instead of stacking and the
 * email renders as one indented blob.
 */
const IMPLIED_CLOSE: Record<string, readonly string[]> = {
  p: ['p'],
  li: ['p', 'li'],
  tr: ['p', 'td', 'th', 'tr'],
  td: ['p', 'td', 'th'],
  th: ['p', 'td', 'th'],
}

/**
 * Elements dropped *together with their content*. Everything else that is not
 * allow-listed is merely unwrapped (tag discarded, text kept), which is the
 * right call for `<font>`/`<center>` but very much the wrong call for
 * `<script>`, whose "text" is executable.
 */
const DROPPED_SUBTREES = new Set([
  'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet',
  'noscript', 'template', 'svg', 'math', 'head', 'title', 'textarea', 'link',
  'meta', 'base', 'form', 'input', 'button', 'select', 'option', 'audio',
  'video', 'canvas',
])

/** Their content is raw text, so an inner `<` is not a tag and must not nest. */
const RAW_TEXT_TAGS = new Set(['script', 'style', 'textarea', 'title'])

const URL_ATTRS = new Set(['href', 'src'])
const ALLOWED_URL_SCHEMES = new Set(['http', 'https', 'mailto', 'tel'])

const NON_BREAKING_SPACE = String.fromCharCode(160)

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: NON_BREAKING_SPACE,
}

/** Escapes a value for use in HTML text or in a double-quoted attribute. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Decodes entities before any inspection. Without this, `&#106;avascript:`
 * walks straight past a scheme check that only looks at literal characters.
 * The trailing semicolon is optional on purpose — browsers accept it missing.
 */
export function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);?/gi, (whole, body: string) => {
    const key = body.toLowerCase()
    if (key.startsWith('#x')) return fromCodePoint(parseInt(key.slice(2), 16)) ?? whole
    if (key.startsWith('#')) return fromCodePoint(parseInt(key.slice(1), 10)) ?? whole
    return NAMED_ENTITIES[key] ?? whole
  })
}

function fromCodePoint(code: number): string | null {
  if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return null
  return String.fromCodePoint(code)
}

/**
 * Drops every space and control character. Scheme smuggling relies on them:
 * `java\tscript:alert(1)` and a leading NUL both read as schemeless to a test
 * that only looks at the literal string.
 */
function stripSpacingChars(value: string): string {
  let out = ''
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0
    if (code <= 0x20 || code === 0x7f || code === 0xa0) continue
    out += ch
  }
  return out
}

/**
 * Returns a safe URL, or null when the attribute must be dropped.
 * Schemeless values are refused except for `{{Token}}` (resolved later) and
 * in-message anchors — a bare `www.example.com` in an email is a broken link
 * anyway, and refusing it costs nothing but the attribute.
 */
export function sanitizeUrl(value: string): string | null {
  const decoded = decodeHtmlEntities(value).trim()
  const probe = stripSpacingChars(decoded).toLowerCase()
  const scheme = /^([a-z][a-z0-9+.-]*):/.exec(probe)
  if (scheme) return ALLOWED_URL_SCHEMES.has(scheme[1]) ? decoded : null
  // A token stands in for a whole address, so it is allowed without a scheme —
  // but only when the value is a token and nothing else. Letting anything that
  // merely STARTS with `{{` through returned `{{X}}javascript:alert(1)` intact:
  // harmless while the token resolves to a plain path, and a live script the
  // day one resolves to something ending in a colon. Anchors get the same
  // treatment: a fragment is a fragment, not a prefix to hide behind.
  if (/^\{\{[a-z0-9_]+\}\}$/i.test(probe)) return decoded
  if (/^#[a-z0-9_-]*$/i.test(probe)) return decoded
  return null
}

type ScannedTag = { name: string; closing: boolean; selfClosing: boolean; attrs: string; end: number }

const TAG_START = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)/y
const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'`=<>]+))?/g

export function sanitizeEmailHtml(html: string): string {
  if (!html) return ''
  const out: string[] = []
  const open: string[] = []
  let i = 0

  while (i < html.length) {
    const lt = html.indexOf('<', i)
    if (lt === -1) {
      pushText(out, html.slice(i))
      break
    }
    if (lt > i) pushText(out, html.slice(i, lt))

    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4)
      i = end === -1 ? html.length : end + 3
      continue
    }
    if (html.startsWith('<!', lt) || html.startsWith('<?', lt)) {
      const end = html.indexOf('>', lt)
      i = end === -1 ? html.length : end + 1
      continue
    }

    const tag = readTag(html, lt)
    if (!tag) {
      // A stray `<` that starts no tag is content, not markup.
      pushText(out, '<')
      i = lt + 1
      continue
    }
    i = tag.end

    if (DROPPED_SUBTREES.has(tag.name)) {
      if (!tag.closing) i = skipSubtree(html, tag)
      continue
    }

    const name = TAG_ALIASES[tag.name] ?? tag.name
    if (tag.closing) {
      closeTag(out, open, name)
      continue
    }

    if (!ALLOWED_TAGS.has(name)) continue // unwrap: drop the tag, keep its children

    const implied = IMPLIED_CLOSE[name]
    while (implied && open.length && implied.includes(open[open.length - 1])) {
      out.push(`</${open.pop()}>`)
    }

    out.push(`<${name}${renderAttrs(name, tag.attrs, ALLOWED_ATTRS[name] ?? NO_ATTRS)}>`)
    if (VOID_TAGS.has(name)) continue
    if (tag.selfClosing) out.push(`</${name}>`)
    else open.push(name)
  }

  while (open.length) out.push(`</${open.pop()}>`)
  return out.join('')
}

function pushText(out: string[], raw: string): void {
  if (raw) out.push(escapeHtml(decodeHtmlEntities(raw)))
}

function closeTag(out: string[], open: string[], name: string): void {
  const at = open.lastIndexOf(name)
  if (at === -1) return // unbalanced close tag — ignore rather than corrupt the stack
  while (open.length > at) out.push(`</${open.pop()}>`)
}

/** Reads one tag, respecting quoted attribute values so `title=">"` cannot end it early. */
function readTag(html: string, start: number): ScannedTag | null {
  TAG_START.lastIndex = start
  const m = TAG_START.exec(html)
  if (!m) return null
  let i = TAG_START.lastIndex
  let quote: string | null = null
  while (i < html.length) {
    const ch = html[i]
    if (quote) {
      if (ch === quote) quote = null
    } else if (ch === '"' || ch === "'") quote = ch
    else if (ch === '>') break
    i++
  }
  const attrs = html.slice(TAG_START.lastIndex, i)
  return {
    name: m[2].toLowerCase(),
    closing: m[1] === '/',
    selfClosing: attrs.trimEnd().endsWith('/'),
    attrs,
    end: Math.min(i + 1, html.length),
  }
}

/** Skips past a dropped element and everything inside it. */
function skipSubtree(html: string, tag: ScannedTag): number {
  if (tag.selfClosing) return tag.end
  // `tag.name` comes from /[a-zA-Z][a-zA-Z0-9]*/, so it cannot inject pattern syntax.
  const re = new RegExp(`<(/?)${tag.name}\\b`, 'gi')
  re.lastIndex = tag.end
  const nests = !RAW_TEXT_TAGS.has(tag.name)
  let depth = 1
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    if (m[1] === '/') {
      depth -= 1
      if (depth === 0) {
        const gt = html.indexOf('>', m.index)
        return gt === -1 ? html.length : gt + 1
      }
    } else if (nests) depth += 1
  }
  return html.length // unterminated — drop the remainder rather than let it through
}

function renderAttrs(tag: string, raw: string, allowed: readonly string[]): string {
  if (!allowed.length || !raw.trim()) return ''
  const parts: string[] = []
  let targetsBlank = false
  let hasRel = false

  ATTR_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = ATTR_RE.exec(raw)) !== null) {
    const name = m[1].toLowerCase()
    // `on*` handlers can never be allow-listed, but the explicit check keeps
    // the guarantee local to this function rather than to the table above.
    if (name.startsWith('on') || !allowed.includes(name)) continue

    let value = m[2] ?? ''
    if (value.startsWith('"') || value.startsWith("'")) value = value.slice(1, -1)

    if (URL_ATTRS.has(name)) {
      const safe = sanitizeUrl(value)
      if (safe === null) continue
      value = safe
    } else {
      value = decodeHtmlEntities(value)
    }

    if (name === 'target') {
      if (value !== '_blank') continue
      targetsBlank = true
    }
    if (name === 'rel') hasRel = true
    parts.push(`${name}="${escapeHtml(value)}"`)
  }

  if (tag === 'a' && targetsBlank && !hasRel) parts.push('rel="noopener noreferrer"')
  return parts.length ? ` ${parts.join(' ')}` : ''
}
