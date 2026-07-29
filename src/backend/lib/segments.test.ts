import { describe, expect, test } from 'bun:test'
import {
  compareSegmentValues,
  departmentSegmentOf,
  parseMask,
  resolveDepartmentForGl,
  rowCovers,
  splitGlCode,
  unmappedSegmentValues,
  validateGlCode,
  type SegmentMapRow,
} from './segments'

// The reference client's format: four parts of four different widths, with the
// third part (Sub-department) carrying the department. A real code is
// `10-000-0000-10116` — any model that assumes uniform part width is wrong.
const LABELS = ['Fund', 'Function', 'Sub-department', 'Object']
const MASK = parseMask('XX-XXX-XXXX-XXXXX', LABELS, 2)

const FACILITIES = 'dept-facilities'
const FINANCIAL = 'dept-financial-services'
const FIRE = 'dept-fire'
const CLERKING = 'dept-clerking'

// Fire is deliberately discontiguous (two ranges plus one loose value), and
// 1645 (the Swim Program) is an override sitting inside a Facilities range.
const ROWS: SegmentMapRow[] = [
  { departmentId: FACILITIES, from: '0001', to: '0099' },
  { departmentId: FACILITIES, from: '1600', to: '1649' },
  { departmentId: FINANCIAL, from: '0100', to: null },
  { departmentId: FIRE, from: '0400', to: '0414' },
  { departmentId: FIRE, from: '0450', to: null },
  { departmentId: FIRE, from: '4001', to: '4099' },
  { departmentId: CLERKING, from: '1645', to: null },
]

function code(subDept: string): string {
  return `10-000-${subDept}-10116`
}

describe('parseMask', () => {
  test('reads four parts of different lengths and keeps their labels', () => {
    expect(MASK.separator).toBe('-')
    expect(MASK.departmentSegmentIndex).toBe(2)
    expect(MASK.segments).toEqual([
      { label: 'Fund', length: 2 },
      { label: 'Function', length: 3 },
      { label: 'Sub-department', length: 4 },
      { label: 'Object', length: 5 },
    ])
  })

  test('falls back to a generic label when the admin left one blank', () => {
    expect(parseMask('XX-XXX', ['Fund'], 0).segments[1].label).toBe('Part 2')
  })

  test('rejects an empty format, mixed separators, stray characters and a bad department part', () => {
    expect(() => parseMask('', LABELS, 0)).toThrow()
    expect(() => parseMask('XX-XXX_XXXX', [], 0)).toThrow()
    expect(() => parseMask('XX-1234', [], 0)).toThrow()
    expect(() => parseMask('XX-XXX', [], 5)).toThrow()
  })
})

describe('splitGlCode / validateGlCode', () => {
  test('splits a well-formed code into its four unequal parts', () => {
    expect(splitGlCode('10-000-0000-10116', MASK)).toEqual(['10', '000', '0000', '10116'])
  })

  test('returns null when the code does not fit the mask', () => {
    expect(splitGlCode('10-000-000-10116', MASK)).toBeNull() // sub-department too short
    expect(splitGlCode('10-000-0000', MASK)).toBeNull() // missing a part
    expect(splitGlCode('10-000-0000-10116-7', MASK)).toBeNull() // one part too many
    expect(splitGlCode('   ', MASK)).toBeNull()
  })

  test('explains, in plain language, why a code was rejected', () => {
    expect(validateGlCode('10-000-0000-10116', MASK)).toEqual({ ok: true, reason: null })

    const missingPart = validateGlCode('10-000-0000', MASK)
    expect(missingPart.ok).toBe(false)
    expect(missingPart.reason).toContain('expects 4')

    const shortPart = validateGlCode('10-000-000-10116', MASK)
    expect(shortPart.ok).toBe(false)
    expect(shortPart.reason).toContain('Sub-department')

    expect(validateGlCode('', MASK).ok).toBe(false)
  })
})

describe('departmentSegmentOf', () => {
  test('picks the nominated part, not the first one', () => {
    expect(departmentSegmentOf('10-000-1645-10116', MASK)).toBe('1645')
  })

  test('is null for a code that does not fit the mask', () => {
    expect(departmentSegmentOf('10-000-164-10116', MASK)).toBeNull()
  })
})

describe('compareSegmentValues', () => {
  // A plain string compare says "0100" < "99", which would put the whole
  // 0100-and-up chart of accounts inside the wrong range.
  test('compares zero-padded numbers numerically, not as text', () => {
    expect(compareSegmentValues('0099', '0100')).toBe(-1)
    expect(compareSegmentValues('99', '0100')).toBe(-1)
    expect(compareSegmentValues('0100', '100')).toBe(0)
  })

  test('falls back to case-insensitive text order for non-numeric parts', () => {
    expect(compareSegmentValues('fire', 'PW')).toBe(-1)
    expect(compareSegmentValues('PW', 'pw')).toBe(0)
  })
})

