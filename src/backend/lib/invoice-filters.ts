/**
 * Pure column-filter compiler for the All Requests table.
 *
 * Dependency-free on purpose (no `server-only`, no Payload, no React): the
 * screen query, the per-stage counts and the CSV export all compile their
 * filters here, so exported rows can never drift from the rows the clerk is
 * looking at. It also means the compiler is directly unit-testable.
 *
 * Combination rule fixed by the spec: AND across columns, OR within a column.
 */

export type ColumnFilterKind = 'text' | 'choice' | 'user' | 'boolean' | 'date' | 'number'

/** One column's filter. `values` are OR-ed; `from`/`to` are an inclusive range. */
export type ColumnFilterSpec = {
  columnId: string
  values?: string[]
  from?: string
  to?: string
}

/** What a saved view captures. Round-trips through JSON unchanged. */
export type SavedViewSpec = {
  /** Stage systemId, or 'all'. Stage is a filter dimension inside the view. */
  stage: string
  /** Visible column ids, in display order. */
  columns: string[]
  /** Full column order including hidden columns, so unhiding restores position. */
  columnOrder: string[]
  filters: ColumnFilterSpec[]
  sort: Array<{ id: string; desc: boolean }>
}

export type InvoiceColumn = {
  id: string
  label: string
  kind: ColumnFilterKind
  /** Path used in the Payload `where` object. */
  wherePath: string
  /** Payload `sort` key. Absent when the column cannot be ordered in SQL. */
  sortKey?: string
  /** Value lives inside the `customFields` jsonb blob rather than its own column. */
  json: boolean
  /** Shown by default when the user has not chosen their own column set. */
  defaultVisible: boolean
  /** Fixed choices offered by the filter control. */
  options?: string[]
}

/**
 * Columns backed by real invoice columns. Keyed by the same `fieldKey` the
 * Fields collection uses, so a Field record with "Show as column" on lines up
 * with its built-in column instead of creating a duplicate.
 */
export const BUILTIN_INVOICE_COLUMNS: InvoiceColumn[] = [
  { id: 'invoiceNumber', label: 'Invoice', kind: 'text', wherePath: 'invoiceNumber', sortKey: 'invoiceNumber', json: false, defaultVisible: true },
  { id: 'vendor', label: 'Vendor', kind: 'text', wherePath: 'vendor.name', sortKey: 'vendor.name', json: false, defaultVisible: true },
  { id: 'currentStage', label: 'Stage', kind: 'choice', wherePath: 'currentStage.systemId', sortKey: 'currentStage.order', json: false, defaultVisible: true },
  { id: 'departments', label: 'Department', kind: 'choice', wherePath: 'departments.code', json: false, defaultVisible: true },
  { id: 'assignees', label: 'Assignee', kind: 'user', wherePath: 'assignees', json: false, defaultVisible: true },
  { id: 'batch', label: 'Batch', kind: 'text', wherePath: 'batch.number', sortKey: 'batch.number', json: false, defaultVisible: true },
  { id: 'invoiceDate', label: 'Date', kind: 'date', wherePath: 'invoiceDate', sortKey: 'invoiceDate', json: false, defaultVisible: true },
  { id: 'dueDate', label: 'Due', kind: 'date', wherePath: 'dueDate', sortKey: 'dueDate', json: false, defaultVisible: true },
  { id: 'grandTotal', label: 'Amount', kind: 'number', wherePath: 'grandTotal', sortKey: 'grandTotal', json: false, defaultVisible: true },
  { id: 'poNumber', label: 'PO Number', kind: 'text', wherePath: 'poNumber', sortKey: 'poNumber', json: false, defaultVisible: false },
  { id: 'fiscalYear', label: 'Fiscal Year', kind: 'text', wherePath: 'fiscalYear', sortKey: 'fiscalYear', json: false, defaultVisible: false },
  { id: 'subtotal', label: 'Subtotal', kind: 'number', wherePath: 'subtotal', sortKey: 'subtotal', json: false, defaultVisible: false },
  { id: 'totalTax', label: 'Total Tax', kind: 'number', wherePath: 'totalTax', sortKey: 'totalTax', json: false, defaultVisible: false },
  { id: 'confidential', label: 'Confidential', kind: 'boolean', wherePath: 'confidential', sortKey: 'confidential', json: false, defaultVisible: false },
]

/** The subset of a Fields record this module needs. */
export type ColumnFieldDoc = {
  fieldKey: string
  label: string
  scope?: string
  type?: string
  showAsColumn?: boolean | null
  options?: Array<{ value: string }> | null
}

/**
 * Payload's Postgres adapter compiles jsonb paths to `jsonb_path_exists`, which
 * only understands equality-style operators. A custom date/number field
 * therefore gets a text match rather than a range — a working control instead
 * of one that errors at the database.
 */
function kindForCustomField(type: string | undefined): ColumnFilterKind {
  if (type === 'choice' || type === 'multiselect') return 'choice'
  if (type === 'yesno') return 'boolean'
  return 'text'
}

/**
 * Every column the View picker may offer: the built-in registry plus each
 * header field an administrator flagged "Show as column on All Requests".
 * The flag decides default visibility for custom fields; built-ins keep the
 * column set the table has always shown so nothing disappears on upgrade.
 */
