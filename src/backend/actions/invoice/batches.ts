'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from '../../lib/payload'
import { getStageBySystemId, recordAudit } from '../../lib/stage-engine'
import { defaultActorId } from './_helpers'

export async function applyBatchNumber(invoiceIds: Array<string | number>, batchNumber: string) {
  const payload = await getPayload()
  const actorId = await defaultActorId()

  const existing = await payload.find({
    collection: 'batches',
    where: { number: { equals: batchNumber } } as never,
    limit: 1,
  })
  let batchDoc = existing.docs[0]
  if (!batchDoc) {
    batchDoc = await payload.create({
      collection: 'batches',
      data: { number: batchNumber, createdBy: actorId as never } as never,
    })
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

export async function closeBatch(batchId: string | number) {
  const payload = await getPayload()
  const actorId = await defaultActorId()
  const trv = await getStageBySystemId(payload, 'treasurer_review')
  const cmp = await getStageBySystemId(payload, 'completed')

  const res = await payload.find({
    collection: 'invoices',
    where: {
      and: [{ batch: { equals: batchId } }, { currentStage: { equals: trv!.id } }],
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
  revalidatePath('/requests')
}
