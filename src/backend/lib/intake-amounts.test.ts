import { describe, expect, test } from 'bun:test'
import { DEFAULT_AMOUNT_TOLERANCE, parseAmount, parseIsoDate, reconcileAmounts } from './intake-amounts'

describe('parseAmount', () => {
  test('reads the shapes a scanned invoice actually carries', () => {
    expect(parseAmount('1234.56')).toBe(1234.56)
    expect(parseAmount('$1,234.56')).toBe(1234.56)
    expect(parseAmount('CA$ 1,234.56')).toBe(1234.56)
    expect(parseAmount('1 234.56')).toBe(1234.56)
    expect(parseAmount('USD 99')).toBe(99)
  })

  test('reads a credit written in parentheses as negative', () => {
    expect(parseAmount('(250.00)')).toBe(-250)
    expect(parseAmount('-250.00')).toBe(-250)
  })

  test('passes a number straight through', () => {
    expect(parseAmount(1234.56)).toBe(1234.56)
  })

  test('returns null rather than a guess for anything unreadable', () => {
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('   ')).toBeNull()
    expect(parseAmount(null)).toBeNull()
    expect(parseAmount(undefined)).toBeNull()
    expect(parseAmount('see attached')).toBeNull()
    expect(parseAmount('12.34.56')).toBeNull()
    expect(parseAmount(Number.NaN)).toBeNull()
    expect(parseAmount(Number.POSITIVE_INFINITY)).toBeNull()
  })

  test('rounds to cents so the reconciliation is not defeated by float noise', () => {
    expect(parseAmount('0.1')).toBe(0.1)
    expect(parseAmount('1234.567')).toBe(1234.57)
  })
})

describe('parseIsoDate', () => {
  test('accepts the ISO date the prebuilt model returns', () => {
    expect(parseIsoDate('2026-05-08')).toBe('2026-05-08')
    expect(parseIsoDate('2026-05-08T00:00:00Z')).toBe('2026-05-08')
  })

  test('rejects anything it cannot read with certainty', () => {
    // 08/05/2026 is ambiguous between two continents; a wrong due date is worse
    // than a blank one because it drives payment timing.
    expect(parseIsoDate('08/05/2026')).toBeNull()
    expect(parseIsoDate('')).toBeNull()
    expect(parseIsoDate('not a date')).toBeNull()
    expect(parseIsoDate('2026-13-45')).toBeNull()
  })
})

describe('reconcileAmounts', () => {
  test('amounts that add up reconcile', () => {
    expect(reconcileAmounts(1000, 130, 1130, DEFAULT_AMOUNT_TOLERANCE)).toMatchObject({
      reconciles: true,
      checked: true,
      difference: 0,
    })
  })

  test('a rounding cent is inside tolerance', () => {
    expect(reconcileAmounts(1000, 130.004, 1130.01, DEFAULT_AMOUNT_TOLERANCE).reconciles).toBe(true)
  })

  test('a real mismatch is reported, and reports the gap', () => {
    const result = reconcileAmounts(1000, 130, 1500, DEFAULT_AMOUNT_TOLERANCE)
    expect(result.reconciles).toBe(false)
    expect(result.checked).toBe(true)
    expect(result.difference).toBe(370)
  })

  test('a missing figure means the check could not run, not that it failed', () => {
    // Below-threshold OCR leaves fields blank. That must not be reported to
    // Finance as "these amounts disagree".
    for (const args of [
      [null, 130, 1130],
      [1000, null, 1130],
      [1000, 130, null],
      [null, null, null],
    ] as Array<[number | null, number | null, number | null]>) {
      const result = reconcileAmounts(args[0], args[1], args[2], DEFAULT_AMOUNT_TOLERANCE)
      expect(result.checked).toBe(false)
      expect(result.reconciles).toBe(true)
    }
  })

  test('a zero-tax invoice still reconciles', () => {
    expect(reconcileAmounts(500, 0, 500, DEFAULT_AMOUNT_TOLERANCE).reconciles).toBe(true)
  })

  test('a credit note reconciles', () => {
    expect(reconcileAmounts(-500, -65, -565, DEFAULT_AMOUNT_TOLERANCE).reconciles).toBe(true)
  })
})
