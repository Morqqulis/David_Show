import { NextResponse } from 'next/server'
import { getPayload } from '@/backend/lib/payload'
import { listInvoices } from '@/backend/lib/queries'
import { csvEscape, toCsv } from '@/backend/lib/csv'
import type { StageId } from '@/backend/lib/stage-ids'

export const dynamic = 'force-dynamic'

type FieldDoc = {
  id: string | number
  fieldKey: string
  label: string
  scope: 'header' | 'line'
  exportable?: boolean
}

type LineDoc = {
  id: string | number
  order: number
  glAccount?: { code?: string; description?: string } | null
  costCenter?: { code?: string; description?: string } | null
  project?: { code?: string; description?: string } | null
  fund?: { code?: string; description?: string } | null
  amount: number
  taxCode?: { code?: string } | null
  taxAmount: number
  recoverable: number
  nonRecoverable: number
  description?: string
  customLineFields?: Record<string, unknown>
}

type InvoiceDoc = {
  id: string | number
  invoiceNumber: string
  vendor?: { vendorNumber?: string; name?: string } | null
  invoiceDate?: string
  dueDate?: string
  fiscalYear?: string
  poNumber?: string
  subtotal: number
  totalTax: number
  grandTotal: number
  currentStage?: { systemId?: string; label?: string }
  departments?: Array<{ code?: string; name?: string }>
  assignees?: Array<{ name?: string; email?: string }>
  batch?: { number?: string }
  confidential?: boolean
  customFields?: Record<string, unknown>
  lines?: LineDoc[]
}

function getHeaderValue(inv: InvoiceDoc, fieldKey: string): unknown {
  switch (fieldKey) {
    case 'invoiceNumber':
      return inv.invoiceNumber
    case 'vendor':
      return inv.vendor?.name ?? ''
    case 'vendorNumber':
      return inv.vendor?.vendorNumber ?? ''
    case 'invoiceDate':
      return inv.invoiceDate ?? ''
    case 'dueDate':
      return inv.dueDate ?? ''
    case 'fiscalYear':
      return inv.fiscalYear ?? ''
    case 'poNumber':
      return inv.poNumber ?? ''
    case 'subtotal':
      return inv.subtotal
    case 'totalTax':
      return inv.totalTax
    case 'grandTotal':
      return inv.grandTotal
    case 'currentStage':
      return inv.currentStage?.label ?? inv.currentStage?.systemId ?? ''
    case 'departments':
      return (inv.departments ?? []).map((d) => d.code).join('; ')
    case 'assignees':
      return (inv.assignees ?? []).map((a) => a.name).join('; ')
    case 'batch':
      return inv.batch?.number ?? ''
    case 'confidential':
      return inv.confidential ? 'Yes' : 'No'
    default:
      return inv.customFields?.[fieldKey] ?? ''
  }
}

