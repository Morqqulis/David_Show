import { getPayload } from './payload'
import { STAGE_ORDER, type StageId } from './stage-ids'

export const MAX_PAGE_SIZE = 50
export const DEFAULT_PAGE_SIZE = 25

function clampPageSize(n?: number): number {
  if (!n || n <= 0) return DEFAULT_PAGE_SIZE
  return Math.min(n, MAX_PAGE_SIZE)
}

export async function getStageCounts() {
  const payload = await getPayload()
  const stages = await payload.find({ collection: 'stages', limit: 50, depth: 0 })
  const stageMap = new Map<StageId, string | number>()
  for (const s of stages.docs as Array<{ id: string | number; systemId: StageId }>) {
    stageMap.set(s.systemId, s.id)
  }

  // Fire all per-stage counts in parallel. Sequential await in a loop on
  // Vercel Postgres adds up to seconds; Promise.all collapses it to the
  // slowest single query (typically ~200-400ms).
  const results = await Promise.all(
    STAGE_ORDER.map(async (sysId) => {
      const stageId = stageMap.get(sysId)
      if (!stageId) return [sysId, 0] as const
      const res = await payload.count({
        collection: 'invoices',
        where: {
          and: [
            { currentStage: { equals: stageId } },
            { softDeleted: { not_equals: true } },
          ],
        },
      })
      return [sysId, res.totalDocs] as const
    }),
  )

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
  for (const [sysId, total] of results) {
    counts[sysId] = total
    counts.all += total
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

export type InvoiceListResult = {
  docs: Array<Record<string, unknown> & { id: string | number; lines?: unknown[] }>
  totalDocs: number
  totalPages: number
  page: number
  pageSize: number
  hasPrevPage: boolean
  hasNextPage: boolean
}

export async function listInvoices(filters: InvoiceListFilters = {}): Promise<InvoiceListResult> {
  const payload = await getPayload()
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

  const page = Math.max(1, filters.page ?? 1)
  const pageSize = clampPageSize(filters.pageSize)
  const res = await payload.find({
    collection: 'invoices',
    where: { and } as never,
    depth: 2,
    sort: '-updatedAt',
    limit: pageSize,
    page,
  })

  // Batch-fetch lines for visible invoices in one query (avoids N+1 on row expansion).
  const invoiceIds = res.docs.map((d) => (d as { id: string | number }).id)
  const linesByInvoice: Record<string, unknown[]> = {}
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
  const docs = res.docs as unknown as Array<{ id: string | number; lines?: unknown[] }>
  for (const doc of docs) {
    doc.lines = linesByInvoice[String(doc.id)] ?? []
  }
  return {
    docs: docs as InvoiceListResult['docs'],
    totalDocs: res.totalDocs,
    totalPages: res.totalPages,
    page: res.page ?? page,
    pageSize,
    hasPrevPage: res.hasPrevPage,
    hasNextPage: res.hasNextPage,
  }
}

export async function getInvoiceWithLines(rawId: string | number) {
  const payload = await getPayload()
  // Postgres adapter uses numeric IDs; coerce string IDs from URL.
  const id = typeof rawId === 'string' && /^\d+$/.test(rawId) ? parseInt(rawId, 10) : rawId

  const invoice = await payload.findByID({
    collection: 'invoices',
    id: id as never,
    depth: 2,
    disableErrors: true,
  })
  if (!invoice) return null

  // Tight payload: only what the InvoiceView surfaces above the fold.
  // - Lines: keep depth: 2 (we need glAccount.code, taxCode.rate)
  // - Comments / audit: depth: 1 (just author/actor name), limit: 50
  //   (the Log tab paginates if it ever needs more)
  // - Documents: depth: 1 for uploaded URL only
  const [lines, comments, audit, documents] = await Promise.all([
    payload.find({
      collection: 'invoice-lines',
      where: { invoice: { equals: id } } as never,
      depth: 2,
      sort: 'order',
      limit: 100,
    }),
    payload.find({
      collection: 'invoice-comments',
      where: { invoice: { equals: id } } as never,
      depth: 1,
      sort: '-createdAt',
      limit: 50,
    }),
    payload.find({
      collection: 'audit-events',
      where: { invoice: { equals: id } } as never,
      depth: 1,
      sort: '-createdAt',
      limit: 50,
    }),
    payload.find({
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
    }),
  ])

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
