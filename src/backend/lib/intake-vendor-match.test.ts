import { describe, expect, test } from 'bun:test'
import { matchVendor, normaliseVendorName } from './intake-vendor-match'

const VENDORS = [
  { id: 1, name: 'BlueRock Construction Inc.' },
  { id: 2, name: 'Northern Paving Ltd.' },
  { id: 3, name: 'Aurora Office Supplies' },
  { id: 4, name: 'Municipal Fleet Services Corporation' },
]

describe('normaliseVendorName', () => {
  test('drops case, punctuation and legal suffixes', () => {
    expect(normaliseVendorName('BlueRock Construction Inc.')).toBe('bluerock construction')
    expect(normaliseVendorName('  NORTHERN  PAVING,  LTD  ')).toBe('northern paving')
    expect(normaliseVendorName('Municipal Fleet Services Corporation')).toBe('municipal fleet services')
  })

  test('never strips a suffix that is the whole name', () => {
    // "Limited" on its own is the vendor's actual name, not a suffix.
    expect(normaliseVendorName('Limited')).toBe('limited')
  })
})

describe('matchVendor', () => {
  test('an exact name matches with full confidence', () => {
    const result = matchVendor('BlueRock Construction Inc.', VENDORS)
    expect(result.vendorId).toBe(1)
    expect(result.ambiguous).toBe(false)
    expect(result.score).toBe(1)
  })

  test('a scan that drops the legal suffix still matches', () => {
    expect(matchVendor('BlueRock Construction', VENDORS).vendorId).toBe(1)
  })

  test('a small OCR misread still matches', () => {
    expect(matchVendor('BlueRock Constructon Inc', VENDORS).vendorId).toBe(1)
  })

  test('an unrelated name matches nothing and is not called ambiguous', () => {
    const result = matchVendor('Zephyr Marine Charters', VENDORS)
    expect(result.vendorId).toBeNull()
    expect(result.ambiguous).toBe(false)
  })

  test('two plausible candidates leave the vendor blank', () => {
    // Vendor drives Payment Method, so a wrong guess propagates. Blank is safe.
    const twins = [
      { id: 10, name: 'Aurora Paving North' },
      { id: 11, name: 'Aurora Paving South' },
    ]
    const result = matchVendor('Aurora Paving', twins)
    expect(result.vendorId).toBeNull()
    expect(result.ambiguous).toBe(true)
  })

  test('two vendors that normalise identically leave the vendor blank', () => {
    const collide = [
      { id: 20, name: 'Redline Inc.' },
      { id: 21, name: 'Redline Ltd.' },
    ]
    const result = matchVendor('Redline', collide)
    expect(result.vendorId).toBeNull()
    expect(result.ambiguous).toBe(true)
    expect(result.score).toBe(1)
  })

  test('a clear winner beside a weak also-ran is not ambiguous', () => {
    const result = matchVendor('Aurora Office Supplies', VENDORS)
    expect(result.vendorId).toBe(3)
    expect(result.ambiguous).toBe(false)
  })

  test('an empty or missing extracted name matches nothing', () => {
    expect(matchVendor('', VENDORS)).toEqual({ vendorId: null, ambiguous: false, score: 0 })
    expect(matchVendor('   ', VENDORS)).toEqual({ vendorId: null, ambiguous: false, score: 0 })
  })

  test('an empty vendor master matches nothing', () => {
    expect(matchVendor('BlueRock Construction Inc.', [])).toEqual({
      vendorId: null,
      ambiguous: false,
      score: 0,
    })
  })

  test('a string vendor id is returned unchanged', () => {
    const result = matchVendor('Northern Paving Ltd.', [{ id: 'vendor-northern', name: 'Northern Paving Ltd.' }])
    expect(result.vendorId).toBe('vendor-northern')
  })
})
