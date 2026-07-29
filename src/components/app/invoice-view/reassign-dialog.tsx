'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { ReasonList } from '@/backend/actions/reason-actions'
import type { ReasonScope } from '@/backend/collections/ActionReasons'
import { listOwnershipSlots, listPickerPeople } from '@/backend/lib/reassign-eligibility'
import { useReasonList, useReassignContext, useReassignInvoices } from '@/hooks/use-ap-queries'

/** One evolving pill per surface rather than a queue of stale messages. */
const REASSIGN_TOAST_ID = 'invoice-reassign'

export type ReasonSelection = { reasonId: string | null; otherText: string }
export const EMPTY_REASON: ReasonSelection = { reasonId: null, otherText: '' }

/**
 * Is this reason good enough to submit? Built once here and reused by Reassign,
 * Reject and Cancel — the three actions differ only by which list they read.
 */
export function reasonSatisfied(list: ReasonList | undefined, value: ReasonSelection): boolean {
  if (!list) return false
  const chosen = list.options.find((o) => String(o.id) === value.reasonId)
  if (chosen?.isOther) return value.otherText.trim().length > 0
  return list.required ? Boolean(chosen) : true
}

/**
 * The admin-managed reason dropdown. Picking the built-in Other option reveals
 * a single line of free text; everything else is chosen from the list an
 * administrator maintains in Settings → Reasons.
 */
