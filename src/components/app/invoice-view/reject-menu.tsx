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
import { Textarea } from '@/components/ui/textarea'
import { STAGE_ORDER, type StageId } from '@/backend/lib/stage-ids'
import { useStageLabels } from '@/hooks/use-stage-labels'

export function RejectMenu({
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
  const labels = useStageLabels()

  if (validTargets.length === 0) return null

  function submit() {
    if (!target || !reason.trim()) return
    onReject(target as StageId, reason.trim())
    setOpen(false)
    setReason('')
    setTarget('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
          <div className="space-y-1.5">
            <Label htmlFor="reject-reason">Reason (required)</Label>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Explain why this is being rejected…"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={!target || !reason.trim()}
              onClick={submit}
            >
              Reject
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
