export const STAGE_IDS = {
  to_be_assigned: 'to_be_assigned',
  to_be_coded: 'to_be_coded',
  conditional_approvals: 'conditional_approvals',
  ap_review: 'ap_review',
  ready_for_processing: 'ready_for_processing',
  processed: 'processed',
  treasurer_review: 'treasurer_review',
  completed: 'completed',
} as const

export type StageId = (typeof STAGE_IDS)[keyof typeof STAGE_IDS]

export const STAGE_ORDER: StageId[] = [
  'to_be_assigned',
  'to_be_coded',
  'conditional_approvals',
  'ap_review',
  'ready_for_processing',
  'processed',
  'treasurer_review',
  'completed',
]

export const STAGE_LABELS: Record<StageId, string> = {
  to_be_assigned: 'To Be Assigned',
  to_be_coded: 'To Be Coded',
  conditional_approvals: 'Conditional Approvals',
  ap_review: 'AP Review',
  ready_for_processing: 'Ready for Processing',
  processed: 'Processed',
  treasurer_review: 'Treasurer Review',
  completed: 'Completed',
}

export const REQUIRED_STAGE_IDS: StageId[] = [
  'to_be_assigned',
  'ready_for_processing',
  'completed',
]

// A per-stage colour name used to live here. Status pills are now a single-hue
// ramp derived from the brand colour by stage position, so nothing chooses a
// hue per stage any more — see components/app/stage-badge.tsx.

/**
 * True once an invoice has reached the coding stage, and at every stage after.
 *
 * This is what the coding-completeness gate keys on. It deliberately asks about
 * the STAGE and not about whether the invoice currently has coding lines:
 * testing the line count left a hole where deleting every line at a later stage
 * read as "nothing to check", and a wholly uncoded invoice sailed through.
 */
export function isAtOrPastCoding(systemId: StageId | undefined | null): boolean {
  if (!systemId) return false
  const at = STAGE_ORDER.indexOf(systemId)
  return at >= STAGE_ORDER.indexOf('to_be_coded')
}
