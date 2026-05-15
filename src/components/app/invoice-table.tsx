'use client'

import { Fragment, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, ExternalLink, Lock, AlertCircle, Paperclip, FileX, FileWarning } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StageBadge } from './stage-badge'
import { Money } from './money'
import { formatDate } from '@/backend/lib/formatting'
import type { StageId } from '@/backend/lib/stage-ids'
import { usePrefetchInvoice } from '@/hooks/use-ap-queries'

export type InvoiceRow = {
  id: string | number
  invoiceNumber: string
  vendor?: { id?: string | number; name?: string }
  invoiceDate?: string
  dueDate?: string
  grandTotal: number
  currentStage?: { systemId: StageId; label?: string }
  departments?: Array<{ id: string | number; code: string; name: string }>
  assignees?: Array<{ id: string | number; name?: string }>
  batch?: { id: string | number; number: string }
  confidential?: boolean
  flags?: {
    noAttachment?: boolean
    ocrFailed?: boolean
    possibleDuplicate?: boolean
    archiveFailed?: boolean
    vendorSetupRequired?: boolean
  }
  customFields?: Record<string, unknown>
  lines?: Array<InvoiceLineRow>
}

export type InvoiceLineRow = {
  id: string | number
  glAccount?: { code: string; description: string }
  costCenter?: { code: string; description: string }
  amount: number
  taxCode?: { code: string }
  taxAmount: number
  description?: string
}

