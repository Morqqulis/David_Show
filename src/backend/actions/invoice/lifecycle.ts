'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from '../../lib/payload'
import { recordAudit } from '../../lib/stage-engine'
import { defaultActorId } from './_helpers'

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
