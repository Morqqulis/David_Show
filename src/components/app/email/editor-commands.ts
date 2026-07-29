import { escapeHtml, sanitizeEmailHtml } from '@/backend/lib/email-html-sanitize'

/**
 * Selection and range operations behind the template body editor.
 *
 * Everything here is explicit Range work — `document.execCommand` is
 * deprecated, produces different markup in every browser, and emits inline
 * `style` attributes that our sanitiser would strip anyway. Doing the DOM
 * surgery ourselves means the markup we save is the markup we chose.
 *
 * Documented behaviour worth knowing before changing it: turning a mark OFF
 * clears it from the whole styled run, not just the selected characters.
 * Splitting a run mid-way is a large amount of code for a case that does not
 * come up when writing three-sentence notification emails.
 */

/** The character-level styles the toolbar can apply. */
export type InlineMark = 'strong' | 'em' | 'u'

type TextSlice = { node: Text; start: number; end: number }

/** The live selection, but only when it actually sits inside this editor. */
export function currentRange(root: HTMLElement): Range | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (!root.contains(range.commonAncestorContainer)) return null
  return range
}

function applySelection(range: Range): void {
  const selection = window.getSelection()
  if (!selection) return
  selection.removeAllRanges()
  selection.addRange(range)
}

/** Caret at the very end of the editor — the fallback when nothing is selected. */
export function rangeAtEnd(root: HTMLElement): Range {
  const range = document.createRange()
  range.selectNodeContents(root)
  range.collapse(false)
  return range
}

export function insertTextAtRange(range: Range, text: string): void {
  range.deleteContents()
  const node = document.createTextNode(text)
  range.insertNode(node)
  const after = document.createRange()
  after.setStartAfter(node)
  after.collapse(true)
  applySelection(after)
}

/** Inserts already-sanitised HTML. Callers must pass output of `sanitizeEmailHtml`. */
export function insertSanitizedHtml(range: Range, safeHtml: string): void {
  const holder = document.createElement('div')
  holder.innerHTML = safeHtml
  const fragment = document.createDocumentFragment()
  let last: Node | null = null
  while (holder.firstChild) {
    last = holder.firstChild
    fragment.appendChild(holder.firstChild)
  }
  range.deleteContents()
  range.insertNode(fragment)
  if (last) {
    const after = document.createRange()
    after.setStartAfter(last)
    after.collapse(true)
    applySelection(after)
  }
}

/** Turns pasted content into markup we are willing to store. */
export function pastedHtml(data: DataTransfer): string {
  const html = data.getData('text/html')
  if (html) return sanitizeEmailHtml(html)
  const text = data.getData('text/plain')
  if (!text) return ''
  return text
    .split(/\r?\n/)
    .map((line) => `<p>${escapeHtml(line) || '<br>'}</p>`)
    .join('')
}

function closestTag(root: HTMLElement, node: Node | null, tag: string): HTMLElement | null {
  let el: HTMLElement | null = node?.nodeType === Node.ELEMENT_NODE
    ? (node as HTMLElement)
    : (node?.parentElement ?? null)
  const wanted = tag.toUpperCase()
  while (el && el !== root) {
    if (el.tagName === wanted) return el
    el = el.parentElement
  }
  return null
}

/** The block-level child of the editor that contains `node`. */
function topLevelBlock(root: HTMLElement, node: Node | null): HTMLElement | null {
  let el: HTMLElement | null = node?.nodeType === Node.ELEMENT_NODE
    ? (node as HTMLElement)
    : (node?.parentElement ?? null)
  while (el && el.parentElement && el.parentElement !== root) el = el.parentElement
  return el && el.parentElement === root ? el : null
}

function textSlices(root: HTMLElement, range: Range): TextSlice[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const slices: TextSlice[] = []
  let node = walker.nextNode()
  while (node) {
    const text = node as Text
    if (range.intersectsNode(text)) {
      const start = text === range.startContainer ? range.startOffset : 0
      const end = text === range.endContainer ? range.endOffset : text.data.length
      if (end > start) slices.push({ node: text, start, end })
    }
    node = walker.nextNode()
  }
  return slices
}

/** Splits a text node so the returned node covers exactly the selected characters. */
function isolate(slice: TextSlice): Text {
  let target = slice.node
  if (slice.end < target.data.length) target.splitText(slice.end)
  if (slice.start > 0) target = target.splitText(slice.start)
  return target
}