function getLineValue(line: LineDoc, fieldKey: string): unknown {
  switch (fieldKey) {
    case 'glAccount':
      return line.glAccount?.code ?? ''
    case 'glAccountDescription':
      return line.glAccount?.description ?? ''
    case 'costCenter':
      return line.costCenter?.code ?? ''
    case 'project':
      return line.project?.code ?? ''
    case 'fund':
      return line.fund?.code ?? ''
    case 'amount':
      return line.amount
    case 'taxCode':
      return line.taxCode?.code ?? ''
    case 'taxAmount':
      return line.taxAmount
    case 'recoverable':
      return line.recoverable
    case 'nonRecoverable':
      return line.nonRecoverable
    case 'description':
      return line.description ?? ''
    default:
      return line.customLineFields?.[fieldKey] ?? ''
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const stage = (url.searchParams.get('stage') as StageId | 'all' | null) ?? undefined
  const search = url.searchParams.get('q') ?? undefined
  const vendor = url.searchParams.get('vendor') ?? undefined
  const batch = url.searchParams.get('batch') ?? undefined
  const flag = url.searchParams.get('flag') ?? undefined

  const payload = await getPayload()

  // Pull exportable fields (header + line) — order: header first, then lines.
  const fieldsRes = await payload.find({
    collection: 'fields',
    where: { exportable: { equals: true } } as never,
    sort: 'order',
    limit: 200,
    depth: 0,
  })
  const fields = fieldsRes.docs as FieldDoc[]
  const headerFields = fields.filter((f) => f.scope === 'header')
  const lineFields = fields.filter((f) => f.scope === 'line')

  // System columns we always want even if no Field record exists.
  const fallbackHeader: FieldDoc[] =
    headerFields.length === 0
      ? [
          { id: 'h1', fieldKey: 'invoiceNumber', label: 'Invoice #', scope: 'header' },
          { id: 'h2', fieldKey: 'vendor', label: 'Vendor', scope: 'header' },
          { id: 'h3', fieldKey: 'invoiceDate', label: 'Invoice Date', scope: 'header' },
          { id: 'h4', fieldKey: 'grandTotal', label: 'Grand Total', scope: 'header' },
          { id: 'h5', fieldKey: 'batch', label: 'Batch #', scope: 'header' },
          { id: 'h6', fieldKey: 'currentStage', label: 'Stage', scope: 'header' },
        ]
      : headerFields
  const fallbackLine: FieldDoc[] =
    lineFields.length === 0
      ? [
          { id: 'l1', fieldKey: 'glAccount', label: 'GL Account', scope: 'line' },
          { id: 'l2', fieldKey: 'costCenter', label: 'Cost Center', scope: 'line' },
          { id: 'l3', fieldKey: 'amount', label: 'Amount', scope: 'line' },
          { id: 'l4', fieldKey: 'taxCode', label: 'Tax Code', scope: 'line' },
          { id: 'l5', fieldKey: 'taxAmount', label: 'Tax $', scope: 'line' },
          { id: 'l6', fieldKey: 'recoverable', label: 'Recoverable $', scope: 'line' },
          { id: 'l7', fieldKey: 'nonRecoverable', label: 'Non-Recoverable $', scope: 'line' },
        ]
      : lineFields

  const headerCols = fallbackHeader
  const lineCols = fallbackLine

  // Pull invoices with the same filters as the UI list view.
  const list = await listInvoices({
    stage: stage === 'all' ? undefined : (stage as StageId | undefined),
    search,
    vendor: vendor ?? undefined,
    batch: batch ?? undefined,
    flags: flag ? ([flag] as never) : undefined,
    pageSize: 1000,
  })

  const invoices = list.docs as unknown as InvoiceDoc[]

  // Build columns: line# + all header fields + all line fields
  const columns: Array<{ key: string; label: string }> = [
    { key: '__line', label: 'Line #' },
    ...headerCols.map((f) => ({ key: `h:${f.fieldKey}`, label: f.label })),
    ...lineCols.map((f) => ({ key: `l:${f.fieldKey}`, label: f.label })),
  ]

  const rows: Array<Record<string, unknown>> = []
  for (const inv of invoices) {
    const lines = inv.lines ?? []
    if (lines.length === 0) {
      const row: Record<string, unknown> = { __line: 0 }
      for (const f of headerCols) row[`h:${f.fieldKey}`] = getHeaderValue(inv, f.fieldKey)
      for (const f of lineCols) row[`l:${f.fieldKey}`] = ''
      rows.push(row)
      continue
    }
    for (const line of lines) {
      const row: Record<string, unknown> = { __line: line.order }
      for (const f of headerCols) row[`h:${f.fieldKey}`] = getHeaderValue(inv, f.fieldKey)
      for (const f of lineCols) row[`l:${f.fieldKey}`] = getLineValue(line, f.fieldKey)
      rows.push(row)
    }
  }

  const csv = toCsv(rows, columns)
  const stamp = new Date().toISOString().slice(0, 10)
  const batchStamp = batch ? `_${batch}` : stage && stage !== 'all' ? `_${stage}` : ''
  const filename = `aurora_ap_export_${stamp}${batchStamp}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
