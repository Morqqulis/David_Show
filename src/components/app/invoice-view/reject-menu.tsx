'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { STAGE_ORDER, type StageId } from '@/backend/lib/stage-ids'
import { useReasonList } from '@/hooks/use-ap-queries'
import { useStageLabels } from '@/hooks/use-stage-labels'
import { EMPTY_REASON, ReasonPicker, reasonSatisfied, type ReasonSelection } from './reassign-dialog'

export function RejectMenu({
  currentStage,
  onReject,
  disabled,
}: {
  currentStage: StageId
  onReject: (target: StageId, reasonId: string | null, otherText: string) => void
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState<StageId | ''>('')
  // The reason used to be a free-text box. It now comes from the same
  // admin-managed list mechanism as Reassign and Cancel, each with its own list.
  const [reason, setReason] = useState<ReasonSelection>(EMPTY_REASON)
  const { data: reasons } = useReasonList('reject', open)
  const validTargets = STAGE_ORDER.slice(0, STAGE_ORDER.indexOf(currentStage))
  const labels = useStageLabels()

  if (validTargets.length === 0) return null

  const ready = Boolean(target) && reasonSatisfied(reasons, reason)

  function submit() {
    if (!ready || !target) return
    onReject(target as StageId, reason.reasonId, reason.otherText)
    setOpen(false)
    setReason(EMPTY_REASON)
    setTarget('')
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setReason(EMPTY_REASON)
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <X className="h-4 w-4" />
          Reject
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="reject-target">Send back to</Label>
            <Select value={target} onValueChange={(v) => setTarget(v as StageId)}>
              <SelectTrigger id="reject-target">
                <SelectValue placeholder="Select stage…" />
              </SelectTrigger>
              <SelectContent>
                {validTargets.map((s) => (
                  <SelectItem key={s} value={s}>
                    {labels[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ReasonPicker scope="reject" value={reason} onChange={setReason} id="reject-reason" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="destructive" disabled={!ready} onClick={submit}>
              Reject
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
