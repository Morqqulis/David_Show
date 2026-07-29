'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from '../../lib/payload'
import { recordAudit } from '../../lib/stage-engine'
import { round2 } from '../../lib/tax-math'
import { defaultActorId } from './_helpers'

export type InvoiceAmounts = {
  subtotal: number
  totalTax: number
  grandTotal: number
}

/**
 * Correct the amounts printed on the vendor's invoice.
 *
 * These three are header facts, not derived values: they are typed on the New
 * Invoice form or extracted by OCR, and the coding lines have to reconcile to
 * them. That makes a correction path mandatory rather than optional — an
 * invoice whose scan was misread would otherwise be stuck forever, because the
 * sum-match gate blocks a coder who has no way to fix the number they are being
 * measured against.
 *
 * Deliberately narrow: this touches the three amounts and nothing else.
 */
export async function updateInvoiceAmounts(
  invoiceId: string | number,
  amounts: InvoiceAmounts,
): Promise<InvoiceAmounts> {
  const next = {
    subtotal: round2(Number(amounts.subtotal)),
    totalTax: round2(Number(amounts.totalTax)),
    grandTotal: round2(Number(amounts.grandTotal)),
  }

  for (const [key, value] of Object.entries(next)) {
    if (!Number.isFinite(value)) {
      console.error('[invoice-amounts] rejected non-numeric amount', { invoiceId, key })
      throw new Error('Amounts must be numbers.')
    }
    if (value < 0) {
      console.error('[invoice-amounts] rejected negative amount', { invoiceId, key, value })
      throw new Error('Amounts cannot be negative. Use a credit note for a refund.')
    }
  }

  const payload = await getPayload()

  let previous: InvoiceAmounts
  // Read alongside the amounts so the flag group can be written back whole.
  // Payload replaces a group wholesale, so sending only the one flag would
  // quietly clear "no attachment", "possible duplicate" and the rest.
  let existingFlags: Record<string, unknown> = {}
  try {
    const current = (await payload.findByID({
      collection: 'invoices',
      id: invoiceId as never,
      depth: 0,
    })) as Partial<InvoiceAmounts> & { flags?: Record<string, unknown> | null }
    previous = {
      subtotal: current.subtotal ?? 0,
      totalTax: current.totalTax ?? 0,
      grandTotal: current.grandTotal ?? 0,
    }
    existingFlags = current.flags ?? {}
  } catch (err) {
    console.error('[invoice-amounts] invoice not found', { invoiceId, err })
    throw new Error('That invoice could not be found.')
  }

  // Correcting the figures has to move the "amounts do not add up" flag with
  // them, or the queue keeps showing a warning about a problem somebody has
  // just fixed — and, worse, stops showing one they have just introduced.
  // The correction itself is never refused: the vendor's own invoice is
  // sometimes wrong, and recording what it says is the point.
  const reconciles = Math.abs(next.subtotal + next.totalTax - next.grandTotal) <= 0.01

  try {
    await payload.update({
      collection: 'invoices',
      id: invoiceId as never,
      data: { ...next, flags: { ...existingFlags, amountMismatch: !reconciles } } as never,
    })
  } catch (err) {
    console.error('[invoice-amounts] update failed', { invoiceId, err })
    throw new Error('The amounts could not be saved. Nothing was changed.')
  }

  // The intake audit entry is the only record of what OCR originally produced,
  // so every later correction has to be traceable against it.
  await recordAudit({
    payload,
    invoiceId,
    actorId: await defaultActorId(),
    action: 'amounts_corrected',
    context: { previous, next },
  })

  revalidatePath(`/requests/${invoiceId}`)
  revalidatePath(`/requests/${invoiceId}/coding`)
  revalidatePath('/requests')

  return next
}
