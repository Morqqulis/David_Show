import { getPayload } from './payload'
import { STAGE_ORDER, type StageId } from './stage-ids'

export async function getStageCounts() {
  const payload = await getPayload()
  const stages = await payload.find({ collection: 'stages', limit: 50 })
  const stageMap = new Map<StageId, string | number>()
  for (const s of stages.docs as Array<{ id: string | number; systemId: StageId }>) {
    stageMap.set(s.systemId, s.id)
  }

  const counts: Record<StageId | 'all', number> = {
    all: 0,
    to_be_assigned: 0,
    to_be_coded: 0,
    conditional_approvals: 0,
    ap_review: 0,
    ready_for_processing: 0,
    processed: 0,
    treasurer_review: 0,
    completed: 0,
  }
  for (const sysId of STAGE_ORDER) {
    const stageId = stageMap.get(sysId)
    if (!stageId) continue
    const res = await payload.count({
      collection: 'invoices',
      where: {
        and: [
          { currentStage: { equals: stageId } },
          { softDeleted: { not_equals: true } },
        ],
      },
    })
    counts[sysId] = res.totalDocs
    counts.all += res.totalDocs
  }
  return counts
}

export async function getAlertsCount() {
  const payload = await getPayload()
  const res = await payload.count({
    collection: 'invoices',
    where: { 'flags.archiveFailed': { equals: true } },
  })
  return res.totalDocs
}

export type InvoiceListFilters = {
  stage?: StageId | 'all'
  search?: string
  vendor?: string | number
  department?: string | number
  batch?: string | number
  flags?: Array<'archiveFailed' | 'possibleDuplicate' | 'noAttachment' | 'ocrFailed' | 'vendorSetupRequired'>
  confidential?: boolean
  page?: number
  pageSize?: number
}

export async function listInvoices(filters: InvoiceListFilters = {}) {
  const payload = await getPayload()
  const where: Record<string, unknown> = {
    softDeleted: { not_equals: true },
  }
  const and: Record<string, unknown>[] = [{ softDeleted: { not_equals: true } }]
  if (filters.stage && filters.stage !== 'all') {
    and.push({ 'currentStage.systemId': { equals: filters.stage } })
  }
  if (filters.search) {
    and.push({
      or: [
        { invoiceNumber: { like: filters.search } },
        { poNumber: { like: filters.search } },
        { 'vendor.name': { like: filters.search } },
        { 'batch.number': { like: filters.search } },
      ],
    })
  }
  if (filters.vendor) and.push({ vendor: { equals: filters.vendor } })
  if (filters.department) and.push({ departments: { contains: filters.department } })
  if (filters.batch) and.push({ batch: { equals: filters.batch } })
  if (filters.flags) {
    for (const flag of filters.flags) {
      and.push({ [`flags.${flag}`]: { equals: true } })
    }
  }
  if (filters.confidential != null) and.push({ confidential: { equals: filters.confidential } })

  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 25
  const res = await payload.find({
    collection: 'invoices',
    where: { and } as never,
    depth: 2,
    sort: '-updatedAt',
    limit: pageSize,
    page,
  })
  const invoiceIds = res.docs.map((d) => (d as { id: string | number }).id)
  let linesByInvoice: Record<string, unknown[]> = {}
  if (invoiceIds.length > 0) {
    const lineRes = await payload.find({
      collection: 'invoice-lines',
      where: { invoice: { in: invoiceIds } } as never,
      depth: 2,
      sort: 'order',
      limit: invoiceIds.length * 20,
    })
    for (const line of lineRes.docs as Array<{ invoice: { id?: string | number } | string | number }>) {
      const invId =
        typeof line.invoice === 'object' && line.invoice
          ? String((line.invoice as { id: string | number }).id)
          : String(line.invoice)
      ;(linesByInvoice[invId] = linesByInvoice[invId] ?? []).push(line)
    }
  }
  for (const doc of res.docs as unknown as Array<{ id: string | number; lines?: unknown[] }>) {
    doc.lines = linesByInvoice[String(doc.id)] ?? []
  }
  return res
}

export async function getInvoiceWithLines(rawId: string | number) {
  const payload = await getPayload()
  // Postgres adapter uses numeric IDs; the URL hands us a string. Coerce if it parses cleanly.
  const numeric = typeof rawId === 'string' && /^\d+$/.test(rawId) ? parseInt(rawId, 10) : rawId
  const id = numeric

  // depth: 2 is enough — vendor.name, currentStage.systemId, departments[].name, assignees[].name, batch.number, stage.label.
  // depth: 3 explodes through stages.fieldsEditableBy → roles → permissions, which is heavy and circular-ish.
  // disableErrors so we get null instead of a thrown NotFound for genuinely missing IDs.
  const invoice = await payload.findByID({
    collection: 'invoices',
    id: id as never,
    depth: 2,
    disableErrors: true,
  })
  if (!invoice) return null
  const lines = await payload.find({
    collection: 'invoice-lines',
    where: { invoice: { equals: id } } as never,
    depth: 2,
    sort: 'order',
    limit: 100,
  })
  const comments = await payload.find({
    collection: 'invoice-comments',
    where: { invoice: { equals: id } } as never,
    depth: 1,
    sort: '-createdAt',
    limit: 100,
  })
  const audit = await payload.find({
    collection: 'audit-events',
    where: { invoice: { equals: id } } as never,
    depth: 1,
    sort: '-createdAt',
    limit: 200,
  })
  const documents = await payload.find({
    collection: 'documents',
    where: {
      and: [
        { invoice: { equals: id } },
        { softDeleted: { not_equals: true } },
      ],
    } as never,
    depth: 1,
    sort: '-createdAt',
    limit: 50,
  })
  return {
    invoice,
    lines: lines.docs,
    comments: comments.docs,
    audit: audit.docs,
    documents: documents.docs,
  }
}

export async function getStageBySystemId(systemId: StageId) {
  const payload = await getPayload()
  const res = await payload.find({
    collection: 'stages',
    where: { systemId: { equals: systemId } },
    limit: 1,
  })
  return res.docs[0] as { id: string | number; systemId: StageId; label: string } | undefined
}
