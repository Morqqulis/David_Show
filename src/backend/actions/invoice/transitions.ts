'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { getPayload } from '../../lib/payload'
import { getStageBySystemId, nextStageSystemId, recordAudit } from '../../lib/stage-engine'
import { STAGE_ORDER, type StageId } from '../../lib/stage-ids'
import { defaultActorId, evaluateAnyApprovalRule } from './_helpers'

export async function approveInvoice(invoiceId: string | number, comment?: string) {
  const payload = await getPayload()
  const invoice = (await payload.findByID({ collection: 'invoices', id: invoiceId as never, depth: 2 })) as {
    currentStage?: { systemId: StageId }
  }
  const currentSysId = invoice.currentStage?.systemId
  if (!currentSysId) throw new Error('Invoice has no current stage')

  const nextSys = nextStageSystemId(currentSysId)
  if (!nextSys) throw new Error('Already at terminal stage')

  // Conditional approvals auto-skip when no rule matches (Section 6.5).
  let targetSys: StageId = nextSys
  if (nextSys === 'conditional_approvals') {
    const rulesRes = await payload.find({
      collection: 'approval-rules',
      where: { enabled: { equals: true } } as never,
      limit: 100,
    })
    const hasMatching = await evaluateAnyApprovalRule(rulesRes.docs as never, invoiceId)
    if (!hasMatching) targetSys = 'ap_review'
  }

  const targetStage = await getStageBySystemId(payload, targetSys)
  if (!targetStage) throw new Error(`Target stage ${targetSys} not found`)

  await payload.update({
    collection: 'invoices',
    id: invoiceId as never,
    data: { currentStage: targetStage.id as never, approvals: [] as never } as never,
  })
  const actorId = await defaultActorId()
  await recordAudit({
    payload,
    invoiceId,
    actorId,
    action: 'approved',
    context: { fromStage: currentSysId, toStage: targetSys, comment },
  })
  revalidatePath(`/requests/${invoiceId}`)
  revalidatePath('/requests')
  revalidatePath('/dashboard')
}

export async function rejectInvoice(invoiceId: string | number, toSystemId: StageId, reason: string) {
  const payload = await getPayload()
  const invoice = (await payload.findByID({ collection: 'invoices', id: invoiceId as never, depth: 2 })) as {
    currentStage?: { systemId: StageId }
  }
  const currentSysId = invoice.currentStage?.systemId
  const idx = STAGE_ORDER.indexOf(toSystemId)
  if (idx < 0) throw new Error('Invalid target stage')
  if (currentSysId && STAGE_ORDER.indexOf(currentSysId) <= idx) throw new Error('Reject target must be earlier')

  const targetStage = await getStageBySystemId(payload, toSystemId)
  if (!targetStage) throw new Error('Target stage not found')

  await payload.update({
    collection: 'invoices',
    id: invoiceId as never,
    data: { currentStage: targetStage.id as never, approvals: [] as never, batch: null as never } as never,
  })
  const actorId = await defaultActorId()
  await recordAudit({
    payload,
    invoiceId,
    actorId,
    action: 'rejected',
    context: { fromStage: currentSysId, toStage: toSystemId, reason },
  })
  revalidatePath(`/requests/${invoiceId}`)
  revalidatePath('/requests')
}

export async function reassignInvoice(
  invoiceId: string | number,
  userIds: Array<string | number>,
  departmentIds: Array<string | number>,
) {
  const payload = await getPayload()
  await payload.update({
    collection: 'invoices',
    id: invoiceId as never,
    data: { assignees: userIds as never, departments: departmentIds as never } as never,
  })
  const actorId = await defaultActorId()
  await recordAudit({
    payload,
    invoiceId,
    actorId,
    action: 'reassigned',
    context: { users: userIds, departments: departmentIds },
  })
  revalidatePath(`/requests/${invoiceId}`)
}

export async function verifyInvoice(invoiceId: string | number, verified: boolean) {
  const payload = await getPayload()
  const actorId = await defaultActorId()
  await payload.update({
    collection: 'invoices',
    id: invoiceId as never,
    data: {
      verified,
      verifiedAt: verified ? new Date().toISOString() : null,
      verifiedBy: verified ? (actorId as never) : null,
    } as never,
  })
  await recordAudit({ payload, invoiceId, actorId, action: verified ? 'verified' : 'unverified' })
  revalidatePath(`/requests/${invoiceId}`)
  revalidatePath('/queues/treasurer_review')
}
