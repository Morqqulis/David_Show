import { NextResponse } from 'next/server'
import { toCsv } from '@/backend/lib/csv'
import {
  buildInvoiceSort,
  compileInvoiceFilters,
  resolveInvoiceColumns,
  type InvoiceColumn,
} from '@/backend/lib/invoice-filters'
import {
  fetchInvoicesForExport,
  getColumnFieldDocs,
  type InvoiceListFilters,
} from '@/backend/lib/queries'
import { readSpec, type RequestsParams } from '@/components/app/requests/view-spec-url'
import type { StageId } from '@/backend/lib/stage-ids'

export const dynamic = 'force-dynamic'

type ExportRow = {
  id: string | number
  invoiceNumber?: string
  poNumber?: string
  fiscalYear?: string
  invoiceDate?: string
  dueDate?: string
  subtotal?: number
  totalTax?: number
  grandTotal?: number
  confidential?: boolean
  vendor?: { name?: string } | null
  currentStage?: { label?: string; systemId?: string } | null
  departments?: Array<{ code?: string }> | null
  assignees?: Array<{ name?: string; email?: string }> | null
  batch?: { number?: string } | null
  customFields?: Record<string, unknown> | null
}

/** Dates go out as plain `YYYY-MM-DD` so a spreadsheet reads them as dates. */
function isoDate(value: string | undefined): string {
  if (!value) return ''
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10)
}

function joinList(items: Array<string | undefined> | undefined): string {
  return (items ?? []).filter(Boolean).join('; ')
}

/** One cell, in the same terms the column shows on screen. */
function cellValue(row: ExportRow, column: InvoiceColumn): unknown {
  switch (column.id) {
    case 'invoiceNumber':
      return row.invoiceNumber ?? ''
    case 'vendor':
      return row.vendor?.name ?? ''
    case 'currentStage':
      return row.currentStage?.label ?? row.currentStage?.systemId ?? ''
    case 'departments':
      return joinList(row.departments?.map((d) => d.code))
    case 'assignees':
      return joinList(row.assignees?.map((a) => a.name ?? a.email))
    case 'batch':
      return row.batch?.number ?? ''
    case 'invoiceDate':
      return isoDate(row.invoiceDate)
    case 'dueDate':
      return isoDate(row.dueDate)
    case 'poNumber':
      return row.poNumber ?? ''
    case 'fiscalYear':
      return row.fiscalYear ?? ''
    case 'subtotal':
      return row.subtotal ?? 0
    case 'totalTax':
      return row.totalTax ?? 0
    case 'grandTotal':
      return row.grandTotal ?? 0
    case 'confidential':
      return row.confidential ? 'Yes' : 'No'
    default: {
      const raw = row.customFields?.[column.id]
      if (raw == null) return ''
      if (typeof raw === 'boolean') return raw ? 'Yes' : 'No'
      if (Array.isArray(raw)) return raw.map((v) => String(v)).join('; ')
      if (typeof raw === 'object') return ''
      return raw
    }
  }
}

/**
 * Export CSV — the only export in the app.
 *
 * It answers exactly the question the screen is asking: the same stage, the
 * same search, the same column filters, the same columns in the same order and
 * the same sort. It reads those from the very same query parameters the screen
 * uses and compiles them with the very same compiler, so the file and the
 * screen cannot drift apart. Every matching row is included, not just the page
 * that happened to be loaded.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const params: RequestsParams = Object.fromEntries(url.searchParams.entries())

  const fieldDocs = await getColumnFieldDocs()
  const columns = resolveInvoiceColumns(fieldDocs)
  const spec = readSpec(params, columns)

  const byId = new Map(columns.map((c) => [c.id, c]))
  const visible = spec.columnOrder
    .filter((id) => spec.columns.includes(id))
    .map((id) => byId.get(id))
    .filter((c): c is InvoiceColumn => c !== undefined)

  if (visible.length === 0) {
    console.error('[export/invoices] no columns are visible in the current view', {
      stage: spec.stage,
    })
    return new NextResponse('Turn on at least one column before exporting.', { status: 400 })
  }

  const flag = params.flag
  const docs = (await fetchInvoicesForExport({
    stage: spec.stage as StageId | 'all',
    search: params.q || undefined,
    flags: flag ? ([flag] as InvoiceListFilters['flags']) : undefined,
    columnClauses: compileInvoiceFilters(spec.filters, columns),
    sort: buildInvoiceSort(spec.sort, columns),
  })) as unknown as ExportRow[]

  const csvColumns = visible.map((c) => ({ key: c.id, label: c.label }))
  const rows = docs.map((doc) => {
    const row: Record<string, unknown> = {}
    for (const column of visible) row[column.id] = cellValue(doc, column)
    return row
  })

  const stamp = new Date().toISOString().slice(0, 10)
  const scope = spec.stage === 'all' ? 'all_requests' : spec.stage
  const filename = `aurora_ap_${scope}_${stamp}.csv`

  return new NextResponse(toCsv(rows, csvColumns), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
