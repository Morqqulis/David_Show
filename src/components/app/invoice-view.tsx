'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PanelLeftClose, PanelLeftOpen, Check, X, UserPlus, Send, Lock, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StageBadge } from './stage-badge'
import { Money } from './money'
import { formatDate, formatRelative, initials } from '@/backend/lib/formatting'
import type { StageId } from '@/backend/lib/stage-ids'
import { STAGE_LABELS, STAGE_ORDER } from '@/backend/lib/stage-ids'
import {
  approveInvoice,
  rejectInvoice,
  postComment,
  verifyInvoice,
  setConfidential,
  softDeleteInvoice,
} from '@/backend/actions/invoice-actions'

export type InvoiceViewData = {
  invoice: {
    id: string | number
    invoiceNumber: string
    poNumber?: string
    invoiceDate?: string
    dueDate?: string
    fiscalYear?: string
    subtotal: number
    totalTax: number
    grandTotal: number
    confidential?: boolean
    verified?: boolean
    currentStage?: { systemId: StageId; label?: string }
    vendor?: { id: string | number; name: string; vendorNumber?: string; city?: string; province?: string }
    departments?: Array<{ id: string | number; code: string; name: string }>
    assignees?: Array<{ id: string | number; name?: string; email?: string }>
    batch?: { id: string | number; number: string }
    customFields?: Record<string, unknown>
    flags?: Record<string, unknown>
  }
  lines: Array<{
    id: string | number
    glAccount?: { code: string; description: string }
    costCenter?: { code: string; description: string }
    amount: number
    taxCode?: { code: string }
    taxAmount: number
    recoverable: number
    nonRecoverable: number
    description?: string
  }>
  comments: Array<{
    id: string | number
    body: string
    createdAt: string
    author?: { name?: string }
  }>
  audit: Array<{ id: string | number; action: string; createdAt: string; actor?: { name?: string }; context?: Record<string, unknown> }>
  defaultTab?: 'header' | 'coding' | 'files' | 'notes' | 'log'
}

