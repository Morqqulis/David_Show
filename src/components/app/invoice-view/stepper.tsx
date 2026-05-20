'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STAGE_ORDER, type StageId } from '@/backend/lib/stage-ids'
import { useStageLabels } from '@/hooks/use-stage-labels'

export function InvoiceWorkflowStepper({ currentStage }: { currentStage: StageId }) {
  const currentIdx = STAGE_ORDER.indexOf(currentStage)
  const labels = useStageLabels()
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
              <span>{labels[s]}</span>
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