export function InvoiceTable({
  rows,
  showStageColumn = true,
}: {
  rows: InvoiceRow[]
  showStageColumn?: boolean
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const prefetchInvoice = usePrefetchInvoice()

  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected])
  const allOnPageChecked = rows.length > 0 && rows.every((r) => selected[String(r.id)])

  function toggleAll() {
    if (allOnPageChecked) {
      setSelected({})
    } else {
      const next: Record<string, boolean> = {}
      rows.forEach((r) => (next[String(r.id)] = true))
      setSelected(next)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      {selectedIds.length > 0 ? (
        <div className="flex items-center justify-between border-b border-border bg-primary/5 px-4 py-2 text-sm">
          <span>
            <strong>{selectedIds.length}</strong> selected
          </span>
          <div className="flex items-center gap-2">
            <ActionButton>Bulk Assign</ActionButton>
            <ActionButton>Apply Batch #</ActionButton>
            <ActionButton>Approve</ActionButton>
            <ActionButton>Reassign</ActionButton>
            <ActionButton>Export</ActionButton>
          </div>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="w-8 px-3 py-2">
                <input type="checkbox" checked={allOnPageChecked} onChange={toggleAll} />
              </th>
              <th className="w-8 px-2 py-2"></th>
              <th className="px-3 py-2">Invoice</th>
              <th className="px-3 py-2">Vendor</th>
              {showStageColumn ? <th className="px-3 py-2">Stage</th> : null}
              <th className="px-3 py-2">Department</th>
              <th className="px-3 py-2">Assignee</th>
              <th className="px-3 py-2">Batch</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Due</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="w-10 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={showStageColumn ? 12 : 11} className="py-12 text-center text-muted-foreground">
                  No invoices match the current filter.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const key = String(row.id)
                const isOpen = !!expanded[key]
                return (
                  <Fragment key={key}>
                    <tr
                      onMouseEnter={() => prefetchInvoice(row.id)}
                      className={cn(
                        'hover:bg-muted/30',
                        selected[key] && 'bg-primary/5',
                      )}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={!!selected[key]}
                          onChange={() =>
                            setSelected((s) => ({ ...s, [key]: !s[key] }))
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <button
                          onClick={() => setExpanded((s) => ({ ...s, [key]: !s[key] }))}
                          className="grid h-6 w-6 place-items-center rounded hover:bg-muted"
                          aria-label="Expand"
                        >
                          <ChevronRight
                            className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-90')}
                          />
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          href={`/requests/${row.id}`}
                          className="font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {row.invoiceNumber}
                        </Link>
                        <FlagsRow row={row} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          {row.confidential ? (
                            <Lock className="h-3.5 w-3.5 text-amber-600" />
                          ) : null}
                          <span>{row.vendor?.name ?? '—'}</span>
                        </div>
                      </td>
                      {showStageColumn && (
                        <td className="px-3 py-2">
                          {row.currentStage ? <StageBadge stage={row.currentStage as never} size="sm" /> : null}
                        </td>
                      )}
                      <td className="px-3 py-2">
                        {row.departments?.map((d) => d.code).join(', ') ?? '—'}
                      </td>
                      <td className="px-3 py-2">
                        {row.assignees && row.assignees.length > 0
                          ? row.assignees.map((a) => a.name).join(', ')
                          : '—'}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {row.batch?.number ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(row.invoiceDate)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(row.dueDate)}</td>
                      <td className="px-3 py-2 text-right font-medium">
                        <Money value={row.grandTotal} />
                      </td>
                      <td className="px-2 py-2">
                        <Link
                          href={`/requests/${row.id}`}
                          className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label="Open"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr>
                        <td colSpan={showStageColumn ? 12 : 11} className="bg-muted/20 px-6 py-4">
                          <InlineDetail row={row} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FlagsRow({ row }: { row: InvoiceRow }) {
  const flags = row.flags ?? {}
  const items: Array<{ icon: React.ReactNode; label: string; tone: string }> = []
  if (flags.archiveFailed) items.push({ icon: <FileX className="h-3 w-3" />, label: 'Archive failed', tone: 'red' })
  if (flags.ocrFailed) items.push({ icon: <FileWarning className="h-3 w-3" />, label: 'OCR failed', tone: 'amber' })
  if (flags.noAttachment) items.push({ icon: <Paperclip className="h-3 w-3" />, label: 'No attachment', tone: 'amber' })
  if (flags.possibleDuplicate) items.push({ icon: <AlertCircle className="h-3 w-3" />, label: 'Possible duplicate', tone: 'amber' })
  if (flags.vendorSetupRequired) items.push({ icon: <AlertCircle className="h-3 w-3" />, label: 'Vendor setup required', tone: 'amber' })
  if (items.length === 0) return null
  return (
    <div className="mt-0.5 flex flex-wrap gap-1">
      {items.map((it, i) => (
        <span
          key={i}
          className={cn(
            'inline-flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-medium',
            it.tone === 'red'
              ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
              : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
          )}
        >
          {it.icon}
          {it.label}
        </span>
      ))}
    </div>
  )
}

function InlineDetail({ row }: { row: InvoiceRow }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-md border border-border bg-background">
        <div className="border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Invoice preview
        </div>
        <div className="grid h-64 place-items-center bg-[repeating-linear-gradient(45deg,#f8fafc,#f8fafc_10px,#f1f5f9_10px,#f1f5f9_20px)] text-xs text-muted-foreground">
          PDF preview placeholder — {row.invoiceNumber}
        </div>
      </div>
      <div className="rounded-md border border-border bg-background">
        <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span>Coded lines</span>
          <Link href={`/requests/${row.id}/coding`} className="text-[11px] text-primary hover:underline">
            Open coding ↗
          </Link>
        </div>
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">GL</th>
              <th className="px-2 py-1.5 text-left font-medium">Cost Ctr</th>
              <th className="px-2 py-1.5 text-right font-medium">Amount</th>
              <th className="px-2 py-1.5 text-left font-medium">Tax</th>
              <th className="px-2 py-1.5 text-right font-medium">Tax $</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(row.lines ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-center text-muted-foreground">No lines coded yet.</td>
              </tr>
            ) : (
              row.lines!.map((l) => (
                <tr key={String(l.id)}>
                  <td className="px-2 py-1.5 font-mono">{l.glAccount?.code ?? '—'}</td>
                  <td className="px-2 py-1.5 font-mono">{l.costCenter?.code ?? '—'}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{l.amount.toFixed(2)}</td>
                  <td className="px-2 py-1.5 font-mono">{l.taxCode?.code ?? '—'}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{l.taxAmount.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ActionButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted">
      {children}
    </button>
  )
}
