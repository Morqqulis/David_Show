import { describe, expect, test } from 'bun:test'
import { sanitizeEmailHtml, sanitizeUrl } from './email-html-sanitize'
import { composeEmailHtml, DEFAULT_EMAIL_WRAPPER, renderEmail } from './email-render'
import { sampleTokenValues } from './email-tokens'

const TAB = String.fromCharCode(9)
const NUL = String.fromCharCode(0)

describe('sanitizeEmailHtml — attack vectors', () => {
  test('drops a script element together with its code', () => {
    const out = sanitizeEmailHtml('<p>before</p><script>alert(1)</script><p>after</p>')
    expect(out).toBe('<p>before</p><p>after</p>')
    expect(out).not.toContain('alert')
  })

  test('drops a script whose body contains a less-than sign', () => {
    const out = sanitizeEmailHtml('<p>a</p><script>if (1 < 2) alert(1)</script><p>b</p>')
    expect(out).toBe('<p>a</p><p>b</p>')
    expect(out).not.toContain('alert')
  })

  test('drops style and iframe elements with their content', () => {
    expect(sanitizeEmailHtml('<style>p{x:y}</style><p>hi</p>')).toBe('<p>hi</p>')
    expect(sanitizeEmailHtml('<iframe src="https://evil.test">x</iframe><p>hi</p>')).toBe('<p>hi</p>')
  })

  test('strips event-handler attributes', () => {
    const out = sanitizeEmailHtml('<p onclick="alert(1)" onmouseover=alert(2)>text</p>')
    expect(out).toBe('<p>text</p>')
  })

  test('strips a javascript: link but keeps the words', () => {
    const out = sanitizeEmailHtml('<a href="javascript:alert(1)">Open invoice</a>')
    expect(out).toBe('<a>Open invoice</a>')
  })

  test('strips a javascript: link hidden behind an HTML entity', () => {
    expect(sanitizeEmailHtml('<a href="&#106;avascript:alert(1)">x</a>')).toBe('<a>x</a>')
    expect(sanitizeEmailHtml('<a href="&#x6a;avascript:alert(1)">x</a>')).toBe('<a>x</a>')
  })

  test('strips a scheme broken up by control characters', () => {
    expect(sanitizeUrl(`java${TAB}script:alert(1)`)).toBeNull()
    expect(sanitizeUrl(`${NUL}javascript:alert(1)`)).toBeNull()
  })

  test('strips data: and vbscript: URLs', () => {
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(sanitizeUrl('vbscript:msgbox(1)')).toBeNull()
    expect(sanitizeUrl('//evil.test/steal')).toBeNull()
  })

  test('strips the style attribute wherever it appears', () => {
    const out = sanitizeEmailHtml('<p style="background:url(javascript:alert(1))">hi</p>')
    expect(out).toBe('<p>hi</p>')
  })

  test('drops HTML comments, including conditional-comment payloads', () => {
    expect(sanitizeEmailHtml('<p>a</p><!--[if IE]><script>alert(1)</script><![endif]--><p>b</p>')).toBe(
      '<p>a</p><p>b</p>',
    )
  })

  test('an attribute value containing a closing bracket cannot end the tag early', () => {
    const out = sanitizeEmailHtml('<a title="a > b" href="https://x.test">link</a>')
    expect(out).toBe('<a title="a &gt; b" href="https://x.test">link</a>')
  })

  test('unwraps unknown tags but keeps their text', () => {
    expect(sanitizeEmailHtml('<marquee><font size="7">hi</font></marquee>')).toBe('hi')
  })

  test('escapes a bare less-than sign in text', () => {
    expect(sanitizeEmailHtml('5 < 6 & 7 > 6')).toBe('5 &lt; 6 &amp; 7 &gt; 6')
  })
})

