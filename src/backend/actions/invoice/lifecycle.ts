'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from '../../lib/payload'
import { recordAudit } from '../../lib/stage-engine'
import { guard, type ActionResult } from '../../../lib/action-result'
import { resolveReasonText } from '../reason-actions'
import { defaultActorId } from './_helpers'

/**
 * Cancelling an invoice — moving it to Trash, from where it can be restored.
 *
 * The reason used to come from a raw browser prompt box. It now comes from the
 * admin-managed Cancel list (`reasonId`), with the built-in Other option
 * revealing the free-text line carried in `otherText`. Whether a reason is
 * compulsory is a setting; `resolveReasonText` is what enforces it.
 */
export async function softDeleteInvoice(
  invoiceId: string | number,
  reasonId: string | number | null,
  otherText?: string,
): Promise<ActionResult<void>> {
  return guard(() => runSoftDeleteInvoice(invoiceId, reasonId, otherText))
}

async function runSoftDeleteInvoice(
  invoiceId: string | number,
  reasonId: string | number | null,
  otherText?: string,
): Promise<void> {
  const reason = await resolveReasonText('cancel', reasonId, otherText)
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
