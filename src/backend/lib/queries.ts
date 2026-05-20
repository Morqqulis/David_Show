import { unstable_cache } from 'next/cache'
import { getPayload } from './payload'
import { STAGE_ORDER, type StageId } from './stage-ids'

export const MAX_PAGE_SIZE = 50
export const DEFAULT_PAGE_SIZE = 25

/**
 * Cache contract for invoice-related queries.
 *
 * - `TTL = 30s` — natural staleness ceiling: if no mutation happens, data
 *   refreshes at most every 30 seconds. Acceptable for AP workflows; users
 *   making changes see fresh data immediately through tag invalidation.
 * - `TAG = 'invoices'` — every invoice mutation calls `revalidateTag('invoices')`
 *   so caches drop instantly on Approve/Reject/Create/etc.
 */
const CACHE_TTL = 30
const CACHE_TAG = 'invoices'
// Stage definitions (label, order, active) change rarely and only through
// Settings → Workflow. Tag separately from the high-churn invoices cache so
// admin edits invalidate sidebar/topbar without dumping per-invoice queries.
const STAGES_CACHE_TAG = 'stages'
const STAGES_CACHE_TTL = 300

export type StageDefinition = {
  id: string | number
  systemId: StageId
  label: string
  order: number
  active: boolean
}

export const getStageDefinitions = unstable_cache(
  async function getStageDefinitions(): Promise<StageDefinition[]> {
    const payload = await getPayload()
    const res = await payload.find({
      collection: 'stages',
      limit: 50,
      depth: 0,
      sort: 'order',
    })
    return (res.docs as Array<{
      id: string | number
      systemId: StageId
      label: string
      order: number
      active: boolean
    }>).map((s) => ({
      id: s.id,
      systemId: s.systemId,
      label: s.label,
      order: s.order,
      active: s.active,
    }))
  },
  ['stage-definitions'],
  { tags: [STAGES_CACHE_TAG], revalidate: STAGES_CACHE_TTL },
)

function clampPageSize(n?: number): number {
  if (!n || n <= 0) return DEFAULT_PAGE_SIZE
  return Math.min(n, MAX_PAGE_SIZE)
}

/**
 * Per-stage invoice counts.
 *
 * Accepts the same shared filter clauses as `fetchInvoicesForTabs` so the
 * counts shown in TabsTrigger / Sidebar reflect any active filter (search,
 * flag, vendor, batch). Without extraFilters it returns global totals.
 *
 * Wrapped in `unstable_cache` so multiple page navigations sharing the same
 * filter args return cached counts without re-hitting the DB. Cache key
 * includes the filter args automatically.
 */