describe('rowCovers', () => {
  test('a range written back-to-front still covers its values', () => {
    expect(rowCovers({ departmentId: FIRE, from: '0414', to: '0400' }, '0407')).toBe(true)
  })

  test('a range spanning different digit widths covers correctly', () => {
    expect(rowCovers({ departmentId: FACILITIES, from: '99', to: '101' }, '0100')).toBe(true)
    expect(rowCovers({ departmentId: FACILITIES, from: '99', to: '101' }, '0102')).toBe(false)
  })
})

describe('resolveDepartmentForGl', () => {
  test('a value inside a range routes to that range owner', () => {
    expect(resolveDepartmentForGl(code('0050'), MASK, ROWS, FINANCIAL)).toEqual({
      departmentId: FACILITIES,
      matchedBy: 'range',
    })
  })

  test('a single-value row routes on its own', () => {
    expect(resolveDepartmentForGl(code('0100'), MASK, ROWS, FINANCIAL)).toEqual({
      departmentId: FINANCIAL,
      matchedBy: 'override',
    })
  })

  test('one department holds several discontiguous rows', () => {
    for (const subDept of ['0400', '0407', '0414', '0450', '4001', '4099']) {
      expect(resolveDepartmentForGl(code(subDept), MASK, ROWS, FINANCIAL).departmentId).toBe(FIRE)
    }
    // The gap between Fire's two ranges belongs to nobody.
    expect(resolveDepartmentForGl(code('0420'), MASK, ROWS, FINANCIAL).matchedBy).toBe('catch-all')
  })

  test('a single value beats the range it sits inside', () => {
    expect(resolveDepartmentForGl(code('1645'), MASK, ROWS, FINANCIAL)).toEqual({
      departmentId: CLERKING,
      matchedBy: 'override',
    })
    // Its neighbours in the same range are untouched.
    expect(resolveDepartmentForGl(code('1644'), MASK, ROWS, FINANCIAL).departmentId).toBe(FACILITIES)
    expect(resolveDepartmentForGl(code('1646'), MASK, ROWS, FINANCIAL).departmentId).toBe(FACILITIES)
  })

  test('the narrower of two overlapping ranges wins', () => {
    const overlapping: SegmentMapRow[] = [
      { departmentId: FACILITIES, from: '1000', to: '1999' },
      { departmentId: FIRE, from: '1500', to: '1509' },
    ]
    expect(resolveDepartmentForGl(code('1505'), MASK, overlapping, FINANCIAL).departmentId).toBe(FIRE)
    expect(resolveDepartmentForGl(code('1600'), MASK, overlapping, FINANCIAL).departmentId).toBe(FACILITIES)
  })

  test('values below and above every row fall through to the catch-all', () => {
    expect(resolveDepartmentForGl(code('0000'), MASK, ROWS, FINANCIAL)).toEqual({
      departmentId: FINANCIAL,
      matchedBy: 'catch-all',
    })
    expect(resolveDepartmentForGl(code('9999'), MASK, ROWS, FINANCIAL)).toEqual({
      departmentId: FINANCIAL,
      matchedBy: 'catch-all',
    })
  })

  test('a code that does not fit the mask falls through to the catch-all, never to everyone', () => {
    expect(resolveDepartmentForGl('nonsense', MASK, ROWS, FINANCIAL)).toEqual({
      departmentId: FINANCIAL,
      matchedBy: 'catch-all',
    })
  })

  test('with no rows at all, everything lands on the catch-all', () => {
    expect(resolveDepartmentForGl(code('0050'), MASK, [], FINANCIAL)).toEqual({
      departmentId: FINANCIAL,
      matchedBy: 'catch-all',
    })
  })
})

describe('unmappedSegmentValues', () => {
  test('lists the sub-departments that no row covers, with the codes that use them', () => {
    const codes = [
      code('0050'), // Facilities range
      code('1645'), // Clerking override
      code('7000'), // unmapped
      code('7000'), // same sub-department, second account
      code('0420'), // gap between Fire's two ranges
      '10-000-000-10116', // does not fit the mask — reported separately, not here
    ]
    expect(unmappedSegmentValues(codes, MASK, ROWS)).toEqual([
      { value: '0420', codes: [code('0420')] },
      { value: '7000', codes: [code('7000'), code('7000')] },
    ])
  })

  test('is empty when every sub-department in use is mapped', () => {
    expect(unmappedSegmentValues([code('0050'), code('0450')], MASK, ROWS)).toEqual([])
  })
})