function unwrap(element: HTMLElement): void {
  const parent = element.parentNode
  if (!parent) return
  while (element.firstChild) parent.insertBefore(element.firstChild, element)
  parent.removeChild(element)
}

/**
 * Wraps each selected run of text in `tag`, or clears `tag` when the whole
 * selection already carries it. Wrapping per text node (rather than wrapping
 * the extracted range) is what stops a selection spanning two paragraphs from
 * producing a block element nested inside an inline one.
 */
export function toggleInlineMark(root: HTMLElement, tag: InlineMark): boolean {
  const range = currentRange(root)
  if (!range || range.collapsed) return false
  const slices = textSlices(root, range)
  if (!slices.length) return false

  if (slices.every((s) => closestTag(root, s.node, tag))) {
    const marks = new Set<HTMLElement>()
    for (const s of slices) {
      const mark = closestTag(root, s.node, tag)
      if (mark) marks.add(mark)
    }
    marks.forEach(unwrap)
    return true
  }

  const created: HTMLElement[] = []
  for (const slice of slices) {
    const target = isolate(slice)
    const parent = target.parentNode
    if (!parent) continue
    const mark = document.createElement(tag)
    parent.insertBefore(mark, target)
    mark.appendChild(target)
    created.push(mark)
  }
  if (!created.length) return false

  const restored = document.createRange()
  restored.setStartBefore(created[0])
  restored.setEndAfter(created[created.length - 1])
  applySelection(restored)
  return true
}

/**
 * Bullet list toggle. Turning it off converts the entire list back to
 * paragraphs, which keeps the text in the order the author wrote it — pulling
 * a single item out would silently move it past its neighbours.
 */
export function toggleBulletList(root: HTMLElement): boolean {
  const range = currentRange(root)
  if (!range) return false

  const item = closestTag(root, range.startContainer, 'li')
  if (item) {
    const list = item.parentElement
    if (!list || !list.parentNode) return false
    const paragraphs = document.createDocumentFragment()
    for (const child of Array.from(list.children)) {
      const p = document.createElement('p')
      while (child.firstChild) p.appendChild(child.firstChild)
      if (!p.firstChild) p.appendChild(document.createElement('br'))
      paragraphs.appendChild(p)
    }
    list.parentNode.replaceChild(paragraphs, list)
    return true
  }

  const block = topLevelBlock(root, range.startContainer)
  if (!block || !block.parentNode) return false
  const list = document.createElement('ul')
  const li = document.createElement('li')
  while (block.firstChild) li.appendChild(block.firstChild)
  list.appendChild(li)
  block.parentNode.replaceChild(list, block)
  const restored = document.createRange()
  restored.selectNodeContents(li)
  applySelection(restored)
  return true
}

/**
 * Links the selection. With nothing selected the address itself becomes the
 * link text, so the click is never silently lost.
 */
export function applyLink(root: HTMLElement, href: string, range: Range | null): boolean {
  // The caller passes the range explicitly: opening the link dialog moves
  // focus out of the editor, so the live selection is gone by the time we get
  // an address to apply.
  if (!range) return false

  if (range.collapsed) {
    const anchor = document.createElement('a')
    anchor.setAttribute('href', href)
    anchor.textContent = href
    range.insertNode(anchor)
    const after = document.createRange()
    after.setStartAfter(anchor)
    after.collapse(true)
    applySelection(after)
    return true
  }

  const slices = textSlices(root, range)
  if (!slices.length) return false
  for (const slice of slices) {
    const target = isolate(slice)
    const parent = target.parentNode
    if (!parent) continue
    const existing = closestTag(root, target, 'a')
    if (existing) {
      existing.setAttribute('href', href)
      continue
    }
    const anchor = document.createElement('a')
    anchor.setAttribute('href', href)
    parent.insertBefore(anchor, target)
    anchor.appendChild(target)
  }
  return true
}

/** Removes the link from the run the caret sits in, keeping its text. */
export function removeLink(root: HTMLElement): boolean {
  const range = currentRange(root)
  if (!range) return false
  const anchor = closestTag(root, range.startContainer, 'a')
  if (!anchor) return false
  unwrap(anchor)
  return true
}