export function InvoiceView({ data }: { data: InvoiceViewData }) {
  const router = useRouter()
  const [previewCollapsed, setPreviewCollapsed] = useState(false)
  const [tab, setTab] = useState<string>(data.defaultTab ?? 'header')
  const [isPending, startTransition] = useTransition()

  const inv = data.invoice
  const currentStage = (inv.currentStage?.systemId ?? 'to_be_assigned') as StageId

  const onApprove = () =>
    startTransition(async () => {
      try {
        await approveInvoice(inv.id)
        toast.success('Approved — advanced to next stage')
        router.refresh()
      } catch (e) {
        toast.error((e as Error).message)
      }
    })

  const onReject = (target: StageId, reason: string) =>
    startTransition(async () => {
      try {
        await rejectInvoice(inv.id, target, reason)
        toast.success(`Rejected back to ${STAGE_LABELS[target]}`)
        router.refresh()
      } catch (e) {
        toast.error((e as Error).message)
      }
    })

  const onVerify = (v: boolean) =>
    startTransition(async () => {
      await verifyInvoice(inv.id, v)
      toast.success(v ? 'Marked verified' : 'Verification cleared')
      router.refresh()
    })

  const onToggleConfidential = () =>
    startTransition(async () => {
      await setConfidential(inv.id, !inv.confidential)
      toast.success(inv.confidential ? 'Confidential flag cleared' : 'Marked confidential')
      router.refresh()
    })

  const onSoftDelete = () => {
    const reason = window.prompt('Reason for delete?')
    if (!reason) return
    startTransition(async () => {
      await softDeleteInvoice(inv.id, reason)
      toast.success('Invoice moved to Trash')
      router.push('/requests')
    })
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">{inv.invoiceNumber}</h1>
          {inv.currentStage ? <StageBadge stage={inv.currentStage as never} /> : null}
          {inv.confidential ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
              <Lock className="h-3 w-3" /> Confidential
            </span>
          ) : null}
          {inv.verified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-800 ring-1 ring-inset ring-green-200">
              <Check className="h-3 w-3" /> Verified
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            Vendor: <span className="font-medium text-foreground">{inv.vendor?.name ?? '—'}</span>
          </span>
          <span className="text-border">|</span>
          <span>
            Date: <span className="font-medium text-foreground">{formatDate(inv.invoiceDate)}</span>
          </span>
          <span className="text-border">|</span>
          <span>
            Total: <Money value={inv.grandTotal} className="font-semibold text-foreground" />
          </span>
        </div>
      </div>

      {/* Stepper */}
      <WorkflowStepperClient currentStage={currentStage} />

      {/* Split view */}
      <div className={cn('grid flex-1 gap-3 overflow-hidden', previewCollapsed ? 'grid-cols-[44px_1fr]' : 'grid-cols-[1.4fr_1fr]')}>
        {/* Preview pane */}
        <section className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
          {previewCollapsed ? (
            <button
              onClick={() => setPreviewCollapsed(false)}
              className="flex h-full w-full flex-col items-center gap-2 px-2 py-3 text-xs font-medium text-muted-foreground hover:bg-muted"
              title="Expand preview"
            >
              <PanelLeftOpen className="h-4 w-4" />
              <span className="rotate-180 [writing-mode:vertical-rl]">
                {inv.invoiceNumber} · PDF
              </span>
            </button>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs">
                <span className="font-medium">{inv.invoiceNumber}.pdf</span>
                <button
                  onClick={() => setPreviewCollapsed(true)}
                  className="grid h-7 w-7 place-items-center rounded hover:bg-muted"
                  title="Collapse preview"
                >
                  <PanelLeftClose className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex flex-1 items-center justify-center bg-[repeating-linear-gradient(45deg,#f8fafc,#f8fafc_10px,#f1f5f9_10px,#f1f5f9_20px)] text-xs text-muted-foreground">
                <div className="text-center">
                  <div className="font-medium">PDF preview placeholder</div>
                  <div className="mt-1 text-[11px]">Drop a real PDF in /api/documents or wire UploadThing.</div>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Detail pane */}
        <section className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
          <Tabs value={tab} onValueChange={setTab} className="flex flex-1 flex-col overflow-hidden">
            <TabsList className="m-2 mb-0 grid w-fit grid-cols-5">
              <TabsTrigger value="header">Header</TabsTrigger>
              <TabsTrigger value="coding">Coding</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="log">Log</TabsTrigger>
            </TabsList>
            <div className="flex-1 overflow-y-auto p-4">
              <TabsContent value="header" className="m-0">
                <HeaderTab inv={inv} />
              </TabsContent>
              <TabsContent value="coding" className="m-0">
                <CodingTab invoiceId={inv.id} lines={data.lines} totals={{ subtotal: inv.subtotal, tax: inv.totalTax, total: inv.grandTotal }} />
              </TabsContent>
              <TabsContent value="files" className="m-0">
                <FilesTab />
              </TabsContent>
              <TabsContent value="notes" className="m-0">
                <NotesTab invoiceId={inv.id} comments={data.comments} />
              </TabsContent>
              <TabsContent value="log" className="m-0">
                <LogTab events={data.audit} />
              </TabsContent>
            </div>
          </Tabs>
        </section>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {currentStage !== 'completed' ? (
            <button
              onClick={onApprove}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              Approve & advance
            </button>
          ) : null}

          {STAGE_ORDER.indexOf(currentStage) > 0 && currentStage !== 'completed' ? (
            <RejectMenu currentStage={currentStage} onReject={onReject} disabled={isPending} />
          ) : null}

          <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted">
            <UserPlus className="h-4 w-4" /> Reassign
          </button>

          {currentStage === 'treasurer_review' ? (
            <button
              onClick={() => onVerify(!inv.verified)}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              <Check className="h-4 w-4" />
              {inv.verified ? 'Unverify' : 'Mark verified'}
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleConfidential}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <Lock className="h-3.5 w-3.5" />
            {inv.confidential ? 'Clear confidential' : 'Mark confidential'}
          </button>
          <button
            onClick={onSoftDelete}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

function WorkflowStepperClient({ currentStage }: { currentStage: StageId }) {
  const currentIdx = STAGE_ORDER.indexOf(currentStage)
  return (
    <div className="flex items-center gap-0.5 overflow-x-auto rounded-lg border border-border bg-card p-2">
      {STAGE_ORDER.map((s, i) => {
        const done = i < currentIdx
        const active = i === currentIdx
        return (
          <div key={s} className="flex items-center">
            <div
              className={cn(
                'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap',
                active && 'bg-primary text-primary-foreground',
                done && 'text-foreground',
                !active && !done && 'text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold',
                  active && 'bg-primary-foreground/20',
                  done && 'bg-green-600 text-white',
                  !active && !done && 'border border-border bg-muted',
                )}
              >
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span>{STAGE_LABELS[s]}</span>
            </div>
            {i < STAGE_ORDER.length - 1 ? (
              <span className={cn('h-px w-3', done ? 'bg-green-600' : 'bg-border')} />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function HeaderTab({ inv }: { inv: InvoiceViewData['invoice'] }) {
  const fields: Array<{ label: string; value: React.ReactNode }> = [
    { label: 'Invoice #', value: inv.invoiceNumber },
    { label: 'PO #', value: inv.poNumber ?? '—' },
    { label: 'Vendor', value: inv.vendor?.name ?? '—' },
    { label: 'Vendor #', value: inv.vendor?.vendorNumber ?? '—' },
    { label: 'Invoice Date', value: formatDate(inv.invoiceDate) },
    { label: 'Due Date', value: formatDate(inv.dueDate) },
    { label: 'Fiscal Year', value: inv.fiscalYear ?? '—' },
    { label: 'Subtotal', value: <Money value={inv.subtotal} /> },
    { label: 'Total Tax', value: <Money value={inv.totalTax} /> },
    { label: 'Grand Total', value: <Money value={inv.grandTotal} className="font-semibold" /> },
    {
      label: 'Departments',
      value: inv.departments?.map((d) => d.name).join(', ') || '—',
    },
    {
      label: 'Assignees',
      value: inv.assignees?.map((a) => a.name).join(', ') || '—',
    },
    { label: 'Batch #', value: inv.batch?.number ?? '—' },
    { label: 'Priority', value: (inv.customFields?.priority as string) ?? '—' },
  ]
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.label} className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1.5">
          <span className="text-xs text-muted-foreground">{f.label}</span>
          <span className="text-sm font-medium">{f.value}</span>
        </div>
      ))}
    </div>
  )
}

function CodingTab({
  lines,
  totals,
}: {
  invoiceId: string | number
  lines: InvoiceViewData['lines']
  totals: { subtotal: number; tax: number; total: number }
}) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">GL Account</th>
              <th className="px-3 py-2">Cost Center</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2">Tax Code</th>
              <th className="px-3 py-2 text-right">Tax $</th>
              <th className="px-3 py-2 text-right">Recoverable</th>
              <th className="px-3 py-2 text-right">Non-Rec.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lines.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  No coded lines yet. Open the Coding screen to add lines.
                </td>
              </tr>
            ) : (
              lines.map((l) => (
                <tr key={String(l.id)}>
                  <td className="px-3 py-2 font-mono text-xs">{l.glAccount?.code ?? '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{l.costCenter?.code ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums"><Money value={l.amount} /></td>
                  <td className="px-3 py-2 font-mono text-xs">{l.taxCode?.code ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums"><Money value={l.taxAmount} /></td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground"><Money value={l.recoverable} /></td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground"><Money value={l.nonRecoverable} /></td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="bg-muted/30 text-sm font-medium">
            <tr>
              <td className="px-3 py-2 text-right" colSpan={2}>Totals</td>
              <td className="px-3 py-2 text-right tabular-nums"><Money value={totals.subtotal} /></td>
              <td></td>
              <td className="px-3 py-2 text-right tabular-nums"><Money value={totals.tax} /></td>
              <td className="px-3 py-2 text-right tabular-nums" colSpan={2}>
                <Money value={totals.total} className="font-semibold" />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function FilesTab() {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
      <div className="font-medium">No documents attached yet</div>
      <p className="mt-1 text-xs">
        File uploads use UploadThing. In demo mode this is a stub — wire the storage adapter to enable real uploads.
      </p>
    </div>
  )
}

function NotesTab({ invoiceId, comments }: { invoiceId: string | number; comments: InvoiceViewData['comments'] }) {
  const [body, setBody] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const submit = () => {
    if (!body.trim()) return
    startTransition(async () => {
      await postComment(invoiceId, body.trim())
      setBody('')
      toast.success('Comment posted')
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md border border-border bg-background p-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Add a note… use @name to mention"
          className="flex-1 resize-none bg-transparent text-sm outline-none"
        />
        <button
          onClick={submit}
          disabled={pending || !body.trim()}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
          Post
        </button>
      </div>
      {comments.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground">No notes yet.</div>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={String(c.id)} className="flex items-start gap-2">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold uppercase">
                {initials(c.author?.name)}
              </div>
              <div className="flex-1 rounded-md border border-border bg-background p-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{c.author?.name ?? 'Unknown'}</span>
                  <span className="text-muted-foreground">{formatRelative(c.createdAt)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function LogTab({ events }: { events: InvoiceViewData['audit'] }) {
  if (events.length === 0) {
    return <div className="text-center text-sm text-muted-foreground">No audit events yet.</div>
  }
  return (
    <ol className="space-y-2">
      {events.map((e) => (
        <li key={String(e.id)} className="flex items-start gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold uppercase">
            {initials(e.actor?.name)}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span>
                <span className="font-medium">{e.actor?.name ?? 'System'}</span>{' '}
                <span className="text-muted-foreground">{prettyAction(e.action)}</span>
              </span>
              <span className="text-[11px] text-muted-foreground">{formatRelative(e.createdAt)}</span>
            </div>
            {e.context ? (
              <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted/40 p-2 text-[11px] text-muted-foreground">
                {JSON.stringify(e.context, null, 2)}
              </pre>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  )
}

function prettyAction(action: string) {
  return action.replace(/_/g, ' ')
}

function RejectMenu({
  currentStage,
  onReject,
  disabled,
}: {
  currentStage: StageId
  onReject: (target: StageId, reason: string) => void
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState<StageId | ''>('')
  const [reason, setReason] = useState('')
  const validTargets = STAGE_ORDER.slice(0, STAGE_ORDER.indexOf(currentStage))

  if (validTargets.length === 0) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
      >
        <X className="h-4 w-4" />
        Reject
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-md border border-border bg-popover p-3 shadow-md">
          <div className="space-y-2">
            <label className="block text-xs font-medium">Send back to</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value as StageId)}
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="">Select stage…</option>
              {validTargets.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
            </select>
            <label className="block text-xs font-medium">Reason (required)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-background p-2 text-sm"
              placeholder="Explain why this is being rejected…"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:underline">
                Cancel
              </button>
              <button
                disabled={!target || !reason.trim()}
                onClick={() => {
                  if (target && reason.trim()) {
                    onReject(target as StageId, reason.trim())
                    setOpen(false)
                    setReason('')
                    setTarget('')
                  }
                }}
                className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
