'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from '../lib/payload'
import { getStageBySystemId, recordAudit } from '../lib/stage-engine'

export async function createInvoiceManual(formData: FormData): Promise<{ id: string | number }> {
  const payload = await getPayload()
  const invoiceNumber = String(formData.get('invoiceNumber') ?? '').trim()
  const vendorId = formData.get('vendor') ? String(formData.get('vendor')) : null
  const invoiceDate = String(formData.get('invoiceDate') ?? '')
  const dueDate = String(formData.get('dueDate') ?? '')
  const poNumber = String(formData.get('poNumber') ?? '')
  const subtotal = Number(formData.get('subtotal') ?? 0)
  const totalTax = Number(formData.get('totalTax') ?? 0)
  const grandTotal = Number(formData.get('grandTotal') ?? subtotal + totalTax)
  const fiscalYear = String(formData.get('fiscalYear') ?? new Date().getFullYear())
  const priority = String(formData.get('priority') ?? '')
  const confidential = formData.get('confidential') === 'on'

  if (!invoiceNumber) throw new Error('Invoice number required')

  const tba = await getStageBySystemId(payload, 'to_be_assigned')
  const admin = await payload.find({
    collection: 'users',
    where: { email: { equals: 'david@aurora.ca' } } as never,
    limit: 1,
  })
  const actorId = admin.docs[0]?.id

  const invoice = await payload.create({
    collection: 'invoices',
    data: {
      invoiceNumber,
      vendor: vendorId as never,
      invoiceDate: invoiceDate || undefined,
      dueDate: dueDate || undefined,
      fiscalYear,
      poNumber: poNumber || undefined,
      subtotal,
      totalTax,
      grandTotal,
      currentStage: tba!.id as never,
      createdVia: 'manual',
      confidential,
      customFields: priority ? { priority } : {},
    } as never,
  })

  await recordAudit({ payload, invoiceId: invoice.id, actorId, action: 'created', context: { via: 'manual' } })
  revalidatePath('/requests')
  revalidatePath('/dashboard')

  return { id: invoice.id as string | number }
}
