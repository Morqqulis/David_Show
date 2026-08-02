'use client'

import { useState, useTransition } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { unwrap } from '@/lib/action-result'
import { Button } from '@/components/ui/button'
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
import { assignInvoice } from '@/backend/actions/invoice'
import { queryKeys, useAssignContext } from '@/hooks/use-ap-queries'

const ASSIGN_TOAST_ID = 'invoice-assign'

/**
 * Handing a newly arrived invoice to the person who will code it.
 *
 * Deliberately smaller than the Reassign dialog: no reason list and no "whose
 * turn" step, because neither exists yet on an invoice nobody owns. One
 * choice, one button.
 */
export function AssignDialog({
  invoiceId,
  open,
  onOpenChange,
}: {
  invoiceId: string | number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const qc = useQueryClient()
  // Through TanStack rather than an effect that calls setState: the effect
  // version tripped `react-hooks/set-state-in-effect`, and the query also
  // gives cancellation and caching for free. The directory is only fetched
  // once the dialog is actually open, the same as the Reassign modal.
  const { data: context, isLoading: loading } = useAssignContext(invoiceId, open)
  const [targetId, setTargetId] = useState<string>('')
  const [saving, startSaving] = useTransition()

  function submit() {
    const chosen = context?.candidates.find((c) => String(c.id) === targetId)
    if (!chosen) return

    startSaving(async () => {
      try {
        unwrap(await assignInvoice(invoiceId, chosen.id))
      } catch (err) {
        console.error('[assign] assigning the invoice failed', { invoiceId, targetId, err })
        toast.error((err as Error).message || 'The invoice could not be assigned.', {
          id: ASSIGN_TOAST_ID,
        })
        return
      }
      toast.success(`Assigned to ${chosen.name}`, { id: ASSIGN_TOAST_ID, duration: 2000 })
      await qc.invalidateQueries({ queryKey: queryKeys.invoice(invoiceId) })
      await qc.invalidateQueries({ queryKey: queryKeys.queueCounts })
      onOpenChange(false)
    })
  }

  const chosen = context?.candidates.find((c) => String(c.id) === targetId) ?? null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign this invoice</DialogTitle>
          <DialogDescription>
            Choose who should code it. The invoice moves into their queue.
          </DialogDescription>
        </DialogHeader>

        {loading || !context ? (
          <p className="py-6 text-sm text-muted-foreground">Loading the list of people…</p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="assign-person">Hand it to</Label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger id="assign-person">
                  <SelectValue placeholder="Choose a person…" />
                </SelectTrigger>
                <SelectContent>
                  {context.candidates.map((person) => (
                    <SelectItem key={String(person.id)} value={String(person.id)}>
                      {person.name}
                      {person.roleName ? ` · ${person.roleName}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {context.candidates.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {context.confidentialFilterApplied
                    ? 'Nobody available. This invoice is confidential, so only people cleared for confidential invoices are listed.'
                    : `Nobody available. Only people who work at the ${context.nextStageLabel} stage are listed.`}
                </p>
              ) : null}
            </div>

            <p className="rounded-md bg-muted/60 px-3 py-2 text-sm">
              {chosen
                ? `Invoice ${context.invoiceNumber} goes to ${chosen.name} and moves into ${context.nextStageLabel}.`
                : 'Choose a person to see what will happen.'}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button onClick={submit} disabled={!chosen || saving}>
            {saving ? 'Assigning…' : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
