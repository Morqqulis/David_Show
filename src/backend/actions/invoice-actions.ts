'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from '../lib/payload'
import { recordAudit, getStageBySystemId, nextStageSystemId } from '../lib/stage-engine'
import { STAGE_ORDER, type StageId } from '../lib/stage-ids'
import { computeLine } from '../lib/tax-math'

async function defaultActorId() {
  const payload = await getPayload()
  const admin = await payload.find({
    collection: 'users',
    where: { email: { equals: 'david@aurora.ca' } } as never,
    limit: 1,
  })
  return admin.docs[0]?.id
}

export async function approveInvoice(invoiceId: string | number, comment?: string) {
  const payload = await getPayload()
  const invoice = (await payload.findByID({ collection: 'invoices', id: invoiceId as never, depth: 2 })) as {
    currentStage?: { systemId: StageId }
  }
  const currentSysId = invoice.currentStage?.systemId
  if (!currentSysId) throw new Error('Invoice has no current stage')

  const nextSys = nextStageSystemId(currentSysId)
  if (!nextSys) throw new Error('Already at terminal stage')

  // Conditional approvals: auto-skip if no rules match
  let targetSys: StageId = nextSys
  if (nextSys === 'conditional_approvals') {
    const rulesRes = await payload.find({ collection: 'approval-rules', where: { enabled: { equals: true } } as never, limit: 100 })
    const hasMatching = await evaluateRulesAny(rulesRes.docs as never, invoiceId)
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

export async function reassignInvoice(invoiceId: string | number, userIds: Array<string | number>, departmentIds: Array<string | number>) {
  const payload = await getPayload()
  await payload.update({
    collection: 'invoices',
    id: invoiceId as never,
    data: { assignees: userIds as never, departments: departmentIds as never } as never,
  })
  const actorId = await defaultActorId()
  await recordAudit({ payload, invoiceId, actorId, action: 'reassigned', context: { users: userIds, departments: departmentIds } })
  revalidatePath(`/requests/${invoiceId}`)
}

export async function applyBatchNumber(invoiceIds: Array<string | number>, batchNumber: string) {
  const payload = await getPayload()
  const actorId = await defaultActorId()
  let batch = await payload.find({ collection: 'batches', where: { number: { equals: batchNumber } } as never, limit: 1 })
  let batchDoc = batch.docs[0]
  if (!batchDoc) {
    batchDoc = await payload.create({ collection: 'batches', data: { number: batchNumber, createdBy: actorId as never } as never })
  }
  const processedStage = await getStageBySystemId(payload, 'processed')
  for (const id of invoiceIds) {
    await payload.update({
      collection: 'invoices',
      id: id as never,
      data: { batch: batchDoc.id as never, currentStage: processedStage!.id as never } as never,
    })
    await recordAudit({ payload, invoiceId: id, actorId, action: 'batch_applied', context: { batchNumber } })
  }
  revalidatePath('/requests')
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

export async function closeBatch(batchId: string | number) {
  const payload = await getPayload()
  const actorId = await defaultActorId()
  const trv = await getStageBySystemId(payload, 'treasurer_review')
  const cmp = await getStageBySystemId(payload, 'completed')
  const res = await payload.find({
    collection: 'invoices',
    where: {
      and: [
        { batch: { equals: batchId } },
        { currentStage: { equals: trv!.id } },
      ],
    } as never,
    limit: 500,
  })
  for (const inv of res.docs as Array<{ id: string | number }>) {
    await payload.update({
      collection: 'invoices',
      id: inv.id as never,
      data: { currentStage: cmp!.id as never, archivedAt: new Date().toISOString() } as never,
    })
    await recordAudit({ payload, invoiceId: inv.id, actorId, action: 'batch_closed' })
    await recordAudit({ payload, invoiceId: inv.id, actorId, action: 'archived' })
  }
  await payload.update({
    collection: 'batches',
    id: batchId as never,
    data: { closedAt: new Date().toISOString(), closedBy: actorId as never } as never,
  })
  revalidatePath('/queues/treasurer_review')
  revalidatePath('/queues/completed')
}

export async function postComment(invoiceId: string | number, body: string) {
  const payload = await getPayload()
  const actorId = await defaultActorId()
  if (!actorId) return
  await payload.create({
    collection: 'invoice-comments',
    data: { invoice: invoiceId as never, author: actorId as never, body } as never,
  })
  await recordAudit({ payload, invoiceId, actorId, action: 'comment_added' })
  revalidatePath(`/requests/${invoiceId}`)
}

export async function saveLine(line: {
  id?: string | number
  invoice: string | number
  order: number
  glAccount?: string | number | null
  costCenter?: string | number | null
  project?: string | number | null
  fund?: string | number | null
  amount: number
  taxCode?: string | number | null
  description?: string | null
}) {
  const payload = await getPayload()
  const actorId = await defaultActorId()

  let taxRate = 0
  let recoverablePct = 0
  if (line.taxCode) {
    const taxDoc = (await payload.findByID({ collection: 'tax-codes', id: line.taxCode as never })) as {
      rate: number
      recoverablePct: number
    }
    taxRate = taxDoc.rate
    recoverablePct = taxDoc.recoverablePct
  }
  const computed = computeLine({ amount: line.amount, rate: taxRate, recoverablePct })

  const data = {
    invoice: line.invoice,
    order: line.order,
    glAccount: line.glAccount,
    costCenter: line.costCenter,
    project: line.project,
    fund: line.fund,
    amount: computed.amount,
    taxCode: line.taxCode,
    taxAmount: computed.taxAmount,
    recoverable: computed.recoverable,
    nonRecoverable: computed.nonRecoverable,
    description: line.description,
  } as never

  if (line.id) {
    await payload.update({ collection: 'invoice-lines', id: line.id as never, data })
  } else {
    await payload.create({ collection: 'invoice-lines', data })
  }
  await recordAudit({ payload, invoiceId: line.invoice, actorId, action: 'coded' })
  await recomputeInvoiceTotals(line.invoice)
  revalidatePath(`/requests/${line.invoice}`)
  revalidatePath(`/requests/${line.invoice}/coding`)
}

export async function deleteLine(lineId: string | number) {
  const payload = await getPayload()
  const line = (await payload.findByID({ collection: 'invoice-lines', id: lineId as never })) as {
    invoice: string | number | { id: string | number }
  }
  const invoiceId = typeof line.invoice === 'object' ? (line.invoice as { id: string | number }).id : line.invoice
  await payload.delete({ collection: 'invoice-lines', id: lineId as never })
  await recomputeInvoiceTotals(invoiceId)
  revalidatePath(`/requests/${invoiceId}`)
  revalidatePath(`/requests/${invoiceId}/coding`)
}

async function recomputeInvoiceTotals(invoiceId: string | number) {
  const payload = await getPayload()
  const lines = await payload.find({
    collection: 'invoice-lines',
    where: { invoice: { equals: invoiceId } } as never,
    limit: 200,
    depth: 0,
  })
  let subtotal = 0
  let totalTax = 0
  for (const l of lines.docs as Array<{ amount: number; taxAmount: number }>) {
    subtotal += l.amount ?? 0
    totalTax += l.taxAmount ?? 0
  }
  subtotal = Math.round(subtotal * 100) / 100
  totalTax = Math.round(totalTax * 100) / 100
  await payload.update({
    collection: 'invoices',
    id: invoiceId as never,
    data: { subtotal, totalTax, grandTotal: Math.round((subtotal + totalTax) * 100) / 100 } as never,
  })
}

async function evaluateRulesAny(
  rules: Array<{
    conditions?: { operator: 'and' | 'or'; conditions: Array<{ fieldKey: string; operator: string; value: unknown }> }
  }>,
  invoiceId: string | number,
): Promise<boolean> {
  const payload = await getPayload()
  const invoice = (await payload.findByID({ collection: 'invoices', id: invoiceId as never, depth: 2 })) as {
    grandTotal: number
    departments?: Array<{ id: string | number }>
    customFields?: Record<string, unknown>
  }
  const get = (key: string) => {
    if (key === 'grandTotal') return invoice.grandTotal
    if (key === 'subtotal') return (invoice as Record<string, unknown>).subtotal
    if (key === 'department')
      return Array.isArray(invoice.departments) ? invoice.departments.map((d) => d.id) : []
    return invoice.customFields?.[key]
  }
  const { evaluateGroup } = await import('../lib/conditions')
  return rules.some((r) => r.conditions && evaluateGroup(r.conditions as never, get))
}

export async function setConfidential(invoiceId: string | number, value: boolean) {
  const payload = await getPayload()
  const actorId = await defaultActorId()
  await payload.update({
    collection: 'invoices',
    id: invoiceId as never,
    data: { confidential: value } as never,
  })
  await recordAudit({ payload, invoiceId, actorId, action: 'flag_set', context: { confidential: value } })
  revalidatePath(`/requests/${invoiceId}`)
}

export async function setFlag(
  invoiceId: string | number,
  flag: 'noAttachment' | 'ocrFailed' | 'possibleDuplicate' | 'vendorSetupRequired' | 'archiveFailed',
  value: boolean,
) {
  const payload = await getPayload()
  const inv = (await payload.findByID({ collection: 'invoices', id: invoiceId as never })) as {
    flags?: Record<string, unknown>
  }
  const flags = { ...(inv.flags ?? {}), [flag]: value }
  await payload.update({ collection: 'invoices', id: invoiceId as never, data: { flags } as never })
  const actorId = await defaultActorId()
  await recordAudit({
    payload,
    invoiceId,
    actorId,
    action: value ? 'flag_set' : 'flag_cleared',
    context: { flag },
  })
  revalidatePath(`/requests/${invoiceId}`)
}

export async function softDeleteInvoice(invoiceId: string | number, reason: string) {
  const payload = await getPayload()
  const actorId = await defaultActorId()
  await payload.update({
    collection: 'invoices',
    id: invoiceId as never,
    data: { softDeleted: true, deletedReason: reason } as never,
  })
  await recordAudit({ payload, invoiceId, actorId, action: 'soft_deleted', context: { reason } })
  revalidatePath('/trash')
  revalidatePath('/requests')
}

export async function restoreInvoice(invoiceId: string | number) {
  const payload = await getPayload()
  const actorId = await defaultActorId()
  await payload.update({
    collection: 'invoices',
    id: invoiceId as never,
    data: { softDeleted: false, deletedReason: null } as never,
  })
  await recordAudit({ payload, invoiceId, actorId, action: 'restored' })
  revalidatePath('/trash')
  revalidatePath('/requests')
}

export async function retryArchive(invoiceId: string | number) {
  const payload = await getPayload()
  const actorId = await defaultActorId()
  await payload.update({
    collection: 'invoices',
    id: invoiceId as never,
    data: {
      flags: { archiveFailed: false, archiveAttempts: 0 },
      archivedAt: new Date().toISOString(),
    } as never,
  })
  await recordAudit({ payload, invoiceId, actorId, action: 'archive_retry' })
  await recordAudit({ payload, invoiceId, actorId, action: 'archived' })
  revalidatePath('/alerts')
}
