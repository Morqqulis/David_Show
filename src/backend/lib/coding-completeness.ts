import { formatCurrency, round2 } from './tax-math'

/**
 * Sum-match validation ("is this invoice fully coded?").
 *
 * Deliberately dependency-free — no Payload, no `server-only`, no React — so the
 * same verdict can be produced on the server (where it is authoritative and
 * throws) and in the coding screen (where it is advisory and only informs the
 * coder). Anything that needs the database lives in the action layer.
 */

export type CodingMatchTarget = 'subtotal' | 'grandTotal' | 'disabled'
export type CodingMismatchBehaviour = 'block' | 'warn' | 'disabled'

export type CodingRules = {
  matchTarget: CodingMatchTarget
  onMismatch: CodingMismatchBehaviour
  message: string
  tolerance: number
}

export type CodingLineFacts = {
  id: string | number
  amount: number
  /** Tax Code is deliberately absent — see `evaluateCodingCompleteness`. */
  hasGlAccount: boolean
}

export type CodingVerdict = {
  /** True when the transition may proceed with no further interaction. */
  ok: boolean
  behaviour: 'pass' | 'warn' | 'block'
  /** Plain-English list of what is missing, safe to show a finance clerk. */
  reasons: string[]
  /** The admin-configured message, or null when there is nothing to say. */
  message: string | null
  linesSum: number
  target: number
}

/**
 * Applied whenever the settings row is missing or holds an unusable value, so a
 * fresh database behaves like the specification's stated defaults: match against
 * Amount Before Taxes, block on mismatch, one cent of tolerance.
 */
export const DEFAULT_CODING_RULES: CodingRules = {
  matchTarget: 'subtotal',
  onMismatch: 'block',
  message: 'Invoice needs to be fully coded.',
  tolerance: 0.01,
}

const MATCH_TARGETS: readonly CodingMatchTarget[] = ['subtotal', 'grandTotal', 'disabled']
const MISMATCH_BEHAVIOURS: readonly CodingMismatchBehaviour[] = ['block', 'warn', 'disabled']

const TARGET_LABELS: Record<Exclude<CodingMatchTarget, 'disabled'>, string> = {
  subtotal: 'Amount Before Taxes',
  grandTotal: 'Invoice Total',
}

/**
 * Turns a stored settings row (or nothing at all) into usable rules. Each field
 * falls back independently: one bad column must not discard the other three,
 * because a half-configured rule is still better than no gate.
 */
export function normalizeCodingRules(raw: unknown): CodingRules {
  const row = (raw ?? {}) as Partial<Record<keyof CodingRules, unknown>>

  const matchTarget = MATCH_TARGETS.includes(row.matchTarget as CodingMatchTarget)
    ? (row.matchTarget as CodingMatchTarget)
    : DEFAULT_CODING_RULES.matchTarget

  const onMismatch = MISMATCH_BEHAVIOURS.includes(row.onMismatch as CodingMismatchBehaviour)
    ? (row.onMismatch as CodingMismatchBehaviour)
    : DEFAULT_CODING_RULES.onMismatch

  const message =
    typeof row.message === 'string' && row.message.trim().length > 0
      ? row.message.trim()
      : DEFAULT_CODING_RULES.message

  const tolerance =
    typeof row.tolerance === 'number' && Number.isFinite(row.tolerance) && row.tolerance >= 0
      ? row.tolerance
      : DEFAULT_CODING_RULES.tolerance

  return { matchTarget, onMismatch, message, tolerance }
}

/**
 * Multi-department carve-out.
 *
 * When several departments code the same invoice no single coder can make the
 * lines reconcile against the header on their own, so enforcing on each of them
 * would deadlock the invoice. The check is therefore skipped while more than one
 * department still owes a coding submission, and enforced on the final one.
 *
 * The single-department case — the overwhelmingly common one — has exactly one
 * outstanding department and so behaves as the plain rule with no carve-out.
 */
export function isCodingCheckEnforced(outstandingDepartmentCount: number): boolean {
  return outstandingDepartmentCount <= 1
}

export function evaluateCodingCompleteness(input: {
  rules: CodingRules
  lines: CodingLineFacts[]
  subtotal: number
  grandTotal: number
  enforce: boolean
}): CodingVerdict {
  const { rules, lines, subtotal, grandTotal, enforce } = input

  const target = round2(rules.matchTarget === 'grandTotal' ? grandTotal : subtotal)
  const linesSum = round2(
    lines.reduce((acc, l) => acc + (Number.isFinite(l.amount) ? l.amount : 0), 0),
  )
  const pass = (): CodingVerdict => ({
    ok: true,
    behaviour: 'pass',
    reasons: [],
    message: null,
    linesSum,
    target,
  })

  // Admin switched the rule off, either end of it.
  if (rules.matchTarget === 'disabled' || rules.onMismatch === 'disabled') return pass()
  // Earlier coder on a multi-department invoice — the rule does not apply yet.
  if (!enforce) return pass()

  const reasons: string[] = []

  if (lines.length === 0) {
    reasons.push('No coding lines have been entered.')
  }

  const missingGl = lines.filter((l) => !l.hasGlAccount).length
  if (missingGl === 1) {
    reasons.push('One coding line is missing a GL account.')
  } else if (missingGl > 1) {
    reasons.push(`${missingGl} coding lines are missing a GL account.`)
  }

  // Tax Code is intentionally not checked: coders are trained to leave it for
  // Finance to set at AP Review, so a blank Tax Code must never block a coder.

  // A stored tolerance can be null on a partially written row; falling back
  // here rather than trusting the caller keeps `NaN > x` from silently
  // passing every invoice.
  const tolerance =
    Number.isFinite(rules.tolerance) && rules.tolerance >= 0
      ? rules.tolerance
      : DEFAULT_CODING_RULES.tolerance

  if (lines.length > 0 && Math.abs(round2(linesSum - target)) > tolerance) {
    const label = TARGET_LABELS[rules.matchTarget]
    reasons.push(
      `The coding lines add up to ${formatCurrency(linesSum)}, but the invoice ${label} is ${formatCurrency(target)}.`,
    )
  }

  if (reasons.length === 0) return pass()

  return {
    ok: false,
    behaviour: rules.onMismatch === 'warn' ? 'warn' : 'block',
    reasons,
    message: rules.message,
    linesSum,
    target,
  }
}
