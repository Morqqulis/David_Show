'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from '../lib/payload'
import { getStageBySystemId, recordAudit } from '../lib/stage-engine'
import { guard, UserFacingError, type ActionResult } from '../../lib/action-result'
import { evaluateManualInvoiceDuplicate } from './intake-actions'

export async function createInvoiceManual(
  formData: FormData,
): Promise<ActionResult<{ id: string | number }>> {
  return guard(() => runCreateInvoiceManual(formData))
}

async function runCreateInvoiceManual(formData: FormData): Promise<{ id: string | number }> {
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

  if (!invoiceNumber) throw new UserFacingError('Enter the invoice number before saving.')

  // The duplicate rule is deliberately not intake-only: a vendor emailing AP
  // directly while a clerk keys the same invoice in by hand is exactly the case
  // it exists to catch. Whether it runs here at all, and whether a match blocks
  // or merely flags, is the administrator's setting.
  const vendorName = vendorId
    ? ((await payload.findByID({ collection: 'vendors', id: vendorId as never, depth: 0 })) as {
        name?: string
      }).name
    : undefined
  const duplicate = await evaluateManualInvoiceDuplicate({
    invoiceNumber,
    vendorName,
    poNumber: poNumber || undefined,
    subtotal,
    totalTax,
    grandTotal,
    invoiceDate: invoiceDate || undefined,
    dueDate: dueDate || undefined,
    fiscalYear,
  })
  if (duplicate.blocked) {
    const seen = duplicate.matches.map((m) => m.invoiceNumber).join(', ')
    console.error('[create-invoice] blocked as a duplicate', { invoiceNumber, matches: seen })
    throw new UserFacingError(`This invoice is already in the system (${seen}).`)
  }

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
      flags: {
        possibleDuplicate: duplicate.flagged,
        // The person typing this in has the paper in front of them, so a
        // mismatch here is a typo they can see and fix, not a bad scan.
        amountMismatch: Math.abs(subtotal + totalTax - grandTotal) > 0.01,
      },
      customFields: priority ? { priority } : {},
    } as never,
  })

  await recordAudit({ payload, invoiceId: invoice.id, actorId, action: 'created', context: { via: 'manual' } })
  revalidatePath('/requests')
  revalidatePath('/dashboard')

  return { id: invoice.id as string | number }
}
