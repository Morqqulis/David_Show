'use client'

import { useState } from 'react'
import { Check, Lock, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { fetchCodingGate } from '@/backend/actions/invoice/coding'
import { STAGE_ORDER, type StageId } from '@/backend/lib/stage-ids'
import { useReasonList, useReassignAvailability } from '@/hooks/use-ap-queries'
import { RejectMenu } from './reject-menu'
import {
  EMPTY_REASON,
  ReasonPicker,
  ReassignDialog,
  reasonSatisfied,
  type ReasonSelection,
} from './reassign-dialog'

/** One evolving pill rather than a queue of stale messages on repeat clicks. */
const GATE_TOAST_ID = 'coding-gate-approve'

type PendingWarning = { message: string; reasons: string[] }

export function InvoiceActionBar({
  invoiceId,
  currentStage,
  verified,
  confidential,
  isMutating,
  onApprove,
  onReject,
  onVerify,
  onToggleConfidential,
  onSoftDelete,
}: {
  invoiceId: string | number
  currentStage: StageId
  verified: boolean
  confidential: boolean
  isMutating: boolean
  onApprove: (options?: { acknowledgedWarning?: boolean }) => void
  onReject: (target: StageId, reasonId: string | null, otherText: string) => void
  onVerify: (next: boolean) => void
  onToggleConfidential: () => void
  onSoftDelete: (reasonId: string | null, otherText: string) => void
}) {
  const canApprove = currentStage !== 'completed'
  const canReject = STAGE_ORDER.indexOf(currentStage) > 0 && currentStage !== 'completed'
  const isTreasurer = currentStage === 'treasurer_review'

  const [checking, setChecking] = useState(false)
  const [pendingWarning, setPendingWarning] = useState<PendingWarning | null>(null)
  const [reassignOpen, setReassignOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState<ReasonSelection>(EMPTY_REASON)

  // Where the stage's Reassign switch is off — or the person looking has no
  // business moving this invoice — the button is absent rather than greyed out.
  // A disabled control with no explanation is the harder thing to troubleshoot.
  const { data: reassign } = useReassignAvailability(invoiceId)
  const { data: cancelReasons } = useReasonList('cancel', cancelOpen)

  /**
   * The Approve button is deliberately never disabled by the sum-match rule: a
   * disabled button with no explanation is the harder thing to troubleshoot.
   * The check runs on click and says what is missing. The server repeats the
   * check and is the authority — this is only the friendly half.
   */
  async function handleApprove() {
    setChecking(true)
    try {
      const gate = await fetchCodingGate(invoiceId)
      // Coding lines can be edited after To Be Coded, so the rule follows the
      // invoice forward. Stages that legitimately have no lines yet, such as To
      // Be Assigned, are left alone.
      const applies = currentStage === 'to_be_coded' || gate.lineCount > 0
      if (applies && gate.verdict.behaviour === 'block') {
        toast.error(gate.verdict.message ?? 'Invoice needs to be fully coded.', {
          id: GATE_TOAST_ID,
          description: gate.verdict.reasons.join(' '),
        })
        return
      }
      if (applies && gate.verdict.behaviour === 'warn') {
        setPendingWarning({
          message: gate.verdict.message ?? 'Invoice needs to be fully coded.',
          reasons: gate.verdict.reasons,
        })
        return
      }
      onApprove()
    } catch (err) {
      // The server runs the same check inside the approval, so a failed
      // pre-check must not strand the user — let the approval go and surface
      // whatever the server says.
      console.error('[coding-gate] pre-approval check failed', { invoiceId, err })
      onApprove()
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {canApprove ? (
          <Button onClick={handleApprove} disabled={isMutating || checking}>
            <Check className="h-4 w-4" />
            Approve & advance
          </Button>
        ) : null}
        {canReject ? <RejectMenu currentStage={currentStage} onReject={onReject} disabled={isMutating} /> : null}
        {reassign?.canReassign ? (
          <Button variant="outline" onClick={() => setReassignOpen(true)} disabled={isMutating}>
            <UserPlus className="h-4 w-4" />
            Reassign
          </Button>
        ) : null}
        {isTreasurer ? (
          <Button variant="outline" onClick={() => onVerify(!verified)} disabled={isMutating}>
            <Check className="h-4 w-4" />
            {verified ? 'Unverify' : 'Mark verified'}
          </Button>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleConfidential}
          disabled={isMutating}
        >
          <Lock className="h-3.5 w-3.5" />
          {confidential ? 'Clear confidential' : 'Mark confidential'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setCancelReason(EMPTY_REASON)
            setCancelOpen(true)
          }}
          disabled={isMutating}
          className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </div>

      <ReassignDialog invoiceId={invoiceId} open={reassignOpen} onOpenChange={setReassignOpen} />

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Move this invoice to Trash</DialogTitle>
            <DialogDescription>
              It leaves the queues but is not destroyed — you can restore it from Trash later.
            </DialogDescription>
          </DialogHeader>
          <ReasonPicker scope="cancel" value={cancelReason} onChange={setCancelReason} id="cancel-reason" />
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={!reasonSatisfied(cancelReasons, cancelReason)}
              onClick={() => {
                setCancelOpen(false)
                onSoftDelete(cancelReason.reasonId, cancelReason.otherText)
              }}
            >
              Move to Trash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingWarning !== null} onOpenChange={(o) => !o && setPendingWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingWarning?.message}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <ul className="list-disc space-y-0.5 pl-4">
                  {pendingWarning?.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
                <p>You can approve anyway. The approval is recorded in the invoice history.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back and finish coding</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setPendingWarning(null)
                onApprove({ acknowledgedWarning: true })
              }}
            >
              Approve anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