export function resolveInvoiceColumns(fields: ColumnFieldDoc[]): InvoiceColumn[] {
  const labelOverrides = new Map<string, string>()
  const custom: InvoiceColumn[] = []
  const builtinIds = new Set(BUILTIN_INVOICE_COLUMNS.map((c) => c.id))

  for (const field of fields) {
    if (field.scope && field.scope !== 'header') continue
    if (builtinIds.has(field.fieldKey)) {
      if (field.label) labelOverrides.set(field.fieldKey, field.label)
      continue
    }
    if (!field.showAsColumn) continue
    custom.push({
      id: field.fieldKey,
      label: field.label || field.fieldKey,
      kind: kindForCustomField(field.type),
      wherePath: `customFields.${field.fieldKey}`,
      json: true,
      defaultVisible: true,
      options: field.options?.map((o) => o.value).filter(Boolean),
    })
  }

  const builtins = BUILTIN_INVOICE_COLUMNS.map((c) => ({
    ...c,
    label: labelOverrides.get(c.id) ?? c.label,
  }))
  return [...builtins, ...custom]
}

/** Characters Payload accepts inside a jsonb query value. */
const JSON_SAFE = /[^\w @.\-+:]/g

/** Strip what the database layer would reject outright on a jsonb path. */
export function sanitizeJsonFilterValue(raw: string): string {
  return raw.replace(JSON_SAFE, '')
}

function normaliseValues(column: InvoiceColumn, values: string[] | undefined): string[] {
  if (!Array.isArray(values)) return []
  const out: string[] = []
  for (const raw of values) {
    if (typeof raw !== 'string') continue
    const cleaned = (column.json ? sanitizeJsonFilterValue(raw) : raw).trim()
    if (cleaned && !out.includes(cleaned)) out.push(cleaned)
  }
  return out
}

function coerceValue(column: InvoiceColumn, value: string): string | number {
  if (column.json) return value
  return /^\d+$/.test(value) ? Number(value) : value
}

/** `YYYY-MM-DD` bounds are widened to cover the whole local day. */
function dateBound(raw: string | undefined, edge: 'start' | 'end'): string | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null
  const value = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return edge === 'start' ? `${value}T00:00:00.000Z` : `${value}T23:59:59.999Z`
  }
  return Number.isNaN(Date.parse(value)) ? null : value
}

function numberBound(raw: string | undefined): number | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function compileRange(column: InvoiceColumn, filter: ColumnFilterSpec): Record<string, unknown> | null {
  const from = column.kind === 'number' ? numberBound(filter.from) : dateBound(filter.from, 'start')
  const to = column.kind === 'number' ? numberBound(filter.to) : dateBound(filter.to, 'end')
  const bounds: Record<string, unknown>[] = []
  if (from !== null) bounds.push({ [column.wherePath]: { greater_than_equal: from } })
  if (to !== null) bounds.push({ [column.wherePath]: { less_than_equal: to } })
  if (bounds.length === 0) return null
  return bounds.length === 1 ? bounds[0] : { and: bounds }
}

function compileColumn(column: InvoiceColumn, filter: ColumnFilterSpec): Record<string, unknown> | null {
  if ((column.kind === 'date' || column.kind === 'number') && !column.json) {
    return compileRange(column, filter)
  }
  const values = normaliseValues(column, filter.values)
  if (values.length === 0) return null
  if (column.kind === 'boolean') {
    return { or: values.map((v) => ({ [column.wherePath]: { equals: v === 'true' } })) }
  }
  if (column.kind === 'text') {
    return { or: values.map((v) => ({ [column.wherePath]: { like: v } })) }
  }
  return { or: values.map((v) => ({ [column.wherePath]: { equals: coerceValue(column, v) } })) }
}

/**
 * Compile column filters into Payload `where` clauses meant to be spread into
 * an `and: [...]` array. Filters naming a column that no longer exists are
 * dropped: a saved view that outlived a deleted field still opens.
 */
export function compileInvoiceFilters(
  filters: ColumnFilterSpec[] | undefined,
  columns: InvoiceColumn[],
): Record<string, unknown>[] {
  const byId = new Map(columns.map((c) => [c.id, c]))
  const clauses: Record<string, unknown>[] = []
  for (const filter of filters ?? []) {
    if (!filter || typeof filter.columnId !== 'string') continue
    const column = byId.get(filter.columnId)
    if (!column) continue
    const clause = compileColumn(column, filter)
    if (clause) clauses.push(clause)
  }
  return clauses
}

/** Default ordering when the view carries no sort of its own. */
export const DEFAULT_INVOICE_SORT = '-updatedAt'

/** Translate a view's sort into Payload `sort` keys, dropping unsortable columns. */
export function buildInvoiceSort(
  sort: Array<{ id: string; desc: boolean }> | undefined,
  columns: InvoiceColumn[],
): string[] {
  const byId = new Map(columns.map((c) => [c.id, c]))
  const keys: string[] = []
  for (const entry of sort ?? []) {
    const sortKey = byId.get(entry?.id)?.sortKey
    if (!sortKey) continue
    keys.push(entry.desc ? `-${sortKey}` : sortKey)
  }
  return keys.length > 0 ? keys : [DEFAULT_INVOICE_SORT]
}

/**
 * Views a single person may keep. Beyond this the dropdown stops being a
 * shortcut.
 *
 * Lives here rather than beside the save action because a `'use server'` file
 * may only export async functions — exporting a constant from one is a build
 * error that no type check catches, and it took the whole app down once.
 */
export const SAVED_VIEW_LIMIT = 10
