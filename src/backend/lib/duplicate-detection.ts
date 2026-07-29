/**
 * Spotting the same invoice arriving twice.
 *
 * The admin chooses which fields make up the match key and what happens on a
 * match. Flagging is the default rather than blocking, because a vendor
 * emailing AP directly while Finance also forwards the same invoice is normal
 * traffic, not an error.
 *
 * Pure: the caller supplies the candidate invoices it wants compared, so this
 * file has no idea a database exists.
 */

export type DuplicateAction = 'flag' | 'block' | 'allow'

export type DuplicateRule = {
  /** App field keys that together identify an invoice. */
  keyFields: string[]
  action: DuplicateAction
  /** Cancelled invoices are excluded from comparison by the caller's query. */
  ignoreCancelled: boolean
  /** Text in the key is compared ignoring case and surrounding spaces. */
  caseInsensitive: boolean
  /** The rule applies to invoices typed in by hand, not only emailed ones. */
  appliesToManualEntry: boolean
  /** Only compare against invoices this many days old. Null means no limit. */
  windowDays: number | null
}

/**
 * The assumptions carried into the build are stored values rather than hidden
 * constants, so an admin can see them and a client can correct them.
 */
export const DEFAULT_DUPLICATE_RULE: DuplicateRule = {
  keyFields: ['vendorName', 'invoiceNumber'],
  action: 'flag',
  ignoreCancelled: true,
  caseInsensitive: true,
  appliesToManualEntry: true,
  windowDays: null,
}

/**
 * What the admin can put in the match key. Deliberately wider than the four
 * fields the client expected to use, because the picker is not meant to be
 * limited to them.
 */
export const DUPLICATE_KEY_FIELDS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'invoiceNumber', label: 'Invoice #' },
  { key: 'vendorName', label: 'Vendor' },
  { key: 'grandTotal', label: 'Invoice total' },
  { key: 'poNumber', label: 'PO #' },
  { key: 'subtotal', label: 'Amount before taxes' },
  { key: 'totalTax', label: 'Total tax amount' },
  { key: 'invoiceDate', label: 'Invoice date' },
  { key: 'dueDate', label: 'Due date' },
  { key: 'fiscalYear', label: 'Fiscal year' },
]

/**
 * Separator between key fields: ASCII 0x1F, the unit separator. It cannot
 * occur in text read off an invoice, so no field value can impersonate a
 * boundary. Each part is also prefixed with its field name.
 */
const UNIT_SEPARATOR = ''

/**
 * A single comparable string for one invoice, or null when the key holds
 * nothing readable.
 *
 * Null matters: without it every blank body-only invoice would carry the same
 * empty signature and be reported as a duplicate of the last one.
 */
export function buildDuplicateSignature(
  invoice: Record<string, unknown>,
  rule: DuplicateRule,
): string | null {
  // Sorted, so re-ordering the key fields in Settings does not silently change
  // what counts as the same invoice.
  const fields = [...new Set(rule.keyFields)].sort()
  if (fields.length === 0) return null

  const parts: string[] = []
  let anyValue = false
  for (const field of fields) {
    const value = normaliseValue(invoice[field], rule.caseInsensitive)
    if (value !== '') anyValue = true
    // The field name prefix keeps boundaries unambiguous: {a:'A', b:'B'} and
    // {a:'A B', b:''} must not collide.
    parts.push(`${field}=${value}`)
  }
  return anyValue ? parts.join(UNIT_SEPARATOR) : null
}

function normaliseValue(value: unknown, caseInsensitive: boolean): string {
  if (value === null || value === undefined) return ''

  if (typeof value === 'number') {
    return Number.isFinite(value) ? (Math.round(value * 100) / 100).toFixed(2) : ''
  }

  const text = String(value).trim().replace(/\s+/g, ' ')
  if (text === '') return ''

  // A money field typed as "4,861.00" and stored as 4861 are the same invoice.
  const numeric = text.replace(/[$\s,]/g, '')
  if (/^-?\d+(\.\d+)?$/.test(numeric)) {
    return (Math.round(Number(numeric) * 100) / 100).toFixed(2)
  }

  return caseInsensitive ? text.toLowerCase() : text
}

export type DuplicateCandidate = {
  id: string | number
  invoiceNumber: string
  /** The candidate's values for the key fields, as stored. */
  fields: Record<string, unknown>
}

export type DuplicateSearch = {
  signature: string | null
  matches: DuplicateCandidate[]
}

export function findDuplicates(
  invoice: Record<string, unknown>,
  candidates: DuplicateCandidate[],
  rule: DuplicateRule,
): DuplicateSearch {
  const signature = buildDuplicateSignature(invoice, rule)
  if (signature === null) return { signature: null, matches: [] }

  const matches = candidates.filter(
    (candidate) => buildDuplicateSignature(candidate.fields, rule) === signature,
  )
  return { signature, matches }
}

export type DuplicateOutcome = DuplicateSearch & {
  /** The invoice must not be created. */
  blocked: boolean
  /** The invoice is created carrying the possible-duplicate flag. */
  flagged: boolean
}

export function resolveDuplicateOutcome(
  invoice: Record<string, unknown>,
  candidates: DuplicateCandidate[],
  rule: DuplicateRule,
): DuplicateOutcome {
  const search = findDuplicates(invoice, candidates, rule)
  if (search.matches.length === 0) return { ...search, blocked: false, flagged: false }

  return {
    ...search,
    blocked: rule.action === 'block',
    flagged: rule.action === 'flag',
  }
}

/** What the invoice screen tells a clerk when a duplicate was found. */
export function duplicateMessage(matches: DuplicateCandidate[]): string {
  if (matches.length === 0) return ''
  const numbers = matches.map((m) => m.invoiceNumber).filter(Boolean)
  const list = numbers.length > 0 ? ` (${numbers.join(', ')})` : ''
  return matches.length === 1
    ? `This looks like the same invoice as one already in the system${list}.`
    : `This looks like the same invoice as ${matches.length} already in the system${list}.`
}
