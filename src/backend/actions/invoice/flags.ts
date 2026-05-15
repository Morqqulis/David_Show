'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from '../../lib/payload'
import { recordAudit } from '../../lib/stage-engine'
import { defaultActorId } from './_helpers'

export type InvoiceFlag =
  | 'noAttachment'
  | 'ocrFailed'
  | 'possibleDuplicate'
  | 'vendorSetupRequired'
  | 'archiveFailed'

export async function setConfidential(invoiceId: string | number, value: boolean) {
  const payload = await getPayload()
  const actorId = await defaultActorId()
  await payload.update({
    collection: 'invoices',
    id: invoiceId as never,
    data: { confidential: value } as never,
  })
  await recordAudit({
    payload,
    invoiceId,
    actorId,
    action: 'flag_set',
    context: { confidential: value },
  })
  revalidatePath(`/requests/${invoiceId}`)
}

export async function setFlag(invoiceId: string | number, flag: InvoiceFlag, value: boolean) {
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
