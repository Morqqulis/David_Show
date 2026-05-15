'use client'

import { Check, Lock, Trash2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { STAGE_ORDER, type StageId } from '@/backend/lib/stage-ids'
import { RejectMenu } from './reject-menu'

export function InvoiceActionBar({
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
  currentStage: StageId
  verified: boolean
  confidential: boolean
  isMutating: boolean
  onApprove: () => void
  onReject: (target: StageId, reason: string) => void
  onVerify: (next: boolean) => void
  onToggleConfidential: () => void
  onSoftDelete: () => void
}) {
  const canApprove = currentStage !== 'completed'
  const canReject = STAGE_ORDER.indexOf(currentStage) > 0 && currentStage !== 'completed'
  const isTreasurer = currentStage === 'treasurer_review'

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {canApprove ? (
          <Button onClick={onApprove} disabled={isMutating}>
            <Check className="h-4 w-4" />
            Approve & advance
          </Button>
        ) : null}
        {canReject ? <RejectMenu currentStage={currentStage} onReject={onReject} disabled={isMutating} /> : null}
        <Button variant="outline" disabled={isMutating}>
          <UserPlus className="h-4 w-4" />
          Reassign
        </Button>
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
          onClick={onSoftDelete}
          disabled={isMutating}
          className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </div>
    </div>
  )
}
