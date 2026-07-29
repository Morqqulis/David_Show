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

// NOTE: a `recomputeInvoiceTotals()` helper used to live here. It overwrote the
// invoice's Amount Before Taxes / Total Tax / Invoice Total with the sum of the
// coding lines on every line save, which inverted the domain model: those three
// are what the VENDOR billed (typed on the New Invoice form, or extracted by
// OCR), and the coding lines are an allocation that has to reconcile *to* them.
// While it existed the sum-match rule could never fire — the header was rewritten
// to equal the lines microseconds before anything compared the two — and any
// OCR-extracted amount was destroyed the first time a coder touched a line.
// Header amounts are now only ever set by a human or by intake; see
// `updateInvoiceAmounts` in ./amounts.ts for the correction path.

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
