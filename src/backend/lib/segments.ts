/**
 * GL account format (a mask) and the sub-department range map that decides
 * which department owns any given GL account.
 *
 * Deliberately dependency-free — no Payload, no `server-only`, no React — so
 * the same code runs in server actions, in the Settings screen and under
 * `bun test`.
 *
 * Shape of the problem, taken from the Central Frontenac design:
 *   - A code looks like `10-000-0000-10116`: four parts of FOUR DIFFERENT
 *     widths. Anything that assumes uniform part width is wrong.
 *   - One nominated part (there, the third) carries the sub-department.
 *   - Departments own RANGES of that part, several of them, not necessarily
 *     adjacent — plus single-value exceptions that beat the range they sit in.
 *   - Anything nobody claims goes to a nominated catch-all department, never
 *     to everybody.
 */

export type GlSegmentSpec = {
  label: string
  length: number
}

export type GlMask = {
  segments: GlSegmentSpec[]
  separator: string
  /** 0-based index of the part that carries the sub-department. */
  departmentSegmentIndex: number
}

export type SegmentMapRow = {
  departmentId: string | number
  from: string
  /** `null` marks a single-value row. Single values beat any range around them. */
  to: string | null
}

export type GlDepartmentMatch = {
  departmentId: string | number
  matchedBy: 'override' | 'range' | 'catch-all'
}

const PLACEHOLDER_CHAR = /[Xx]/
const ALL_PLACEHOLDERS = /^[Xx]+$/
const NUMERIC = /^\d+$/

/**
 * Turn an admin-written format such as `XX-XXX-XXXX-XXXXX` into a usable mask.
 * Throws with a message written for the person editing the Settings form —
 * callers surface it verbatim.
 */
export function parseMask(mask: string, labels: string[], departmentSegmentIndex = 0): GlMask {
  const written = (mask ?? '').trim()
  if (!written) {
    throw new Error('Enter a GL account format, for example XX-XXX-XXXX-XXXXX.')
  }

  // Every character that is not an X is treated as the separator, and they all
  // have to be the same one so the format round-trips through a single split.
  const separators = Array.from(
    new Set(written.split('').filter((ch) => !PLACEHOLDER_CHAR.test(ch))),
  )
  if (separators.length > 1) {
    throw new Error(
      `Use the same separator throughout — this format mixes "${separators.join('" and "')}".`,
    )
  }
  const separator = separators[0] ?? '-'
  const parts = separators.length > 0 ? written.split(separator) : [written]

  const segments = parts.map((part, i) => {
    if (!ALL_PLACEHOLDERS.test(part)) {
      throw new Error(
        'Write each part of the format as a run of X characters, for example XX-XXX-XXXX-XXXXX.',
      )
    }
    const label = (labels[i] ?? '').trim()
    return { label: label || `Part ${i + 1}`, length: part.length }
  })

  if (
    !Number.isInteger(departmentSegmentIndex) ||
    departmentSegmentIndex < 0 ||
    departmentSegmentIndex >= segments.length
  ) {
    throw new Error(
      `Choose which part of the code holds the sub-department — this format has ${segments.length} parts.`,
    )
  }

  return { segments, separator, departmentSegmentIndex }
}

/** The parts of `code`, or `null` when it does not fit `mask`. */
export function splitGlCode(code: string, mask: GlMask): string[] | null {
  const value = (code ?? '').trim()
  if (!value) return null
  const parts = mask.segments.length === 1 ? [value] : value.split(mask.separator)
  if (parts.length !== mask.segments.length) return null
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].length !== mask.segments[i].length) return null
  }
  return parts
}

/**
 * Length check with an explanation. This is what makes a malformed GL account
 * rejectable instead of quietly accepted.
 */
export function validateGlCode(code: string, mask: GlMask): { ok: boolean; reason: string | null } {
  const value = (code ?? '').trim()
  if (!value) return { ok: false, reason: 'Enter a GL account code.' }

  const parts = mask.segments.length === 1 ? [value] : value.split(mask.separator)
  if (parts.length !== mask.segments.length) {
    return {
      ok: false,
      reason: `This code has ${parts.length} part${parts.length === 1 ? '' : 's'}, but the format expects ${mask.segments.length} separated by "${mask.separator}".`,
    }
  }
  for (let i = 0; i < parts.length; i++) {
    const spec = mask.segments[i]
    if (parts[i].length !== spec.length) {
      return {
        ok: false,
        reason: `The ${spec.label} part should be ${spec.length} character${spec.length === 1 ? '' : 's'} long, but "${parts[i]}" is ${parts[i].length}.`,
      }
    }
  }
  return { ok: true, reason: null }
}