export function ReasonPicker({
  scope,
  value,
  onChange,
  id,
}: {
  scope: ReasonScope
  value: ReasonSelection
  onChange: (next: ReasonSelection) => void
  id: string
}) {
  const { data: list, isLoading } = useReasonList(scope)
  const chosen = list?.options.find((o) => String(o.id) === value.reasonId)

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Reason{list?.required ? ' (required)' : ' (optional)'}</Label>
      <Select
        value={value.reasonId ?? ''}
        onValueChange={(next) => onChange({ reasonId: next, otherText: '' })}
      >
        <SelectTrigger id={id} disabled={isLoading || (list?.options.length ?? 0) === 0}>
          <SelectValue placeholder={isLoading ? 'Loading reasons…' : 'Choose a reason…'} />
        </SelectTrigger>
        <SelectContent>
          {(list?.options ?? []).map((option) => (
            <SelectItem key={String(option.id)} value={String(option.id)}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {chosen?.isOther ? (
        <Input
          autoFocus
          value={value.otherText}
          onChange={(e) => onChange({ ...value, otherText: e.target.value })}
          placeholder="Say briefly why"
          aria-label="Your reason"
        />
      ) : null}
      {!isLoading && (list?.options.length ?? 0) === 0 ? (
        <p className="text-xs text-muted-foreground">
          No reasons have been set up yet. An administrator adds them under Settings, Reasons.
        </p>
      ) : null}
    </div>
  )
}

/**
 * Reassign, on one invoice. Picker, reason and a plain sentence describing what
 * is about to happen, above a single button — nothing here destroys anything,
 * so a second confirmation step would be friction with no payoff.
 */
export function ReassignDialog({
  invoiceId,
  open,
  onOpenChange,
}: {
  invoiceId: string | number
  open: boolean
  onOpenChange: (next: boolean) => void
}) {
  const { data: ctx, isLoading } = useReassignContext(invoiceId, open)
  const { data: reasons } = useReasonList('reassign', open)
  const reassign = useReassignInvoices()

  const [slotUserId, setSlotUserId] = useState<string | null>(null)
  const [targetId, setTargetId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [reason, setReason] = useState<ReasonSelection>(EMPTY_REASON)

  const slots = useMemo(() => (ctx ? listOwnershipSlots(ctx.invoice) : []), [ctx])

  // Clear the previous invoice's answers as the modal opens. Adjusting state
  // during render is React's own answer to "reset when a prop changes" — an
  // effect would repaint the stale answers for one frame first.
  const openKey = open ? String(invoiceId) : null
  const [openedWith, setOpenedWith] = useState<string | null>(openKey)
  if (openKey !== openedWith) {
    setOpenedWith(openKey)
    setSlotUserId(null)
    setTargetId(null)
    setShowAll(false)
    setReason(EMPTY_REASON)
  }

  // With only one person waiting there is nothing to choose, so the question is
  // never asked and the single slot is simply used.
  const activeSlotUserId = slotUserId ?? (slots.length === 1 ? String(slots[0].userId) : null)

  const picker = useMemo(
    () =>
      ctx
        ? listPickerPeople({
            actor: ctx.actor,
            invoice: ctx.invoice,
            people: ctx.people,
            slotUserId: activeSlotUserId,
            showAll,
          })
        : null,
    [ctx, activeSlotUserId, showAll],
  )

  const target = picker?.people.find((p) => String(p.id) === targetId) ?? null
  const fromName = slots.find((s) => String(s.userId) === activeSlotUserId)?.userName
  const ready = Boolean(activeSlotUserId && target) && reasonSatisfied(reasons, reason)

  function submit() {
    if (!ready || !target || !ctx) return
    reassign.mutate(
      {
        invoiceIds: [invoiceId],
        fromUserId: activeSlotUserId,
        toUserId: target.id,
        reasonId: reason.reasonId,
        otherText: reason.otherText,
      },
      {
        onSuccess: (outcome) => {
          if (outcome.moved.length === 0) {
            const why = outcome.skipped[0]?.reason ?? 'The invoice could not be reassigned.'
            console.error('[reassign] single reassign was refused', { invoiceId, why })
            toast.error(why, { id: REASSIGN_TOAST_ID })
            return
          }
          toast.success(`${ctx.invoice.invoiceNumber} is now with ${target.name}`, {
            id: REASSIGN_TOAST_ID,
            description: outcome.notificationProblem ?? undefined,
          })
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Reassign this invoice</DialogTitle>
          <DialogDescription>
            The invoice stays exactly where it is in the workflow. Only who it is waiting on changes.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !ctx || !picker ? (
          <p className="py-6 text-sm text-muted-foreground">Loading the list of people…</p>
        ) : (
          <div className="space-y-4">
            {slots.length > 1 ? (
              <div className="space-y-1.5">
                <Label htmlFor="reassign-slot">Whose turn are you moving?</Label>
                <Select value={activeSlotUserId ?? ''} onValueChange={setSlotUserId}>
                  <SelectTrigger id="reassign-slot">
                    <SelectValue placeholder="Choose the person…" />
                  </SelectTrigger>
                  <SelectContent>
                    {slots.map((slot) => (
                      <SelectItem key={String(slot.userId)} value={String(slot.userId)}>
                        {slot.userName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {slots.length} people are being waited on. Everyone else keeps their turn.
                </p>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="reassign-person">Hand it to</Label>
              <Select value={targetId ?? ''} onValueChange={setTargetId} disabled={!activeSlotUserId}>
                <SelectTrigger id="reassign-person">
                  <SelectValue placeholder={activeSlotUserId ? 'Choose a person…' : 'Choose whose turn first…'} />
                </SelectTrigger>
                <SelectContent>
                  {picker.people.map((person) => (
                    <SelectItem key={String(person.id)} value={String(person.id)}>
                      {person.name}
                      {person.role ? ` · ${person.role.name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {picker.people.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nobody available. Only people who work at this stage are listed.
                </p>
              ) : null}
              {picker.overrideAvailable ? (
                <div className="flex items-center gap-2 pt-1">
                  <Switch id="reassign-show-all" checked={showAll} onCheckedChange={setShowAll} />
                  <Label htmlFor="reassign-show-all" className="text-xs font-normal text-muted-foreground">
                    Show everyone, not only people who work at this stage
                  </Label>
                </div>
              ) : null}
            </div>

            <ReasonPicker scope="reassign" value={reason} onChange={setReason} id="reassign-reason" />

            <p className="rounded-md bg-muted/60 px-3 py-2 text-sm">
              {target && fromName
                ? `Invoice ${ctx.invoice.invoiceNumber} moves from ${fromName} to ${target.name}. It stays in ${ctx.invoice.stageLabel}, anything already approved stays approved, and ${target.name} gets an email about it.`
                : 'Choose a person to see what will happen.'}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button onClick={submit} disabled={!ready || reassign.isPending}>
            {reassign.isPending ? 'Reassigning…' : 'Reassign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
