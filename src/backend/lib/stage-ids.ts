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

export const STAGE_TONE: Record<StageId, 'slate' | 'blue' | 'violet' | 'amber' | 'green' | 'red'> = {
  to_be_assigned: 'slate',
  to_be_coded: 'blue',
  conditional_approvals: 'violet',
  ap_review: 'blue',
  ready_for_processing: 'amber',
  processed: 'amber',
  treasurer_review: 'violet',
  completed: 'green',
}
