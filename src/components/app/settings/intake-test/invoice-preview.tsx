'use client'

import Link from 'next/link'
import { AlertTriangle, CheckCircle2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { IntakeTestReport } from '@/backend/actions/intake-test-actions'
import { Step, formatDay, formatMoney } from './step'

/** Plain wording for each mark an invoice can carry out of intake. */
const FLAG_WORDING: Array<{ key: string; text: string }> = [
  { key: 'noAttachment', text: 'No document attached' },
  { key: 'ocrFailed', text: 'The document could not be read — every detail needs typing in' },
  { key: 'vendorSetupRequired', text: 'The supplier is not in your list yet and needs adding' },
  { key: 'possibleDuplicate', text: 'This may be the same invoice arriving twice' },
  { key: 'amountMismatch', text: 'The amounts do not add up' },
]

export function InvoicePreview({
  report,
  busy,
  disabled,
  onCreate,
}: {
  report: IntakeTestReport
  busy: boolean
  disabled: boolean
  onCreate: () => void
}) {
  const unit = report.trace.units[0]
  const created = report.outcome.invoices[0]

  if (!unit || unit.blockedReason) {
    return (
      <Step number={6} title="What would be created">
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
          Nothing. {unit?.blockedReason ?? 'This document did not produce an invoice.'}
        </p>
      </Step>
    )
  }

  const draft = unit.draft
  if (!draft) {
    return (
      <Step number={6} title="What would be created">
        <p>No invoice could be prepared from this document.</p>
      </Step>
    )
  }

  const marks = FLAG_WORDING.filter((f) => draft.flags[f.key as keyof typeof draft.flags])

  return (
    <Step number={6} title={report.committed ? 'What was created' : 'What would be created'}>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <Line label="Invoice number" value={draft.invoiceNumber} />
        <Line
          label="Supplier"
          value={report.matchedVendorName ?? 'Left blank for you to pick'}
          muted={report.matchedVendorName === null}
        />
        <Line label="Invoice date" value={formatDay(draft.invoiceDate)} />
        <Line label="Due date" value={formatDay(draft.dueDate)} />
        <Line label="Purchase order number" value={draft.poNumber || '—'} />
        <Line label="Amount before taxes" value={formatMoney(draft.subtotal)} />
        <Line label="Total tax" value={formatMoney(draft.totalTax)} />
        <Line label="Invoice total" value={formatMoney(draft.grandTotal)} />
        <Line label="Goes to" value="To Be Assigned" />
        <Line
          label="Document attached"
          value={draft.flags.noAttachment ? 'None' : report.file.name}
        />
      </dl>

      {marks.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-1.5 pb-1 text-xs font-medium text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5" /> Whoever picks this up would see
          </p>
          <ul className="space-y-0.5 text-xs text-amber-900">
            {marks.map((mark) => (
              <li key={mark.key}>· {mark.text}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.committed && created ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            Created. Invoice <strong>{created.invoiceNumber}</strong> is now in To Be Assigned, with the
            document attached and a note in its history saying it came in this way.
          </span>
          <Button asChild size="sm" variant="outline">
            <Link href={`/requests/${created.id}`}>Open it</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-sm">
            <strong>Nothing has been saved.</strong> No invoice, no document and no history entry were
            added — everything above was worked out and then thrown away. Press the button below if you
            want this invoice created for real.
          </p>
          <Button onClick={onCreate} disabled={disabled}>
            {busy ? <Spinner className="mr-1.5 h-3.5 w-3.5" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
            Create this invoice for real
          </Button>
        </div>
      )}
    </Step>
  )
}

function Line({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b py-1 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={muted ? 'text-right text-muted-foreground' : 'text-right font-medium'}>{value}</dd>
    </div>
  )
}
