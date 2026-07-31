'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from '../lib/payload'
import { recordAudit } from '../lib/stage-engine'
import { guard, UserFacingError, type ActionResult } from '../../lib/action-result'

async function defaultActorId() {
  const payload = await getPayload()
  const admin = await payload.find({
    collection: 'users',
    where: { email: { equals: 'david@aurora.ca' } } as never,
    limit: 1,
  })
  return admin.docs[0]?.id
}

export async function uploadDocument(
  formData: FormData,
): Promise<ActionResult<{ id: string | number }>> {
  return guard(() => runUploadDocument(formData))
}

async function runUploadDocument(formData: FormData): Promise<{ id: string | number }> {
  const file = formData.get('file') as File | null
  const invoiceIdRaw = formData.get('invoiceId')
  if (!file || !invoiceIdRaw) throw new UserFacingError('Choose a file to attach first.')
  if (file.size === 0) throw new UserFacingError('That file is empty, so there is nothing to attach.')
  if (file.size > 50 * 1024 * 1024) {
    throw new UserFacingError('That file is larger than 50 MB, which is more than can be attached.')
  }

  const payload = await getPayload()
  const actorId = await defaultActorId()
  const invoiceId =
    typeof invoiceIdRaw === 'string' && /^\d+$/.test(invoiceIdRaw)
      ? parseInt(invoiceIdRaw, 10)
      : (invoiceIdRaw as string)

  const buffer = Buffer.from(await file.arrayBuffer())
  const created = await payload.create({
    collection: 'documents',
    data: {
      invoice: invoiceId as never,
      uploadedBy: actorId as never,
      softDeleted: false,
    } as never,
    file: {
      data: buffer,
      mimetype: file.type || 'application/octet-stream',
      name: file.name,
      size: file.size,
    },
  })

  // Link to invoice.documents relationship as well so the relation hasMany list stays in sync.
  const invoice = (await payload.findByID({
    collection: 'invoices',
    id: invoiceId as never,
    depth: 0,
  })) as { documents?: Array<string | number> | null }
  const existing = Array.isArray(invoice.documents)
    ? invoice.documents.map((d) => (typeof d === 'object' ? (d as { id: string | number }).id : d))
    : []
  await payload.update({
    collection: 'invoices',
    id: invoiceId as never,
    data: { documents: [...existing, created.id] as never } as never,
  })

  await recordAudit({
    payload,
    invoiceId,
    actorId,
    action: 'document_uploaded',
    context: { filename: file.name, size: file.size, mime: file.type },
  })

  revalidatePath(`/requests/${invoiceId}`)
  revalidatePath(`/requests/${invoiceId}/coding`)

  return { id: created.id as string | number }
}

export async function deleteDocument(documentId: string | number, invoiceId: string | number) {
  const payload = await getPayload()
  const actorId = await defaultActorId()
  // Soft delete — keep the file in storage for audit
  await payload.update({
    collection: 'documents',
    id: documentId as never,
    data: { softDeleted: true } as never,
  })
  await recordAudit({
    payload,
    invoiceId,
    actorId,
    action: 'document_deleted',
    context: { documentId },
  })
  revalidatePath(`/requests/${invoiceId}`)
  revalidatePath(`/requests/${invoiceId}/coding`)
}
