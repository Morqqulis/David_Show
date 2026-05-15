import type { Payload } from 'payload'
import { REQUIRED_STAGE_IDS, STAGE_LABELS, STAGE_ORDER, STAGE_TONE } from '../lib/stage-ids'

export async function seedStages(payload: Payload) {
  const docs = []
  for (let i = 0; i < STAGE_ORDER.length; i++) {
    const systemId = STAGE_ORDER[i]
    const doc = await payload.create({
      collection: 'stages',
      data: {
        systemId,
        label: STAGE_LABELS[systemId],
        order: i + 1,
        tone: STAGE_TONE[systemId] as never,
        active: true,
        required: REQUIRED_STAGE_IDS.includes(systemId),
        bulkAssign: systemId === 'to_be_assigned' || systemId === 'ap_review',
        batchAssign: systemId === 'ready_for_processing',
        verifyFlag: systemId === 'treasurer_review',
        allowReject: systemId !== 'completed',
        allowReassign: systemId !== 'completed',
      },
    })
    docs.push(doc)
  }
  return docs
}
