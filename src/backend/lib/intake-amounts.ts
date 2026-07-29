/**
 * Reading the money and dates off an extraction, and checking that the three
 * amounts on the invoice agree with each other.
 *
 * A mismatch never blocks creation. Vendors do send invoices whose figures do
 * not add up, and refusing those would leave the municipality with a bill it
 * cannot see. The record is created and flagged so Finance looks at it.
 */

/** Two cents. Enough for rounding on a per-line tax calculation, no more. */
export const DEFAULT_AMOUNT_TOLERANCE = 0.02

export type Reconciliation = {
  /** False only when all three figures were present and disagreed. */
  reconciles: boolean
  /** False when a figure was missing, so nothing could be compared. */
  checked: boolean
  /** How far apart the figures were, in dollars. Zero when unchecked. */
  difference: number
}

/**
 * Turns the many ways a scan renders money into a number, or null.
 *
 * Null rather than zero for anything unreadable: zero is a real amount, and an
 * invoice silently worth nothing is worse than an invoice with a blank field a
 * clerk can see and fill in.
 */
export function parseAmount(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? round2(raw) : null

  const trimmed = raw.trim()
  if (trimmed === '') return null

  // Accountants write credits in parentheses.
  const negative = /^\(.*\)$/.test(trimmed) || trimmed.startsWith('-')
  const digitsOnly = trimmed.replace(/[^0-9.]/g, '')
  if (digitsOnly === '' || !/^\d*\.?\d*$/.test(digitsOnly)) return null

  const value = Number(digitsOnly)
  if (!Number.isFinite(value)) return null
  return round2(negative ? -value : value)
}

/**
 * The prebuilt model returns dates already normalised to `YYYY-MM-DD`. Anything
 * else is refused rather than interpreted: `08/05/2026` means two different days
 * on two different continents, and a wrong due date drives a wrong payment date.
 */
export function parseIsoDate(raw: string | null | undefined): string | null {
  if (!raw) return null
  const match = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/)
  if (!match) return null

  const [, year, month, day] = match
  const parsed = new Date(`${year}-${month}-${day}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return null
  // Rejects 2026-13-45, which Date would happily roll over into next year.
  if (parsed.getUTCFullYear() !== Number(year)) return null
  if (parsed.getUTCMonth() + 1 !== Number(month)) return null
  if (parsed.getUTCDate() !== Number(day)) return null
  return `${year}-${month}-${day}`
}

export function reconcileAmounts(
  subtotal: number | null,
  tax: number | null,
  total: number | null,
  tolerance: number,
): Reconciliation {
  if (subtotal === null || tax === null || total === null) {
    return { reconciles: true, checked: false, difference: 0 }
  }
  const difference = round2(Math.abs(subtotal + tax - total))
  return { reconciles: difference <= tolerance, checked: true, difference }
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
