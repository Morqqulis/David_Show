import { describe, expect, test } from 'bun:test'
import { STAGE_ORDER, isAtOrPastCoding } from './stage-ids'

describe('isAtOrPastCoding', () => {
  test('false before an invoice has been coded', () => {
    expect(isAtOrPastCoding('to_be_assigned')).toBe(false)
  })

  test('true at the coding stage itself', () => {
    expect(isAtOrPastCoding('to_be_coded')).toBe(true)
  })

  // The hole this closes: keying the coding gate on "does the invoice have
  // lines" meant deleting every line at a later stage disabled the check, and a
  // wholly uncoded invoice could be approved onwards.
  test('true at every stage after coding, so a later approval is still checked', () => {
    const after = STAGE_ORDER.slice(STAGE_ORDER.indexOf('to_be_coded'))
    for (const stage of after) {
      expect(isAtOrPastCoding(stage)).toBe(true)
    }
  })

  test('false for a missing stage rather than throwing', () => {
    expect(isAtOrPastCoding(undefined)).toBe(false)
    expect(isAtOrPastCoding(null)).toBe(false)
  })
})
