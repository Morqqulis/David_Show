'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { ReassignOutcome } from '@/backend/actions/reassign-actions'
import {
  BULK_REASSIGN_CAP,
  groupByCurrentOwner,
  listOwnershipSlots,
  listPickerPeople,
  planBulkReassign,
  type ReassignInvoice,
  type ReassignPerson,
} from '@/backend/lib/reassign-eligibility'
import {
  useBulkReassignContext,
  useInvoicesForReassign,
  useOpenWorkFor,
  useReasonList,
  useReassignInvoices,
} from '@/hooks/use-ap-queries'
import {
  EMPTY_REASON,
  ReasonPicker,
  reasonSatisfied,
  type ReasonSelection,
} from '@/components/app/invoice-view/reassign-dialog'

/**
 * Bulk reassign, both ways in.
 *
 * The operation underneath is always the same — move one person's outstanding
 * turn to somebody else — so this is one screen with two ways of arriving at
 * the invoice list, not two features. From-person asks who is away and lists
 * their open work; row selection reads whose turn each ticked row is waiting on
 * and, when the selection spans several people, asks which of them is meant.
 */
export type BulkReassignMode = { kind: 'from-person' } | { kind: 'selection'; invoiceIds: Array<string | number> }

export function BulkReassignDialog({
  open,
  onOpenChange,
  mode,
  onCommitted,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  mode: BulkReassignMode
  /** Called once anything actually moved, so the table can drop its ticks. */
  onCommitted?: () => void
}) {
  const { data: ctx } = useBulkReassignContext(open)
  const { data: reasons } = useReasonList('reassign', open)
  const reassign = useReassignInvoices()

  const [fromUserId, setFromUserId] = useState<string | null>(null)
  const [stageFilter, setStageFilter] = useState('all')
  const [deptFilter, setDeptFilter] = useState('all')
  const [targetId, setTargetId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [reason, setReason] = useState<ReasonSelection>(EMPTY_REASON)
  const [leftBehind, setLeftBehind] = useState<string[]>([])
  const [result, setResult] = useState<ReassignOutcome | null>(null)

  const selectionIds = mode.kind === 'selection' ? mode.invoiceIds : []
  const { data: selected } = useInvoicesForReassign(selectionIds, open && mode.kind === 'selection')
  const { data: openWork } = useOpenWorkFor(mode.kind === 'from-person' ? fromUserId : null, {
    stageSystemId: stageFilter === 'all' ? undefined : stageFilter,
    departmentId: deptFilter === 'all' ? undefined : deptFilter,
  })

  // Start clean each time the modal opens. Adjusting state during render is
  // React's own answer to "reset when a prop changes"; an effect would show the
  // previous run's result for a frame before clearing it.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setFromUserId(null)
      setTargetId(null)
      setShowAll(false)
      setReason(EMPTY_REASON)
      setLeftBehind([])
      setResult(null)
    }
  }

  const groups = useMemo(() => groupByCurrentOwner(selected ?? []), [selected])

  // One person's queue in from-person mode; the chosen group's rows in
  // selection mode. Both end up as "these invoices, waiting on this person".
  const source: ReassignInvoice[] = useMemo(() => {
    if (mode.kind === 'from-person') return openWork ?? []
    if (!fromUserId) return []
    return (selected ?? []).filter((i) =>
      listOwnershipSlots(i).some((s) => String(s.userId) === fromUserId),
    )
  }, [mode.kind, openWork, selected, fromUserId])

  const chosen = useMemo(
    () => source.filter((i) => !leftBehind.includes(String(i.id))),
    [source, leftBehind],
  )

  const targetCandidates: ReassignPerson[] = useMemo(() => {
    if (!ctx || chosen.length === 0) return []
    // Anyone valid for at least one of the invoices. Requiring validity for all
    // of them would hide a coder who could legitimately take most of the batch;
    // each invoice is checked again on commit.
    const byId = new Map<string, ReassignPerson>()
    for (const invoice of chosen) {
      for (const person of listPickerPeople({
        actor: ctx.actor,
        invoice,
        people: ctx.people,
        slotUserId: fromUserId,
        showAll,
      }).people) {
        byId.set(String(person.id), person)
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [ctx, chosen, fromUserId, showAll])

  const target = targetCandidates.find((p) => String(p.id) === targetId) ?? null
  const fromPerson = ctx?.people.find((p) => String(p.id) === fromUserId) ?? null

  // The same plan the server will make, run here so the user sees what will be
  // left behind before they commit rather than only in the summary afterwards.
  const preview = useMemo(
    () =>
      ctx && target
        ? planBulkReassign({
            actor: ctx.actor,
            target,
            fromUserId,
            fromUserName: fromPerson?.name,
            invoices: chosen,
          })
        : null,
    [ctx, target, fromUserId, fromPerson, chosen],
  )

  const overrideAvailable = Boolean(
    ctx && chosen[0]
      ? listPickerPeople({ actor: ctx.actor, invoice: chosen[0], people: ctx.people }).overrideAvailable
      : false,
  )
  const ready = Boolean(target) && chosen.length > 0 && reasonSatisfied(reasons, reason)

  function commit() {
    if (!ready || !target) return
    reassign.mutate(
      {
        invoiceIds: chosen.map((i) => i.id),
        fromUserId,
        toUserId: target.id,
        reasonId: reason.reasonId,
        otherText: reason.otherText,
      },
      {
        onSuccess: (outcome) => {
          setResult(outcome)
          if (outcome.moved.length > 0) onCommitted?.()
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reassign several invoices</DialogTitle>
          <DialogDescription>
            Every invoice stays exactly where it is in the workflow. Only who it is waiting on changes.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <ResultSummary outcome={result} />
        ) : (
          <div className="space-y-4">
            {mode.kind === 'from-person' ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <PickField label="Move work away from" id="bulk-from">
                  <Select value={fromUserId ?? ''} onValueChange={setFromUserId}>
                    <SelectTrigger id="bulk-from">
                      <SelectValue placeholder="Choose a person…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(ctx?.people ?? [])
                        .filter((p) => p.active)
                        .map((p) => (
                          <SelectItem key={String(p.id)} value={String(p.id)}>
                            {p.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </PickField>
                <PickField label="Only this stage" id="bulk-stage">
                  <Select value={stageFilter} onValueChange={setStageFilter}>
                    <SelectTrigger id="bulk-stage">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Every stage</SelectItem>
                      {(ctx?.stages ?? []).map((s) => (
                        <SelectItem key={s.systemId} value={s.systemId}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </PickField>
                <PickField label="Only this department" id="bulk-dept">
                  <Select value={deptFilter} onValueChange={setDeptFilter}>
                    <SelectTrigger id="bulk-dept">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Every department</SelectItem>
                      {(ctx?.departments ?? []).map((d) => (
                        <SelectItem key={String(d.id)} value={String(d.id)}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </PickField>
              </div>
            ) : (
              <PickField label="These invoices are waiting on" id="bulk-group">
                <Select value={fromUserId ?? ''} onValueChange={setFromUserId}>
                  <SelectTrigger id="bulk-group">
                    <SelectValue placeholder="Choose whose turn to move…" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={String(g.userId)} value={String(g.userId)}>
                        {g.userName} — {g.invoiceIds.length}{' '}
                        {g.invoiceIds.length === 1 ? 'invoice' : 'invoices'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </PickField>
            )}

            {fromUserId ? (
              <InvoiceTicks
                invoices={source}
                leftBehind={leftBehind}
                onToggle={(id) =>
                  setLeftBehind((cur) =>
                    cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
                  )
                }
              />
            ) : null}

            {chosen.length > 0 ? (
              <>
                <PickField label="Hand them to" id="bulk-target">
                  <Select value={targetId ?? ''} onValueChange={setTargetId}>
                    <SelectTrigger id="bulk-target">
                      <SelectValue placeholder="Choose a person…" />
                    </SelectTrigger>
                    <SelectContent>
                      {targetCandidates.map((p) => (
                        <SelectItem key={String(p.id)} value={String(p.id)}>
                          {p.name}
                          {p.role ? ` · ${p.role.name}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </PickField>
                {overrideAvailable ? (
                  <div className="flex items-center gap-2">
                    <Switch id="bulk-show-all" checked={showAll} onCheckedChange={setShowAll} />
                    <Label htmlFor="bulk-show-all" className="text-xs font-normal text-muted-foreground">
                      Show everyone, not only people who work at these stages
                    </Label>
                  </div>
                ) : null}
                <ReasonPicker scope="reassign" value={reason} onChange={setReason} id="bulk-reason" />
                <p className="rounded-md bg-muted/60 px-3 py-2 text-sm">
                  {preview && target && fromPerson
                    ? `${preview.moves.length} of ${chosen.length} invoices move from ${fromPerson.name} to ${target.name}. ${
                        preview.skips.length > 0
                          ? `${preview.skips.length} cannot be moved and will be listed for you.`
                          : 'None have to be left behind.'
                      } ${target.name} gets one email covering all of them.`
                    : 'Choose a person to see what will happen.'}
                </p>
              </>
            ) : null}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          ) : (
            <Button onClick={commit} disabled={!ready || reassign.isPending}>
              {reassign.isPending ? 'Reassigning…' : `Reassign ${chosen.length || ''}`.trim()}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PickField({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

function InvoiceTicks({
  invoices,
  leftBehind,
  onToggle,
}: {
  invoices: ReassignInvoice[]
  leftBehind: string[]
  onToggle: (id: string) => void
}) {
  if (invoices.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing is waiting on this person right now.</p>
  }
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label>Untick anything to leave behind</Label>
        {invoices.length > BULK_REASSIGN_CAP ? (
          <span className="text-xs text-red-700">
            Only {BULK_REASSIGN_CAP} can move at once — narrow this down first.
          </span>
        ) : null}
      </div>
      <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-2">
        {invoices.map((invoice) => (
          <label
            key={String(invoice.id)}
            className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted"
          >
            <Checkbox
              checked={!leftBehind.includes(String(invoice.id))}
              onCheckedChange={() => onToggle(String(invoice.id))}
            />
            <span className="font-medium">{invoice.invoiceNumber}</span>
            <span className="text-muted-foreground">{invoice.stageLabel}</span>
            {!invoice.stageAllowsReassign ? (
              <span className="text-xs text-amber-700">reassigning is switched off here</span>
            ) : null}
          </label>
        ))}
      </div>
    </div>
  )
}

function ResultSummary({ outcome }: { outcome: ReassignOutcome }) {
  return (
    <div className="space-y-3 text-sm">
      <p>
        <strong>{outcome.moved.length}</strong>{' '}
        {outcome.moved.length === 1 ? 'invoice was' : 'invoices were'} reassigned.
        {outcome.notification
          ? ` ${outcome.notification.recipient} was emailed once about all of them.`
          : ''}
      </p>
      {outcome.notificationProblem ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-800">{outcome.notificationProblem}</p>
      ) : null}
      {outcome.skipped.length > 0 ? (
        <div className="space-y-1">
          <p className="font-medium">Left where they were:</p>
          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
            {outcome.skipped.map((s) => (
              <li key={String(s.invoiceId)}>
                <span className="font-medium">{s.invoiceNumber}</span>{' '}
                <span className="text-muted-foreground">— {s.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
