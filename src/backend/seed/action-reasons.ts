import type { Payload } from 'payload'
import { REASON_SCOPES, type ReasonScope } from '../collections/ActionReasons'

/**
 * Starting reason lists for Reassign, Reject and Cancel.
 *
 * These are the reasons a municipal AP team gives in practice, not placeholders
 * — a client should be able to run a demo without opening Settings first, and
 * then edit the list to their own wording.
 */
const REASON_LABELS: Record<ReasonScope, string[]> = {
  reassign: [
    'Out of office',
    'Wrong person assigned',
    'Workload balancing',
    'Left the organisation',
    'Belongs to another department',
    'Covering during leave',
  ],
  reject: [
    'Missing purchase order number',
    'Incorrect amount',
    'Wrong vendor',
    'Missing or unreadable attachment',
    'Goods or services not received',
    'Coded to the wrong account',
    'Duplicate invoice',
  ],
  cancel: [
    'Duplicate invoice',
    'Not our invoice',
    'Superseded by a credit note',
    'Sent to the wrong municipality',
    'Vendor withdrew the invoice',
    'Entered in error',
  ],
}

/**
 * Whether a reason is compulsory, per action. Reject and Cancel are destructive
 * enough that the person on the receiving end needs to be told why; a reassign
 * is a courtesy note, so it starts optional. All three are admin-editable.
 */
const REASON_REQUIRED: Record<ReasonScope, boolean> = {
  reassign: false,
  reject: true,
  cancel: true,
}

export async function seedActionReasons(payload: Payload) {
  const rows: Array<Record<string, unknown>> = []

  for (const scope of REASON_SCOPES) {
    rows.push({ scope, kind: 'policy', order: 0, active: true, reasonRequired: REASON_REQUIRED[scope] })

    REASON_LABELS[scope].forEach((label, index) => {
      rows.push({ scope, kind: 'reason', label, order: index + 1, active: true, isOther: false })
    })

    // Permanent, admin-undeletable, and always last so it reads as the fallback
    // rather than competing with the real reasons.
    rows.push({
      scope,
      kind: 'reason',
      label: 'Other',
      order: 999,
      active: true,
      isOther: true,
    })
  }

  return Promise.all(
    rows.map((data) => payload.create({ collection: 'action-reasons' as never, data: data as never })),
  )
}
