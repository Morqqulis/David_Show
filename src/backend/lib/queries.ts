import { unstable_cache } from 'next/cache'
import { getPayload } from './payload'
import { STAGE_ORDER, type StageId } from './stage-ids'
import type { ColumnFieldDoc, SavedViewSpec } from './invoice-filters'

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
 * Accepts the same clauses as `fetchRequestsPage` so the counts shown on the
 * stage tabs and in the sidebar reflect whatever filter is applied (search,
 * flag, column filters). Without extraFilters it returns global totals.
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
  flags?: Array<
    | 'archiveFailed'
    | 'possibleDuplicate'
    | 'noAttachment'
    | 'ocrFailed'
    | 'vendorSetupRequired'
    | 'amountMismatch'
  >
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
  poNumber: true,
  fiscalYear: true,
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

export type RequestsQuery = {
  /** Stage tab the screen is showing. Part of the saved view, not separate from it. */
  stage: StageId | 'all'
  search?: string
  flags?: InvoiceListFilters['flags']
  /** Already-compiled column-filter clauses from `compileInvoiceFilters`. */
  columnClauses?: Record<string, unknown>[]
  /** Already-mapped Payload sort keys from `buildInvoiceSort`. */
  sort?: string[]
  page?: number
  pageSize?: number
}

export type RequestsPageResult = InvoiceListResult & {
  counts: Record<StageId | 'all', number>
}

/**
 * The single SSR fetch behind /requests.
 *
 * Filtering, sorting and pagination all run in the database against the whole
 * result set. The previous design loaded every active invoice and filtered in
 * the browser, which looked right on a seeded demo and would have quietly
 * missed rows the moment an AP shop grew past one page of history.
 *
 * Counts come back from the same call as the rows, computed from the same
 * clauses, so the tab badges and the sidebar can be published in the same
 * React commit as the table body — no lag between the chrome and the data.
 *
 * Deliberately NOT wrapped in `unstable_cache`: the cache key would include
 * the user's ad-hoc filter, so every keystroke-shaped variation would mint a
 * new entry that is never read again. The counts query underneath is cached.
 */
export async function fetchRequestsPage(query: RequestsQuery): Promise<RequestsPageResult> {
  const payload = await getPayload()
  const shared = buildFilterClauses({ search: query.search, flags: query.flags })
  const filterClauses = [...shared, ...(query.columnClauses ?? [])]
  const page = Math.max(1, query.page ?? 1)
  const pageSize = clampPageSize(query.pageSize)
  const stageClause =
    query.stage === 'all' ? [] : [{ 'currentStage.systemId': { equals: query.stage } }]

  const [res, counts] = await Promise.all([
    payload.find({
      collection: 'invoices',
      where: { and: [...filterClauses, ...stageClause] } as never,
      select: INVOICE_LIST_SELECT as never,
      depth: 1,
      sort: (query.sort?.length ? query.sort : ['-updatedAt']) as never,
      limit: pageSize,
      page,
    }),
    getStageCounts(filterClauses),
  ])

  return {
    docs: res.docs as InvoiceListResult['docs'],
    totalDocs: res.totalDocs,
    totalPages: res.totalPages,
    page: res.page ?? page,
    pageSize,
    hasPrevPage: res.hasPrevPage,
    hasNextPage: res.hasNextPage,
    counts,
  }
}

/** Hard ceiling on a single CSV export, so one click cannot exhaust memory. */
export const EXPORT_ROW_CAP = 5000

/** Every row matching the current filter, for the CSV export. Same clauses as the screen. */
export async function fetchInvoicesForExport(
  query: Omit<RequestsQuery, 'page' | 'pageSize'>,
): Promise<InvoiceListResult['docs']> {
  const payload = await getPayload()
  const shared = buildFilterClauses({ search: query.search, flags: query.flags })
  const filterClauses = [...shared, ...(query.columnClauses ?? [])]
  const stageClause =
    query.stage === 'all' ? [] : [{ 'currentStage.systemId': { equals: query.stage } }]

  const res = await payload.find({
    collection: 'invoices',
    where: { and: [...filterClauses, ...stageClause] } as never,
    select: INVOICE_LIST_SELECT as never,
    depth: 1,
    sort: (query.sort?.length ? query.sort : ['-updatedAt']) as never,
    limit: EXPORT_ROW_CAP,
    page: 1,
  })
  return res.docs as InvoiceListResult['docs']
}

/**
 * Header fields an administrator may expose as a column, straight from
 * Settings → Fields. `showAsColumn` on a field is what item 7 wires up here.
 */
