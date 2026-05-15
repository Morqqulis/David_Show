'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from '../../lib/payload'
import { recordAudit } from '../../lib/stage-engine'
import { computeLine } from '../../lib/tax-math'
import { defaultActorId, recomputeInvoiceTotals } from './_helpers'

export type CodingLineInput = {
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
}

export async function saveLine(line: CodingLineInput) {
  const payload = await getPayload()
  const actorId = await defaultActorId()

  let rate = 0
  let recoverablePct = 0
  if (line.taxCode) {
    const taxDoc = (await payload.findByID({ collection: 'tax-codes', id: line.taxCode as never })) as {
      rate: number
      recoverablePct: number
    }
    rate = taxDoc.rate
    recoverablePct = taxDoc.recoverablePct
  }
  const computed = computeLine({ amount: line.amount, rate, recoverablePct })

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
