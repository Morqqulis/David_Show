import 'server-only'
import { getPayload } from '../../lib/payload'
import { evaluateGroup, type ConditionGroup } from '../../lib/conditions'

export async function defaultActorId() {
  const payload = await getPayload()
  const admin = await payload.find({
    collection: 'users',
    where: { email: { equals: 'david@aurora.ca' } } as never,
    limit: 1,
  })
  return admin.docs[0]?.id
}

export async function recomputeInvoiceTotals(invoiceId: string | number) {
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

export async function evaluateAnyApprovalRule(
  rules: Array<{ conditions?: ConditionGroup }>,
  invoiceId: string | number,
): Promise<boolean> {
  const payload = await getPayload()
  const invoice = (await payload.findByID({ collection: 'invoices', id: invoiceId as never, depth: 2 })) as {
    grandTotal: number
    subtotal?: number
    departments?: Array<{ id: string | number }>
    customFields?: Record<string, unknown>
  }
  const get = (key: string): unknown => {
    if (key === 'grandTotal') return invoice.grandTotal
    if (key === 'subtotal') return invoice.subtotal
    if (key === 'department')
      return Array.isArray(invoice.departments) ? invoice.departments.map((d) => d.id) : []
    return invoice.customFields?.[key]
  }
  return rules.some((r) => r.conditions && evaluateGroup(r.conditions, get))
}