/** The sub-department part of `code`, or `null` when the code does not fit. */
export function departmentSegmentOf(code: string, mask: GlMask): string | null {
  return splitGlCode(code, mask)?.[mask.departmentSegmentIndex] ?? null
}

/**
 * Order two sub-department values. Chart-of-accounts numbers are zero-padded,
 * so `0099` has to sort below `0100`; a plain text compare gets that backwards
 * as soon as the written widths differ (`0100` reads as less than `99`).
 * Non-numeric parts (legacy codes such as `PW`) fall back to text order.
 */
export function compareSegmentValues(a: string, b: string): number {
  const left = (a ?? '').trim()
  const right = (b ?? '').trim()
  if (NUMERIC.test(left) && NUMERIC.test(right)) {
    const l = Number(left)
    const r = Number(right)
    return l < r ? -1 : l > r ? 1 : 0
  }
  const lu = left.toUpperCase()
  const ru = right.toUpperCase()
  return lu < ru ? -1 : lu > ru ? 1 : 0
}

/** Low/high bounds of a range row, tolerant of one typed back-to-front. */
function orderedBounds(row: SegmentMapRow): [string, string] {
  const to = row.to as string
  return compareSegmentValues(row.from, to) <= 0 ? [row.from, to] : [to, row.from]
}

/** How wide a range row is, used to prefer the more specific of two overlaps. */
function rangeSpan(row: SegmentMapRow): number {
  const [lo, hi] = orderedBounds(row)
  if (!NUMERIC.test(lo) || !NUMERIC.test(hi)) return Number.POSITIVE_INFINITY
  return Number(hi) - Number(lo)
}

/** Does this row claim `segmentValue`? */
export function rowCovers(row: SegmentMapRow, segmentValue: string): boolean {
  if (row.to === null || row.to === '') return compareSegmentValues(row.from, segmentValue) === 0
  const [lo, hi] = orderedBounds(row)
  return compareSegmentValues(lo, segmentValue) <= 0 && compareSegmentValues(hi, segmentValue) >= 0
}

/**
 * Which department owns this GL account.
 *
 * Precedence: single-value exception, then the narrowest range containing the
 * value, then the catch-all. A code that does not fit the mask is treated as
 * unmapped rather than as unrestricted — unknown must never mean open.
 */
export function resolveDepartmentForGl(
  code: string,
  mask: GlMask,
  rows: SegmentMapRow[],
  catchAllDepartmentId: string | number,
): GlDepartmentMatch {
  const segment = departmentSegmentOf(code, mask)
  if (segment === null) return { departmentId: catchAllDepartmentId, matchedBy: 'catch-all' }

  const override = rows.find(
    (row) => (row.to === null || row.to === '') && compareSegmentValues(row.from, segment) === 0,
  )
  if (override) return { departmentId: override.departmentId, matchedBy: 'override' }

  let best: SegmentMapRow | null = null
  let bestSpan = Number.POSITIVE_INFINITY
  for (const row of rows) {
    if (row.to === null || row.to === '') continue
    if (!rowCovers(row, segment)) continue
    const span = rangeSpan(row)
    if (best === null || span < bestSpan) {
      best = row
      bestSpan = span
    }
  }
  if (best) return { departmentId: best.departmentId, matchedBy: 'range' }

  return { departmentId: catchAllDepartmentId, matchedBy: 'catch-all' }
}

/**
 * The sub-department values in use across the GL master that no row covers —
 * i.e. everything currently falling through to the catch-all department. This
 * is how an administrator notices the capital-project codes that appeared in
 * the GL master this year and still need mapping.
 *
 * Codes that do not fit the mask are excluded: they are a formatting problem,
 * reported separately, not an unmapped sub-department.
 */
export function unmappedSegmentValues(
  codes: string[],
  mask: GlMask,
  rows: SegmentMapRow[],
): Array<{ value: string; codes: string[] }> {
  const buckets = new Map<string, string[]>()
  for (const code of codes) {
    const segment = departmentSegmentOf(code, mask)
    if (segment === null) continue
    if (rows.some((row) => rowCovers(row, segment))) continue
    const bucket = buckets.get(segment)
    if (bucket) bucket.push(code)
    else buckets.set(segment, [code])
  }
  return Array.from(buckets.entries())
    .map(([value, list]) => ({ value, codes: list }))
    .sort((a, b) => compareSegmentValues(a.value, b.value))
}
