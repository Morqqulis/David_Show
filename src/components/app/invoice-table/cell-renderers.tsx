'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'
import { Money } from '../money'
import { StageBadge } from '../stage-badge'
import { formatDate } from '@/backend/lib/formatting'
import { FlagsRow } from './flags-row'
import type { InvoiceRow } from './types'

/**
 * How each column draws itself. Keyed by the same column id the view spec and
 * the filter compiler use, so adding a column is one entry here plus one entry
 * in the column registry — never a change to the table itself.
 */
export const CELL_RENDERERS: Record<string, (row: InvoiceRow) => React.ReactNode> = {
  invoiceNumber: (row) => (
    <div>
      <Link
        href={`/requests/${row.id}`}
        className="font-medium text-foreground hover:text-primary hover:underline"
      >
        {row.invoiceNumber}
      </Link>
      <FlagsRow row={row} />
    </div>
  ),
  vendor: (row) => (
    <div className="flex items-center gap-1.5">
      {row.confidential ? <Lock className="h-3.5 w-3.5 text-amber-600" /> : null}
      <span>{row.vendor?.name ?? '—'}</span>
    </div>
  ),
  currentStage: (row) =>
    row.currentStage ? <StageBadge stage={row.currentStage as never} size="sm" /> : null,
  departments: (row) => row.departments?.map((d) => d.code).join(', ') || '—',
  assignees: (row) =>
    row.assignees && row.assignees.length > 0
      ? row.assignees.map((a) => a.name).filter(Boolean).join(', ')
      : '—',
  batch: (row) => <span className="font-mono text-xs">{row.batch?.number ?? '—'}</span>,
  invoiceDate: (row) => <MutedText>{formatDate(row.invoiceDate)}</MutedText>,
  dueDate: (row) => <MutedText>{formatDate(row.dueDate)}</MutedText>,
  poNumber: (row) => row.poNumber || '—',
  fiscalYear: (row) => row.fiscalYear || '—',
  grandTotal: (row) => <AmountCell value={row.grandTotal} />,
  subtotal: (row) => <AmountCell value={row.subtotal ?? 0} />,
  totalTax: (row) => <AmountCell value={row.totalTax ?? 0} />,
  confidential: (row) => (row.confidential ? 'Yes' : 'No'),
}

/** Columns whose values are money and therefore sit against the right edge. */
export const NUMERIC_COLUMN_IDS = new Set(['grandTotal', 'subtotal', 'totalTax'])

/** Anything an administrator added lives in the invoice's custom values. */
export function renderCustomValue(row: InvoiceRow, columnId: string): React.ReactNode {
  const raw = row.customFields?.[columnId]
  if (raw == null || raw === '') return '—'
  if (typeof raw === 'boolean') return raw ? 'Yes' : 'No'
  if (Array.isArray(raw)) return raw.map((v) => String(v)).join(', ') || '—'
  if (typeof raw === 'object') return '—'
  return String(raw)
}

function MutedText({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-muted-foreground">{children}</span>
}

function AmountCell({ value }: { value: number }) {
  return (
    <div className="text-right font-medium">
      <Money value={value} />
    </div>
  )
}