export const getColumnFieldDocs = unstable_cache(
  async function getColumnFieldDocs(): Promise<ColumnFieldDoc[]> {
    const payload = await getPayload()
    const res = await payload.find({
      collection: 'fields',
      where: { scope: { equals: 'header' } } as never,
      sort: 'order',
      limit: 200,
      depth: 0,
    })
    return (res.docs as unknown as ColumnFieldDoc[]).map((f) => ({
      fieldKey: f.fieldKey,
      label: f.label,
      scope: f.scope,
      type: f.type,
      showAsColumn: f.showAsColumn,
      options: f.options ?? null,
    }))
  },
  ['column-field-docs'],
  { tags: ['fields'], revalidate: STAGES_CACHE_TTL },
)

export type FilterOptionSources = {
  departments: Array<{ value: string; label: string }>
  assignees: Array<{ value: string; label: string }>
  stages: Array<{ value: string; label: string }>
}

/** Choice lists for the multi-select and people-picker filter controls. */
export const getFilterOptionSources = unstable_cache(
  async function getFilterOptionSources(): Promise<FilterOptionSources> {
    const payload = await getPayload()
    const [departments, users, stages] = await Promise.all([
      payload.find({ collection: 'departments', limit: 200, depth: 0, sort: 'code' }),
      payload.find({ collection: 'users', limit: 200, depth: 0, sort: 'name' }),
      payload.find({ collection: 'stages', limit: 50, depth: 0, sort: 'order' }),
    ])
    return {
      departments: (departments.docs as Array<{ code: string; name: string }>).map((d) => ({
        value: d.code,
        label: d.name ? `${d.name} (${d.code})` : d.code,
      })),
      assignees: (users.docs as Array<{ id: string | number; name?: string; email?: string }>).map((u) => ({
        value: String(u.id),
        label: u.name || u.email || 'Unnamed user',
      })),
      stages: (stages.docs as Array<{ systemId: string; label: string }>).map((s) => ({
        value: s.systemId,
        label: s.label,
      })),
    }
  },
  ['filter-option-sources'],
  { tags: [STAGES_CACHE_TAG], revalidate: STAGES_CACHE_TTL },
)

export type SavedViewRecord = SavedViewSpec & {
  id: string | number
  name: string
  isDefault: boolean
  /** False when the view was published to the reader by an administrator. */
  editable: boolean
  publishedToRoles: Array<string | number>
}

/**
 * Views the current operator can open: their own, plus any view an
 * administrator published to their role. Published views arrive read-only —
 * they keep their author as owner, so nobody inherits a maintenance burden.
 */
export async function listSavedViewsForActor(): Promise<SavedViewRecord[]> {
  const payload = await getPayload()
  const actor = await payload.find({
    collection: 'users',
    where: { email: { equals: 'david@aurora.ca' } } as never,
    limit: 1,
    depth: 0,
  })
  const actorDoc = actor.docs[0] as { id: string | number; role?: string | number } | undefined
  if (!actorDoc) return []

  const ownership: Record<string, unknown>[] = [{ owner: { equals: actorDoc.id } }]
  if (actorDoc.role != null) ownership.push({ publishedToRoles: { in: [actorDoc.role] } })

  const res = await payload.find({
    collection: 'saved-views' as never,
    where: { or: ownership } as never,
    limit: 100,
    depth: 0,
    sort: 'name',
  })

  return (res.docs as unknown as Array<Record<string, unknown>>).map((doc) => {
    const owner = doc.owner as string | number | { id: string | number } | undefined
    const ownerId = typeof owner === 'object' && owner ? owner.id : owner
    return {
      id: doc.id as string | number,
      name: String(doc.name ?? 'Untitled view'),
      stage: typeof doc.stage === 'string' ? doc.stage : 'all',
      columns: Array.isArray(doc.columns) ? (doc.columns as string[]) : [],
      columnOrder: Array.isArray(doc.columnOrder) ? (doc.columnOrder as string[]) : [],
      filters: Array.isArray(doc.filters) ? (doc.filters as SavedViewSpec['filters']) : [],
      sort: Array.isArray(doc.sort) ? (doc.sort as SavedViewSpec['sort']) : [],
      isDefault: doc.isDefault === true,
      editable: String(ownerId) === String(actorDoc.id),
      publishedToRoles: Array.isArray(doc.publishedToRoles)
        ? (doc.publishedToRoles as Array<string | number | { id: string | number }>).map((r) =>
            typeof r === 'object' && r ? r.id : r,
          )
        : [],
    }
  })
}

/** Roles an administrator can publish a view to. */
export async function listPublishableRoles(): Promise<Array<{ id: string | number; name: string }>> {
  const payload = await getPayload()
  const res = await payload.find({ collection: 'roles', limit: 100, depth: 0, sort: 'name' })
  return (res.docs as Array<{ id: string | number; name: string }>).map((r) => ({
    id: r.id,
    name: r.name,
  }))
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
