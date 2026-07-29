/**
 * Matching a vendor name read off a scan against the vendor master.
 *
 * The rule that shapes everything here: vendor drives Payment Method, so a
 * wrong match propagates into how the municipality pays money. When two
 * candidates are both plausible the field is left blank for Finance to pick,
 * which costs one dropdown click. Guessing costs a misdirected payment.
 */

export type VendorRecord = { id: string | number; name: string }

export type VendorMatch = {
  vendorId: string | number | null
  /** True when candidates were found but none could be chosen safely. */
  ambiguous: boolean
  /** Similarity of the best candidate, 0 to 1. */
  score: number
}

/** Confident enough to fill the field in without a human looking. */
const AUTO_FILL_THRESHOLD = 0.85

/** Close enough that a person might reasonably have picked it. */
const PLAUSIBLE_THRESHOLD = 0.6

/**
 * Legal suffixes carry no identity — "BlueRock Construction Inc." and
 * "BlueRock Construction" are the same company, and a scan drops the suffix
 * about as often as it keeps it.
 */
const LEGAL_SUFFIXES = [
  'incorporated',
  'corporation',
  'limited',
  'company',
  'holdings',
  'group',
  'inc',
  'llc',
  'llp',
  'ltd',
  'corp',
  'plc',
  'co',
  'gmbh',
  'sa',
  'nv',
  'bv',
]

/**
 * Lower-cases, removes punctuation, collapses spacing and drops trailing legal
 * suffixes. Never strips the whole name — "Limited" on its own is somebody's
 * actual trading name.
 */
export function normaliseVendorName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (base === '') return ''

  const words = base.split(' ')
  while (words.length > 1 && LEGAL_SUFFIXES.includes(words[words.length - 1])) words.pop()
  return words.join(' ')
}

export function matchVendor(extractedName: string, vendors: VendorRecord[]): VendorMatch {
  const none: VendorMatch = { vendorId: null, ambiguous: false, score: 0 }
  if (typeof extractedName !== 'string') return none
  const needle = normaliseVendorName(extractedName)
  if (needle === '' || vendors.length === 0) return none

  const scored = vendors
    .map((vendor) => ({ vendor, score: similarity(needle, normaliseVendorName(vendor.name)) }))
    .sort((a, b) => b.score - a.score)

  const best = scored[0]
  const runnerUp = scored[1]?.score ?? 0

  if (best.score < AUTO_FILL_THRESHOLD) {
    // Nothing is confident enough to fill in. Call it ambiguous only when more
    // than one candidate was plausible, so Finance is told there was a choice
    // to make rather than told nothing was found.
    return {
      vendorId: null,
      ambiguous: best.score >= PLAUSIBLE_THRESHOLD && runnerUp >= PLAUSIBLE_THRESHOLD,
      score: best.score,
    }
  }

  if (runnerUp >= PLAUSIBLE_THRESHOLD) {
    return { vendorId: null, ambiguous: true, score: best.score }
  }

  return { vendorId: best.vendor.id, ambiguous: false, score: best.score }
}

/**
 * Sørensen–Dice coefficient over character bigrams: tolerant of the single
 * transposed or dropped letter a scan produces, intolerant of two different
 * company names that happen to share a word.
 */
function similarity(a: string, b: string): number {
  if (a === '' || b === '') return 0
  if (a === b) return 1

  const left = bigrams(a)
  const right = bigrams(b)
  if (left.size === 0 || right.size === 0) return 0

  let shared = 0
  for (const [gram, count] of left) {
    const other = right.get(gram)
    if (other !== undefined) shared += Math.min(count, other)
  }
  const total = countOf(left) + countOf(right)
  return (2 * shared) / total
}

function bigrams(value: string): Map<string, number> {
  const grams = new Map<string, number>()
  for (let i = 0; i < value.length - 1; i += 1) {
    const gram = value.slice(i, i + 2)
    grams.set(gram, (grams.get(gram) ?? 0) + 1)
  }
  return grams
}

function countOf(grams: Map<string, number>): number {
  let total = 0
  for (const count of grams.values()) total += count
  return total
}
