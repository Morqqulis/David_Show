'use client'

import { useState, useTransition } from 'react'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Money } from '../../money'
import { OcrLegend, OcrValue } from '../../ocr-value'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/backend/lib/formatting'
import { updateInvoiceAmounts, type InvoiceAmounts } from '@/backend/actions/invoice'
import type { InvoiceViewInvoice } from '../types'

const SAVE_TOAST_ID = 'invoice-amounts-save'

/**
 * Invoices that arrived by email carry two extra pieces of information the
 * shared view type does not name yet: which header values were read off the
 * scan, and where the email came from. Both are present on the document the
 * page loads, so they are read through a local widening rather than by
 * reshaping a type several other screens share.
 */
type EmailedInvoice = InvoiceViewInvoice & {
  ocrFields?: string[] | null
  intake?: {
    sender?: string | null
    subject?: string | null
    receivedAt?: string | null
    amountMismatch?: boolean | null
    amountDifference?: number | null
  } | null
}

export function HeaderTab({ inv }: { inv: InvoiceViewInvoice }) {
  const emailed = inv as EmailedInvoice
  // A value counts as read from the invoice only until somebody corrects it;
  // the amount editor below clears its own marks on save for that reason.
  const [extracted, setExtracted] = useState<Set<string>>(
    () => new Set(Array.isArray(emailed.ocrFields) ? emailed.ocrFields : []),
  )
  const intake = emailed.intake ?? null
  // The three amounts are the vendor's own figures, and the coding lines are
  // checked against them — so they have to be correctable in place when a scan
  // was misread. Everything else on this tab stays read-only.
  const [amounts, setAmounts] = useState<InvoiceAmounts>({
    subtotal: inv.subtotal,
    totalTax: inv.totalTax,
    grandTotal: inv.grandTotal,
  })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<keyof InvoiceAmounts, string>>({
    subtotal: String(inv.subtotal),
    totalTax: String(inv.totalTax),
    grandTotal: String(inv.grandTotal),
  })
  const [isSaving, startSaving] = useTransition()

  function beginEdit() {
    setDraft({
      subtotal: String(amounts.subtotal),
      totalTax: String(amounts.totalTax),
      grandTotal: String(amounts.grandTotal),
    })
    setEditing(true)
  }

  function save() {
    const parsed: InvoiceAmounts = {
      subtotal: Number(draft.subtotal),
      totalTax: Number(draft.totalTax),
      grandTotal: Number(draft.grandTotal),
    }
    if (Object.values(parsed).some((n) => !Number.isFinite(n))) {
      toast.error('Enter a number in each amount.', { id: SAVE_TOAST_ID })
      return
    }

    const previous = amounts
    setAmounts(parsed)
    setEditing(false)

    startSaving(async () => {
      try {
        const saved = await updateInvoiceAmounts(inv.id, parsed)
        setAmounts(saved)
        // A person has now checked these figures against the document, so they
        // stop being machine readings and the marks come off.
        setExtracted((cur) => {
          const next = new Set(cur)
          for (const field of ['subtotal', 'totalTax', 'grandTotal']) next.delete(field)
          return next
        })
        toast.success('Amounts updated', { id: SAVE_TOAST_ID, duration: 1500 })
      } catch (err) {
        setAmounts(previous)
        console.error('[invoice-header] amount save failed', { invoiceId: inv.id, parsed, err })
        toast.error(err instanceof Error ? err.message : 'Could not save — change rolled back', {
          id: SAVE_TOAST_ID,
        })
      }
    })
  }

  const rows: Array<{ label: string; field?: string; value: React.ReactNode }> = [
    { label: 'Invoice #', field: 'invoiceNumber', value: inv.invoiceNumber },
    { label: 'PO #', field: 'poNumber', value: inv.poNumber ?? '—' },
    { label: 'Vendor', field: 'vendorName', value: inv.vendor?.name ?? '—' },
    { label: 'Vendor #', value: inv.vendor?.vendorNumber ?? '—' },
    { label: 'Invoice Date', field: 'invoiceDate', value: formatDate(inv.invoiceDate) },
    { label: 'Due Date', field: 'dueDate', value: formatDate(inv.dueDate) },
    { label: 'Fiscal Year', field: 'fiscalYear', value: inv.fiscalYear ?? '—' },
    { label: 'Departments', value: inv.departments?.map((d) => d.name).join(', ') || '—' },
    { label: 'Assignees', value: inv.assignees?.map((a) => a.name).join(', ') || '—' },
    { label: 'Batch #', value: inv.batch?.number ?? '—' },
    { label: 'Priority', field: 'priority', value: (inv.customFields?.priority as string) ?? '—' },
  ]

  const markedCount = rows.filter((f) => f.field && extracted.has(f.field)).length

  return (
    <div className="space-y-5">
      {intake?.sender ? (
        <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
          <p>
            Emailed in by <span className="font-medium">{intake.sender}</span>
            {intake.receivedAt ? ` on ${formatDate(intake.receivedAt)}` : ''}
            {intake.subject ? ` — “${intake.subject}”` : ''}
          </p>
          {intake.amountMismatch ? (
            <p className="mt-1.5 text-amber-800">
              The amounts on this invoice do not add up: the amount before taxes plus the tax is{' '}
              <Money value={intake.amountDifference ?? 0} /> away from the total. Check the figures against
              the document before approving.
            </p>
          ) : null}
        </div>
      ) : null}

      <OcrLegend count={markedCount} />

      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map((f) => (
          <div
            key={f.label}
            className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1.5"
          >
            <span className="text-xs text-muted-foreground">{f.label}</span>
            <span className="text-sm font-medium">
              <OcrValue extracted={Boolean(f.field && extracted.has(f.field))}>{f.value}</OcrValue>
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-md border border-border bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Amounts on the invoice
          </span>
          {editing ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button size="sm" onClick={save} disabled={isSaving}>
                Save
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={beginEdit}>
              <Pencil className="h-3.5 w-3.5" />
              Correct amounts
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <AmountRow
            label="Amount Before Taxes"
            editing={editing}
            extracted={extracted.has('subtotal')}
            value={amounts.subtotal}
            draft={draft.subtotal}
            onDraft={(v) => setDraft((d) => ({ ...d, subtotal: v }))}
          />
          <AmountRow
            label="Total Tax Amount"
            editing={editing}
            extracted={extracted.has('totalTax')}
            value={amounts.totalTax}
            draft={draft.totalTax}
            onDraft={(v) => setDraft((d) => ({ ...d, totalTax: v }))}
          />
          <AmountRow
            label="Invoice Total"
            editing={editing}
            extracted={extracted.has('grandTotal')}
            value={amounts.grandTotal}
            draft={draft.grandTotal}
            onDraft={(v) => setDraft((d) => ({ ...d, grandTotal: v }))}
            emphasis
          />
        </div>

        {editing ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Enter the figures exactly as they appear on the vendor&apos;s invoice. The coding lines
            are checked against Amount Before Taxes.
          </p>
        ) : null}
      </div>
    </div>
  )
}

function AmountRow({
  label,
  editing,
  extracted,
  value,
  draft,
  onDraft,
  emphasis,
}: {
  label: string
  editing: boolean
  extracted: boolean
  value: number
  draft: string
  onDraft: (value: string) => void
  emphasis?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {editing ? (
        <Input
          type="number"
          step="0.01"
          min="0"
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          className="h-8 w-32 text-right text-sm"
          aria-label={label}
        />
      ) : (
        <OcrValue extracted={extracted}>
          <Money value={value} className={emphasis ? 'font-semibold' : undefined} />
        </OcrValue>
      )}
    </div>
  )
}