export const getStageCounts = unstable_cache(
  async function getStageCounts(extraFilters: Record<string, unknown>[] = []) {
  const payload = await getPayload()
  const stages = await payload.find({ collection: 'stages', limit: 50, depth: 0 })
  const stageMap = new Map<StageId, string | number>()
  for (const s of stages.docs as Array<{ id: string | number; systemId: StageId }>) {
    stageMap.set(s.systemId, s.id)
  }

  // Fire all per-stage counts in parallel. Sequential await in a loop on
  // Vercel Postgres adds up to seconds; Promise.all collapses it to the
  // slowest single query (typically ~200-400ms).
  const baseClauses = extraFilters.length
    ? extraFilters
    : [{ softDeleted: { not_equals: true } }]
  const results = await Promise.all(
    STAGE_ORDER.map(async (sysId) => {
      const stageId = stageMap.get(sysId)
      if (!stageId) return [sysId, 0] as const
      const res = await payload.count({
        collection: 'invoices',
        where: {
          and: [...baseClauses, { currentStage: { equals: stageId } }],
        } as never,
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
  },
  ['stage-counts'],
  { tags: [CACHE_TAG], revalidate: CACHE_TTL },
)

export const getAlertsCount = unstable_cache(
  async function getAlertsCount() {
    const payload = await getPayload()
    const res = await payload.count({
      collection: 'invoices',
      where: { 'flags.archiveFailed': { equals: true } },
    })
    return res.totalDocs
  },
  ['alerts-count'],
  { tags: [CACHE_TAG], revalidate: CACHE_TTL },
)

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

/**
 * Build the shared filter clauses (search / vendor / batch / flag / confidential).
 * Stage filter is layered on top by callers depending on their need.
 */
function buildFilterClauses(filters: Omit<InvoiceListFilters, 'stage' | 'page' | 'pageSize'>) {
  const and: Record<string, unknown>[] = [{ softDeleted: { not_equals: true } }]
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
  return and
}

/**
 * Minimal field set for the invoice list/table view. Payload's `select` lets us
 * skip heavy fields (customFields and the full flags group are still pulled
 * because the UI uses priority + flag chips; everything else is dropped).
 * Brings per-row payload from ~3-5KB to ~400 bytes.
 */
const INVOICE_LIST_SELECT = {
  invoiceNumber: true,
  invoiceDate: true,
  dueDate: true,
  subtotal: true,
  totalTax: true,
  grandTotal: true,
  confidential: true,
  flags: true,
  customFields: true,
  vendor: true,
  currentStage: true,
  departments: true,
  assignees: true,
  batch: true,
  createdAt: true,
  updatedAt: true,
}

export type TabbedInvoicesResult = {
  active: InvoiceListResult['docs']
  completed: InvoiceListResult
  counts: Record<StageId | 'all', number>
}

/**
 * Single SSR fetch for the /requests page (Tabs UX).
 *
 * - `active`: every invoice NOT in `completed` stage, no pagination — they get
 *   distributed client-side across 8 tabs by `currentStage.systemId`. With
 *   `select` + `depth: 1` the payload is light (~200-1000 records typical for
 *   an AP shop).
 * - `completed`: paginated separately because the completed archive can grow
 *   unbounded over years. Honors `completedPage` for navigation.
 * - `counts`: per-stage totals from cheap COUNT queries (already parallelized).
 *
 * All three run in parallel via `Promise.all`.
 */
export const fetchInvoicesForTabs = unstable_cache(
  async function fetchInvoicesForTabs(
    filters: Omit<InvoiceListFilters, 'stage'> & { completedPage?: number } = {},
  ): Promise<TabbedInvoicesResult> {
  const payload = await getPayload()
  const filterClauses = buildFilterClauses(filters)
  const completedPage = Math.max(1, filters.completedPage ?? 1)
  const completedPageSize = clampPageSize(filters.pageSize)

  const [activeRes, completedRes, counts] = await Promise.all([
    payload.find({
      collection: 'invoices',
      where: {
        and: [...filterClauses, { 'currentStage.systemId': { not_equals: 'completed' } }],
      } as never,
      select: INVOICE_LIST_SELECT as never,
      depth: 1,
      sort: '-updatedAt',
      pagination: false,
      limit: 0,
    }),
    payload.find({
      collection: 'invoices',
      where: {
        and: [...filterClauses, { 'currentStage.systemId': { equals: 'completed' } }],
      } as never,
      select: INVOICE_LIST_SELECT as never,
      depth: 1,
      sort: '-updatedAt',
      limit: completedPageSize,
      page: completedPage,
    }),
    // Pass the same filters into counts so TabsTrigger + Sidebar reflect the
    // active filter, not global totals.
    getStageCounts(filterClauses),
  ])

  return {
    active: activeRes.docs as InvoiceListResult['docs'],
    completed: {
      docs: completedRes.docs as InvoiceListResult['docs'],
      totalDocs: completedRes.totalDocs,
      totalPages: completedRes.totalPages,
      page: completedRes.page ?? completedPage,
      pageSize: completedPageSize,
      hasPrevPage: completedRes.hasPrevPage,
      hasNextPage: completedRes.hasNextPage,
    },
    counts,
  }
  },
  ['invoices-for-tabs'],
  { tags: [CACHE_TAG], revalidate: CACHE_TTL },
)

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
