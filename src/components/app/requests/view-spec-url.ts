import type { InvoiceColumn, SavedViewSpec } from '@/backend/lib/invoice-filters'
import { STAGE_ORDER } from '@/backend/lib/stage-ids'

/**
 * The All Requests screen keeps its whole arrangement in the URL: stage,
 * column set, column order, filters, sort and page. That is what makes the
 * screen shareable, survivable across a browser refresh, and — because the
 * server reads the very same parameters — guarantees the rows on screen, the
 * tab counts and the CSV export are answering one question, not three.
 */
export type RequestsParams = Record<string, string | undefined>

export const SPEC_PARAM = {
  stage: 'tab',
  columns: 'cols',
  order: 'order',
  filters: 'filters',
  sort: 'sort',
  view: 'view',
  page: 'page',
} as const

function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T) : fallback
  } catch (err) {
    // A hand-edited or truncated link should open the default view rather than
    // blow up the page for the person who clicked it.
    console.error('[requests/url] could not read a value from the link', { err })
    return fallback
  }
}

function parseList(raw: string | undefined): string[] | null {
  if (raw == null || raw === '') return null
  return raw.split(',').filter(Boolean)
}

/** Stage tab carried by the URL, defaulting to All. */
export function readStage(params: RequestsParams): string {
  const raw = params[SPEC_PARAM.stage]
  if (raw === 'all') return 'all'
  return raw && (STAGE_ORDER as readonly string[]).includes(raw) ? raw : 'all'
}

/** The arrangement a stage opens with before the user changes anything. */
export function defaultSpec(stage: string, columns: InvoiceColumn[]): SavedViewSpec {
  return {
    stage,
    // The Stage column is redundant inside a single-stage tab.
    columns: columns
      .filter((c) => c.defaultVisible && !(stage !== 'all' && c.id === 'currentStage'))
      .map((c) => c.id),
    columnOrder: columns.map((c) => c.id),
    filters: [],
    sort: [{ id: 'invoiceDate', desc: true }],
  }
}

/** Keep only ids that still exist, then append anything new at the end. */
function reconcileOrder(order: string[], columns: InvoiceColumn[]): string[] {
  const known = new Set(columns.map((c) => c.id))
  const kept = order.filter((id) => known.has(id))
  const seen = new Set(kept)
  return [...kept, ...columns.map((c) => c.id).filter((id) => !seen.has(id))]
}

/**
 * Read the current arrangement out of the URL, falling back to the stage
 * default for anything the link does not carry.
 */
export function readSpec(params: RequestsParams, columns: InvoiceColumn[]): SavedViewSpec {
  const stage = readStage(params)
  const base = defaultSpec(stage, columns)
  const known = new Set(columns.map((c) => c.id))
  const visible = parseList(params[SPEC_PARAM.columns])
  const order = parseList(params[SPEC_PARAM.order])
  return {
    stage,
    columns: visible ? visible.filter((id) => known.has(id)) : base.columns,
    columnOrder: reconcileOrder(order ?? base.columnOrder, columns),
    filters: parseJson(params[SPEC_PARAM.filters], base.filters),
    sort: parseJson(params[SPEC_PARAM.sort], base.sort),
  }
}

export function readPage(params: RequestsParams): number {
  const raw = params[SPEC_PARAM.page]
  const parsed = raw ? parseInt(raw, 10) : 1
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

export function readViewId(params: RequestsParams): string | null {
  const raw = params[SPEC_PARAM.view]
  return raw && raw !== '' ? raw : null
}

/**
 * Write an arrangement back into query parameters. Values identical to the
 * stage default are omitted so an untouched screen keeps a clean URL.
 */
export function writeSpec(
  current: URLSearchParams,
  spec: SavedViewSpec,
  columns: InvoiceColumn[],
  options: { viewId?: string | null; page?: number } = {},
): URLSearchParams {
  const next = new URLSearchParams(current.toString())
  const base = defaultSpec(spec.stage, columns)

  next.set(SPEC_PARAM.stage, spec.stage)
  setOrDelete(next, SPEC_PARAM.columns, spec.columns.join(','), base.columns.join(','))
  setOrDelete(next, SPEC_PARAM.order, spec.columnOrder.join(','), base.columnOrder.join(','))
  setOrDelete(next, SPEC_PARAM.filters, JSON.stringify(spec.filters), '[]')
  setOrDelete(next, SPEC_PARAM.sort, JSON.stringify(spec.sort), JSON.stringify(base.sort))

  if (options.viewId) next.set(SPEC_PARAM.view, options.viewId)
  else next.delete(SPEC_PARAM.view)

  const page = options.page ?? 1
  if (page > 1) next.set(SPEC_PARAM.page, String(page))
  else next.delete(SPEC_PARAM.page)

  return next
}

function setOrDelete(params: URLSearchParams, key: string, value: string, fallback: string) {
  if (value === fallback) params.delete(key)
  else params.set(key, value)
}

/** True when two arrangements would produce the same query — used to spot unsaved edits. */
export function specsEqual(a: SavedViewSpec, b: SavedViewSpec): boolean {
  return (
    a.stage === b.stage &&
    a.columns.join(',') === b.columns.join(',') &&
    a.columnOrder.join(',') === b.columnOrder.join(',') &&
    JSON.stringify(a.filters) === JSON.stringify(b.filters) &&
    JSON.stringify(a.sort) === JSON.stringify(b.sort)
  )
}
