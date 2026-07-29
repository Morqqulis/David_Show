import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_CODING_RULES,
  evaluateCodingCompleteness,
  isCodingCheckEnforced,
  normalizeCodingRules,
  type CodingLineFacts,
  type CodingRules,
} from './coding-completeness'

const rules = (patch: Partial<CodingRules> = {}): CodingRules => ({ ...DEFAULT_CODING_RULES, ...patch })

const line = (amount: number, hasGlAccount = true, id: string | number = 1): CodingLineFacts => ({
  id,
  amount,
  hasGlAccount,
})

const evaluate = (input: {
  rules?: CodingRules
  lines: CodingLineFacts[]
  subtotal?: number
  grandTotal?: number
  enforce?: boolean
}) =>
  evaluateCodingCompleteness({
    rules: input.rules ?? rules(),
    lines: input.lines,
    subtotal: input.subtotal ?? 0,
    grandTotal: input.grandTotal ?? 0,
    enforce: input.enforce ?? true,
  })

describe('evaluateCodingCompleteness — happy path', () => {
  test('lines that reconcile against Amount Before Taxes pass', () => {
    const verdict = evaluate({ lines: [line(600), line(400, true, 2)], subtotal: 1000 })
    expect(verdict.ok).toBe(true)
    expect(verdict.behaviour).toBe('pass')
    expect(verdict.reasons).toEqual([])
    expect(verdict.message).toBeNull()
    expect(verdict.linesSum).toBe(1000)
    expect(verdict.target).toBe(1000)
  })
})

describe('evaluateCodingCompleteness — the three completeness conditions', () => {
  test('an empty coding table blocks', () => {
    const verdict = evaluate({ lines: [], subtotal: 1000 })
    expect(verdict.behaviour).toBe('block')
    expect(verdict.reasons).toContain('No coding lines have been entered.')
    expect(verdict.message).toBe('Invoice needs to be fully coded.')
  })

  test('a line without a GL account blocks even when the totals reconcile', () => {
    const verdict = evaluate({ lines: [line(1000, false)], subtotal: 1000 })
    expect(verdict.behaviour).toBe('block')
    expect(verdict.reasons).toContain('One coding line is missing a GL account.')
  })

  test('several lines without a GL account are reported as a count', () => {
    const verdict = evaluate({
      lines: [line(500, false, 1), line(500, false, 2)],
      subtotal: 1000,
    })
    expect(verdict.reasons).toContain('2 coding lines are missing a GL account.')
  })

  test('lines that do not reconcile block', () => {
    const verdict = evaluate({ lines: [line(600)], subtotal: 1000 })
    expect(verdict.behaviour).toBe('block')
    expect(verdict.reasons.some((r) => r.includes('Amount Before Taxes'))).toBe(true)
  })

  test('a missing Tax Code never contributes a reason', () => {
    // Coders are trained not to enter tax codes; Finance adds them at AP Review.
    const verdict = evaluate({ lines: [line(1000)], subtotal: 1000 })
    expect(verdict.ok).toBe(true)
  })
})

describe('evaluateCodingCompleteness — tolerance boundaries', () => {
  test('a difference exactly on the tolerance passes', () => {
    const verdict = evaluate({ lines: [line(999.99)], subtotal: 1000 })
    expect(verdict.ok).toBe(true)
  })

  test('a difference one cent beyond the tolerance fails', () => {
    const verdict = evaluate({ lines: [line(999.98)], subtotal: 1000 })
    expect(verdict.behaviour).toBe('block')
  })

  test('a widened tolerance absorbs a larger difference', () => {
    const verdict = evaluate({ rules: rules({ tolerance: 5 }), lines: [line(996)], subtotal: 1000 })
    expect(verdict.ok).toBe(true)
  })

  test('accumulated float error does not trip the check', () => {
    const verdict = evaluate({
      lines: [line(0.1, true, 1), line(0.2, true, 2)],
      subtotal: 0.3,
    })
    expect(verdict.ok).toBe(true)
  })

  test('a non-numeric tolerance falls back to one cent rather than passing everything', () => {
    const verdict = evaluate({
      rules: rules({ tolerance: Number.NaN }),
      lines: [line(900)],
      subtotal: 1000,
    })
    expect(verdict.behaviour).toBe('block')
  })
})

