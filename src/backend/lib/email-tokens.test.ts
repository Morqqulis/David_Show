import { describe, expect, test } from 'bun:test'
import {
  EMAIL_TOKENS,
  listUnknownTokens,
  resolveTokens,
  resolveTokensPlain,
  sampleTokenValues,
} from './email-tokens'
import { DEFAULT_EMAIL_WRAPPER } from './email-render'
import { EMAIL_TEMPLATE_SEEDS } from '../seed/email-templates'

const values = sampleTokenValues()

describe('EMAIL_TOKENS registry', () => {
  test('every token is unique, brace-wrapped and carries a sample', () => {
    const seen = new Set<string>()
    for (const t of EMAIL_TOKENS) {
      expect(t.token).toMatch(/^\{\{[A-Za-z][A-Za-z0-9_]*\}\}$/)
      expect(t.label.length).toBeGreaterThan(0)
      expect(t.description.length).toBeGreaterThan(0)
      expect(t.sample.length).toBeGreaterThan(0)
      expect(seen.has(t.token)).toBe(false)
      seen.add(t.token)
    }
  })

  test('sampleTokenValues covers the whole registry', () => {
    expect(Object.keys(values).length).toBe(EMAIL_TOKENS.length)
    for (const t of EMAIL_TOKENS) expect(values[t.token]).toBe(t.sample)
  })
})

describe('resolveTokens', () => {
  test('replaces every occurrence when a token appears twice', () => {
    const out = resolveTokens('<p>{{InvoiceNumber}} — see {{InvoiceNumber}}</p>', values)
    expect(out).toBe('<p>INV-77100 — see INV-77100</p>')
  })

  test('leaves an unknown token exactly as written', () => {
    const out = resolveTokens('<p>{{NotARealToken}} and {{Vendor}}</p>', values)
    expect(out).toBe('<p>{{NotARealToken}} and BlueRock Construction Inc.</p>')
  })

  test('resolves a token pressed against punctuation', () => {
    const out = resolveTokens('<p>Hi {{Assignee}}, invoice {{InvoiceNumber}}.</p>', values)
    expect(out).toBe('<p>Hi Jordan Lee, invoice INV-77100.</p>')
  })

  test('tolerates stray spaces inside the braces', () => {
    expect(resolveTokens('{{  Vendor  }}', values)).toBe('BlueRock Construction Inc.')
  })

  test('an empty body stays empty', () => {
    expect(resolveTokens('', values)).toBe('')
  })

  test('escapes a value containing HTML-special characters', () => {
    const out = resolveTokens('<p>{{Vendor}}</p>', {
      '{{Vendor}}': '<script>alert("x")</script> Bell & Co.',
    })
    expect(out).toBe(
      '<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; Bell &amp; Co.</p>',
    )
    expect(out).not.toContain('<script>')
  })

  test('an escaped value cannot close the attribute it sits in', () => {
    const out = resolveTokens('<a href="{{InvoiceURL}}">open</a>', {
      '{{InvoiceURL}}': '" onmouseover="alert(1)',
    })
    expect(out).toBe('<a href="&quot; onmouseover=&quot;alert(1)">open</a>')
  })
})

describe('resolveTokensPlain', () => {
  test('substitutes without escaping, for text destinations like the subject', () => {
    const out = resolveTokensPlain('Invoice {{InvoiceNumber}} for {{Vendor}}', {
      '{{InvoiceNumber}}': 'INV-1',
      '{{Vendor}}': 'Bell & Co.',
    })
    expect(out).toBe('Invoice INV-1 for Bell & Co.')
  })

  test('an empty subject stays empty', () => {
    expect(resolveTokensPlain('', values)).toBe('')
  })
})

describe('listUnknownTokens', () => {
  test('reports only tokens missing from the registry, deduplicated', () => {
    const out = listUnknownTokens('{{Vendor}} {{Typo}} {{Typo}} {{Amount}}')
    expect(out).toEqual(['{{Typo}}'])
  })

  test('a clean template reports nothing', () => {
    expect(listUnknownTokens('{{Vendor}} owes {{Amount}}')).toEqual([])
    expect(listUnknownTokens('')).toEqual([])
  })
})

// The registry is only a single source of truth if everything that ships with
// the product actually draws from it. These two guard the shipped content.
describe('shipped content uses only registered tokens', () => {
  test('every seeded template', () => {
    for (const seed of EMAIL_TEMPLATE_SEEDS) {
      expect(listUnknownTokens(`${seed.subject} ${seed.bodyHtml}`)).toEqual([])
    }
  })

  test('the default header and footer', () => {
    expect(
      listUnknownTokens(`${DEFAULT_EMAIL_WRAPPER.headerHtml} ${DEFAULT_EMAIL_WRAPPER.footerHtml}`),
    ).toEqual([])
  })
})
