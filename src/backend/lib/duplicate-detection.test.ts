import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_DUPLICATE_RULE,
  DUPLICATE_KEY_FIELDS,
  buildDuplicateSignature,
  findDuplicates,
  resolveDuplicateOutcome,
  type DuplicateRule,
} from './duplicate-detection'

const RULE: DuplicateRule = DEFAULT_DUPLICATE_RULE

describe('buildDuplicateSignature', () => {
  test('the default key is vendor plus invoice number', () => {
    expect(RULE.keyFields.slice().sort()).toEqual(['invoiceNumber', 'vendorName'])
  })

  test('two spellings of the same invoice produce the same signature', () => {
    const a = buildDuplicateSignature({ invoiceNumber: 'INV-77100', vendorName: 'BlueRock Construction' }, RULE)
    const b = buildDuplicateSignature(
      { invoiceNumber: '  inv-77100 ', vendorName: 'BlueRock   Construction  ' },
      RULE,
    )
    expect(a).toBe(b)
  })

  test('the order the admin listed the key fields in does not change the signature', () => {
    const forwards = buildDuplicateSignature(
      { invoiceNumber: 'INV-1', vendorName: 'Acme' },
      { ...RULE, keyFields: ['invoiceNumber', 'vendorName'] },
    )
    const backwards = buildDuplicateSignature(
      { invoiceNumber: 'INV-1', vendorName: 'Acme' },
      { ...RULE, keyFields: ['vendorName', 'invoiceNumber'] },
    )
    expect(forwards).toBe(backwards)
  })

  test('field boundaries cannot be smuggled across', () => {
    // Without a field-name prefix, {invoiceNumber:'A', vendorName:'B'} and
    // {invoiceNumber:'A B', vendorName:''} would collide.
    const split = buildDuplicateSignature({ invoiceNumber: 'A', vendorName: 'B' }, RULE)
    const joined = buildDuplicateSignature({ invoiceNumber: 'A B', vendorName: '' }, RULE)
    expect(split).not.toBe(joined)
  })

  test('a case-sensitive rule keeps the case', () => {
    const sensitive: DuplicateRule = { ...RULE, caseInsensitive: false }
    const a = buildDuplicateSignature({ invoiceNumber: 'INV-1', vendorName: 'Acme' }, sensitive)
    const b = buildDuplicateSignature({ invoiceNumber: 'inv-1', vendorName: 'acme' }, sensitive)
    expect(a).not.toBe(b)
  })

  test('numbers compare by value, not by how they were typed', () => {
    const rule: DuplicateRule = { ...RULE, keyFields: ['grandTotal'] }
    expect(buildDuplicateSignature({ grandTotal: 4861 }, rule)).toBe(
      buildDuplicateSignature({ grandTotal: '4,861.00' }, rule),
    )
  })

  test('a key with no readable values at all produces no signature', () => {
    // Otherwise every blank body-only invoice would be a duplicate of the last.
    expect(buildDuplicateSignature({ invoiceNumber: '', vendorName: null }, RULE)).toBeNull()
    expect(buildDuplicateSignature({}, RULE)).toBeNull()
  })

  test('a partially filled key still produces a signature', () => {
    expect(buildDuplicateSignature({ invoiceNumber: 'INV-1' }, RULE)).not.toBeNull()
  })

  test('a rule with no key fields configured produces no signature', () => {
    expect(buildDuplicateSignature({ invoiceNumber: 'INV-1' }, { ...RULE, keyFields: [] })).toBeNull()
  })

  test('any field the admin adds to the key is honoured', () => {
    const wide: DuplicateRule = { ...RULE, keyFields: ['invoiceNumber', 'vendorName', 'poNumber', 'grandTotal'] }
    const base = { invoiceNumber: 'INV-1', vendorName: 'Acme', poNumber: 'PO-9', grandTotal: 100 }
    expect(buildDuplicateSignature(base, wide)).not.toBe(
      buildDuplicateSignature({ ...base, poNumber: 'PO-10' }, wide),
    )
  })
})

