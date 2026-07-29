'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from '../../lib/payload'
import { recordAudit } from '../../lib/stage-engine'
import { computeLine } from '../../lib/tax-math'
import {
  evaluateCodingCompleteness,
  isCodingCheckEnforced,
  type CodingRules,
  type CodingVerdict,
} from '../../lib/coding-completeness'
import { fetchCodingRules } from '../coding-rules-actions'
import { assertLineCodingAllowed, syncCrossDepartmentApprovers } from '../../lib/gl-department-routing'
import { defaultActorId } from './_helpers'

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
  // Authoritative half of the coding restriction. The GL dropdown is filtered
  // for usability, but a caller that skips the UI has to be refused too, so
  // this runs before anything is written. It is a no-op when no GL format is
  // configured or the actor's role carries Bypass Coding Restrictions.
  await assertLineCodingAllowed(line.glAccount)

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

  // Coding a line to another department's GL pulls that department's reviewer
  // onto the invoice as a parallel approver. Runs after the write so it sees
  // the line that was just saved.
  await syncCrossDepartmentApprovers(line.invoice)

  revalidatePath(`/requests/${line.invoice}`)
  revalidatePath(`/requests/${line.invoice}/coding`)
}

// ────────────────────────────────────────────────────────────────────────────
// Sum-match gate (Settings → Coding Table)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Marker for "department X has submitted its coding on this invoice".
 *
 * It is persisted as an audit event on the invoice rather than as a column,
 * because the marker is by nature an event — who submitted, for which
 * department, when — and the audit trail already carries exactly that shape,
 * is already scoped per invoice, and already surfaces in the invoice Log tab
 * where a clerk can see the progression of a multi-department invoice.
 * `action` reuses the existing `coded` value from AUDIT_ACTIONS and the
 * discriminator below distinguishes a submission from an ordinary line save.
 */
const DEPARTMENT_SUBMISSION_EVENT = 'department_coding_submitted'

/** Upper bound on the audit rows scanned for submission markers, see below. */
const AUDIT_SCAN_LIMIT = 500

type InvoiceDepartment = { id: string | number; name: string }

export type CodingGateState = {
  rules: CodingRules
  /** The verdict exactly as the server will apply it, carve-out included. */
  verdict: CodingVerdict
  /** False while more than one department still owes a coding submission. */
  enforced: boolean
  /** Departments on this invoice that have not submitted their coding yet. */
  outstandingDepartments: InvoiceDepartment[]
  /**
   * Saved coding lines. The rule applies to every forward transition on an
   * invoice that has lines; callers use this to skip stages that legitimately
   * have none yet, such as leaving To Be Assigned.
   */
  lineCount: number
}

async function readSubmittedDepartmentIds(
  payload: Awaited<ReturnType<typeof getPayload>>,
  invoiceId: string | number,
): Promise<Set<string>> {
  // Ordinary line saves also write `coded` events, so the markers sit among
  // them. Newest-first with a fixed ceiling keeps this a bounded query; an
  // invoice would need 500 line saves between submissions to push a marker
  // out of range, which no real coding session approaches.
  const events = await payload.find({
    collection: 'audit-events',
    where: { invoice: { equals: invoiceId }, action: { equals: 'coded' } } as never,
    sort: '-createdAt',
    limit: AUDIT_SCAN_LIMIT,
    depth: 0,
  })
  const submitted = new Set<string>()
  for (const doc of events.docs as Array<{ context?: unknown }>) {
    const ctx = doc.context as { event?: string; department?: string | number } | null | undefined
    if (ctx?.event === DEPARTMENT_SUBMISSION_EVENT && ctx.department != null) {
      submitted.add(String(ctx.department))
    }
  }
  return submitted
}

function toDepartmentList(raw: unknown): InvoiceDepartment[] {
  if (!Array.isArray(raw)) return []
  return raw.map((d, i) => {
    if (d && typeof d === 'object') {
      const doc = d as { id: string | number; name?: string }
      return { id: doc.id, name: doc.name ?? 'Department' }
    }
    return { id: d as string | number, name: `Department ${i + 1}` }
  })
}

/**
 * Assembles every fact the sum-match rule needs and returns the verdict. Used
 * by `approveInvoice` (authoritative, throws on block) and by the coding screen
 * (advisory, shows the coder what is still missing).
 */
export async function fetchCodingGate(invoiceId: string | number): Promise<CodingGateState> {
  const payload = await getPayload()
  const [rules, invoice, lineRes] = await Promise.all([
    fetchCodingRules(),
    payload.findByID({ collection: 'invoices', id: invoiceId as never, depth: 1 }) as Promise<{
      subtotal?: number
      grandTotal?: number
      departments?: unknown
    }>,
    payload.find({
      collection: 'invoice-lines',
      where: { invoice: { equals: invoiceId } } as never,
      limit: 500,
      depth: 0,
    }),
  ])

  const departments = toDepartmentList(invoice.departments)
  const submitted = await readSubmittedDepartmentIds(payload, invoiceId)
  const outstandingDepartments = departments.filter((d) => !submitted.has(String(d.id)))
  const enforced = isCodingCheckEnforced(outstandingDepartments.length)

  const lines = (lineRes.docs as Array<{ id: string | number; amount?: number; glAccount?: unknown }>).map(
    (l) => ({ id: l.id, amount: l.amount ?? 0, hasGlAccount: l.glAccount != null }),
  )

  const verdict = evaluateCodingCompleteness({
    rules,
    lines,
    subtotal: invoice.subtotal ?? 0,
    grandTotal: invoice.grandTotal ?? 0,
    enforce: enforced,
  })

  return { rules, verdict, enforced, outstandingDepartments, lineCount: lines.length }
}

/**
 * Records that one department has finished its share of a multi-department
 * invoice. It does not move the invoice — the last department still has to
 * approve, and that approval is the one the sum-match rule is enforced on.
 */
export async function submitDepartmentCoding(
  invoiceId: string | number,
  departmentId: string | number,
) {
  const payload = await getPayload()
  const invoice = (await payload.findByID({
    collection: 'invoices',
    id: invoiceId as never,
    depth: 1,
  })) as { departments?: unknown }

  const departments = toDepartmentList(invoice.departments)
  const match = departments.find((d) => String(d.id) === String(departmentId))
  if (!match) {
    console.error('[coding-gate] department submission rejected — not on this invoice', {
      invoiceId,
      departmentId,
    })
    throw new Error('That department is not assigned to this invoice.')
  }

  const submitted = await readSubmittedDepartmentIds(payload, invoiceId)
  if (submitted.has(String(departmentId))) {
    throw new Error(`${match.name} has already submitted its coding.`)
  }

  const actorId = await defaultActorId()
  await recordAudit({
    payload,
    invoiceId,
    actorId,
    action: 'coded',
    context: { event: DEPARTMENT_SUBMISSION_EVENT, department: match.id, departmentName: match.name },
  })
  revalidatePath(`/requests/${invoiceId}`)
  revalidatePath(`/requests/${invoiceId}/coding`)
}

export async function deleteLine(lineId: string | number) {
  const payload = await getPayload()
  const line = (await payload.findByID({ collection: 'invoice-lines', id: lineId as never })) as {
    invoice: string | number | { id: string | number }
  }
  const invoiceId = typeof line.invoice === 'object' ? (line.invoice as { id: string | number }).id : line.invoice
  await payload.delete({ collection: 'invoice-lines', id: lineId as never })
  revalidatePath(`/requests/${invoiceId}`)
  revalidatePath(`/requests/${invoiceId}/coding`)
}