describe('evaluateCodingCompleteness — configured behaviour', () => {
  test('warn reports the problem but is not a block', () => {
    const verdict = evaluate({ rules: rules({ onMismatch: 'warn' }), lines: [], subtotal: 1000 })
    expect(verdict.behaviour).toBe('warn')
    expect(verdict.ok).toBe(false)
    expect(verdict.message).toBe('Invoice needs to be fully coded.')
  })

  test('disabled behaviour skips the check entirely', () => {
    const verdict = evaluate({ rules: rules({ onMismatch: 'disabled' }), lines: [], subtotal: 1000 })
    expect(verdict.ok).toBe(true)
    expect(verdict.reasons).toEqual([])
  })

  test('a disabled match target skips the check entirely', () => {
    const verdict = evaluate({ rules: rules({ matchTarget: 'disabled' }), lines: [], subtotal: 1000 })
    expect(verdict.ok).toBe(true)
  })

  test('the configured message is what surfaces, not a hardcoded string', () => {
    const verdict = evaluate({
      rules: rules({ message: 'Please finish coding this invoice before approving.' }),
      lines: [],
      subtotal: 1000,
    })
    expect(verdict.message).toBe('Please finish coding this invoice before approving.')
  })

  test('the grandTotal target matches against the invoice total', () => {
    const verdict = evaluate({
      rules: rules({ matchTarget: 'grandTotal' }),
      lines: [line(1130)],
      subtotal: 1000,
      grandTotal: 1130,
    })
    expect(verdict.ok).toBe(true)
    expect(verdict.target).toBe(1130)
  })
})

describe('evaluateCodingCompleteness — multi-department carve-out', () => {
  test('an unenforced submission passes even when nothing reconciles', () => {
    const verdict = evaluate({ lines: [line(400)], subtotal: 1000, enforce: false })
    expect(verdict.ok).toBe(true)
    expect(verdict.behaviour).toBe('pass')
    expect(verdict.reasons).toEqual([])
  })

  test('the enforced submission still sees the shortfall', () => {
    const verdict = evaluate({ lines: [line(400)], subtotal: 1000, enforce: true })
    expect(verdict.behaviour).toBe('block')
  })
})

describe('isCodingCheckEnforced', () => {
  test('a single-department invoice is always enforced', () => {
    expect(isCodingCheckEnforced(1)).toBe(true)
  })

  test('an invoice with no departments is enforced', () => {
    expect(isCodingCheckEnforced(0)).toBe(true)
  })

  test('two departments still outstanding skips the check', () => {
    expect(isCodingCheckEnforced(2)).toBe(false)
  })

  test('the last outstanding department is enforced', () => {
    expect(isCodingCheckEnforced(1)).toBe(true)
  })
})

describe('normalizeCodingRules', () => {
  test('an absent settings row yields the documented defaults', () => {
    expect(normalizeCodingRules(null)).toEqual(DEFAULT_CODING_RULES)
  })

  test('unknown stored values fall back per field rather than failing the read', () => {
    const normalized = normalizeCodingRules({
      matchTarget: 'nonsense',
      onMismatch: 'explode',
      message: '   ',
      tolerance: -4,
    })
    expect(normalized).toEqual(DEFAULT_CODING_RULES)
  })

  test('valid stored values survive intact', () => {
    const normalized = normalizeCodingRules({
      matchTarget: 'grandTotal',
      onMismatch: 'warn',
      message: 'Finish coding first.',
      tolerance: 0.5,
    })
    expect(normalized).toEqual({
      matchTarget: 'grandTotal',
      onMismatch: 'warn',
      message: 'Finish coding first.',
      tolerance: 0.5,
    })
  })

  test('a zero tolerance is a legitimate setting and is preserved', () => {
    expect(normalizeCodingRules({ tolerance: 0 }).tolerance).toBe(0)
  })
})