describe('findDuplicates', () => {
  const existing = [
    { id: 1, invoiceNumber: 'INV-77100', fields: { invoiceNumber: 'INV-77100', vendorName: 'BlueRock Construction' } },
    { id: 2, invoiceNumber: 'INV-88200', fields: { invoiceNumber: 'INV-88200', vendorName: 'Northern Paving' } },
  ]

  test('finds the match regardless of case and spacing', () => {
    const result = findDuplicates({ invoiceNumber: 'inv-77100', vendorName: ' bluerock  construction ' }, existing, RULE)
    expect(result.matches.map((m) => m.id)).toEqual([1])
    expect(result.signature).not.toBeNull()
  })

  test('a different vendor with the same number is not a duplicate under the default key', () => {
    const result = findDuplicates({ invoiceNumber: 'INV-77100', vendorName: 'Someone Else' }, existing, RULE)
    expect(result.matches).toHaveLength(0)
  })

  test('an unsignable candidate matches nothing', () => {
    expect(findDuplicates({}, existing, RULE).matches).toHaveLength(0)
  })
})

describe('resolveDuplicateOutcome — the three configured actions behave differently', () => {
  const fields = { invoiceNumber: 'INV-77100', vendorName: 'BlueRock Construction' }
  const existing = [{ id: 1, invoiceNumber: 'INV-77100', fields }]

  test('flag creates the invoice and raises the flag', () => {
    const outcome = resolveDuplicateOutcome(fields, existing, { ...RULE, action: 'flag' })
    expect(outcome).toMatchObject({ blocked: false, flagged: true })
    expect(outcome.matches.map((m) => m.invoiceNumber)).toEqual(['INV-77100'])
  })

  test('block refuses to create the invoice', () => {
    expect(resolveDuplicateOutcome(fields, existing, { ...RULE, action: 'block' })).toMatchObject({
      blocked: true,
      flagged: false,
    })
  })

  test('allow creates the invoice with nothing raised', () => {
    expect(resolveDuplicateOutcome(fields, existing, { ...RULE, action: 'allow' })).toMatchObject({
      blocked: false,
      flagged: false,
    })
  })

  test('with no match, all three actions create a clean invoice', () => {
    for (const action of ['flag', 'block', 'allow'] as const) {
      expect(resolveDuplicateOutcome(fields, [], { ...RULE, action })).toMatchObject({
        blocked: false,
        flagged: false,
      })
    }
  })

  test('flag is the default, because the same invoice arriving twice is normal traffic', () => {
    expect(DEFAULT_DUPLICATE_RULE.action).toBe('flag')
  })

  test('the documented assumptions are stored values, not hidden constants', () => {
    expect(DEFAULT_DUPLICATE_RULE.ignoreCancelled).toBe(true)
    expect(DEFAULT_DUPLICATE_RULE.caseInsensitive).toBe(true)
    expect(DEFAULT_DUPLICATE_RULE.appliesToManualEntry).toBe(true)
    expect(DEFAULT_DUPLICATE_RULE.windowDays).toBeNull()
  })
})

describe('the field picker', () => {
  test('offers more than the four expected fields', () => {
    expect(DUPLICATE_KEY_FIELDS.length).toBeGreaterThan(4)
  })

  test('offers all four expected fields', () => {
    const keys = DUPLICATE_KEY_FIELDS.map((f) => f.key)
    for (const expected of ['invoiceNumber', 'vendorName', 'grandTotal', 'poNumber']) {
      expect(keys).toContain(expected)
    }
  })

  test('every offered field is labelled in plain language', () => {
    for (const field of DUPLICATE_KEY_FIELDS) {
      expect(field.label.length).toBeGreaterThan(2)
      expect(field.label).not.toContain('_')
    }
  })

  test('every default key field is one the picker offers', () => {
    const keys = new Set(DUPLICATE_KEY_FIELDS.map((f) => f.key))
    for (const key of DEFAULT_DUPLICATE_RULE.keyFields) expect(keys.has(key)).toBe(true)
  })
})