describe('sanitizeEmailHtml — legitimate content survives', () => {
  test('keeps the tags a template body actually uses', () => {
    const html =
      '<p>Hi <strong>Jordan</strong>,</p><ul><li>one</li></ul><p><a href="https://a.test/x">Open</a></p>'
    expect(sanitizeEmailHtml(html)).toBe(html)
  })

  test('keeps an unresolved token as a link target', () => {
    expect(sanitizeEmailHtml('<a href="{{InvoiceURL}}">Open invoice</a>')).toBe(
      '<a href="{{InvoiceURL}}">Open invoice</a>',
    )
  })

  // A token was allowed as a link target by prefix, so anything could ride
  // behind one. Only a value that is entirely a token is allowed now.
  test('refuses a scheme smuggled in behind a token', () => {
    expect(sanitizeEmailHtml('<a href="{{X}}javascript:alert(1)">go</a>')).not.toContain('javascript')
  })

  test('refuses a scheme smuggled in behind an anchor', () => {
    expect(sanitizeEmailHtml('<a href="#a javascript:alert(1)">go</a>')).not.toContain('javascript')
  })

  test('normalises legacy bold and italic tags', () => {
    expect(sanitizeEmailHtml('<b>a</b><i>b</i>')).toBe('<strong>a</strong><em>b</em>')
  })

  test('closes tags the author left open', () => {
    expect(sanitizeEmailHtml('<p>one<p>two')).toBe('<p>one</p><p>two</p>')
  })

  test('ignores a stray closing tag instead of corrupting the output', () => {
    expect(sanitizeEmailHtml('</em><p>hi</p>')).toBe('<p>hi</p>')
  })

  test('adds rel to a new-window link', () => {
    expect(sanitizeEmailHtml('<a href="https://a.test" target="_blank">x</a>')).toBe(
      '<a href="https://a.test" target="_blank" rel="noopener noreferrer">x</a>',
    )
  })

  test('an empty string sanitises to an empty string', () => {
    expect(sanitizeEmailHtml('')).toBe('')
  })

  test('mailto and tel links are allowed', () => {
    expect(sanitizeUrl('mailto:ap@aurora.ca')).toBe('mailto:ap@aurora.ca')
    expect(sanitizeUrl('tel:+19055551234')).toBe('tel:+19055551234')
  })
})

describe('composeEmailHtml', () => {
  test('joins header, body and footer in reading order', () => {
    const out = composeEmailHtml({ header: '<p>H</p>', body: '<p>B</p>', footer: '<p>F</p>' })
    expect(out).toBe('<p>H</p><p>B</p><p>F</p>')
  })

  test('sanitises the header and footer, not just the body', () => {
    const out = composeEmailHtml({
      header: '<script>alert(1)</script><p>H</p>',
      body: '<p>B</p>',
      footer: '<p onclick="alert(2)">F</p>',
    })
    expect(out).toBe('<p>H</p><p>B</p><p>F</p>')
  })

  test('missing parts compose to just the body', () => {
    expect(composeEmailHtml({ header: '', body: '<p>B</p>', footer: '' })).toBe('<p>B</p>')
  })
})

describe('renderEmail', () => {
  const wrapper = DEFAULT_EMAIL_WRAPPER

  test('produces a finished email: wrapper included, tokens resolved', () => {
    const out = renderEmail({
      subject: 'Invoice {{InvoiceNumber}} ready for coding',
      bodyHtml: '<p>Hi {{Assignee}},</p><p><a href="{{InvoiceURL}}">Open invoice</a></p>',
      wrapper,
      values: sampleTokenValues(),
    })
    expect(out.subject).toBe('Invoice INV-77100 ready for coding')
    expect(out.fromLine).toBe('City of Aurora — Accounts Payable <ap@aurora.ca>')
    expect(out.html).toContain('City of Aurora')
    expect(out.html).toContain('Hi Jordan Lee,')
    expect(out.html).toContain('href="https://auroraap.example.com/requests/INV-77100"')
    expect(out.html).toContain('please do not reply')
    expect(out.html).not.toContain('{{')
  })

  test('a hostile token value cannot become markup or a live link', () => {
    const out = renderEmail({
      subject: 'x',
      bodyHtml: '<p>{{Vendor}}</p><p><a href="{{InvoiceURL}}">Open</a></p>',
      wrapper,
      values: {
        '{{Vendor}}': '<img src=x onerror=alert(1)>',
        '{{InvoiceURL}}': 'javascript:alert(1)',
        '{{Municipality}}': 'City of Aurora',
        '{{AppName}}': 'AuroraAP',
      },
    })
    // The hostile value survives only as visible text — never as an element.
    expect(out.html).not.toContain('<img')
    expect(out.html).not.toContain('javascript:')
    expect(out.html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(out.html).toContain('<a>Open</a>')
  })
})
