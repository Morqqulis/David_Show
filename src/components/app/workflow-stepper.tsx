import { cn } from '@/lib/utils'
import { STAGE_LABELS, STAGE_ORDER, type StageId } from '@/backend/lib/stage-ids'
import { Check } from 'lucide-react'

export function WorkflowStepper({ currentStage }: { currentStage: StageId }) {
  const currentIdx = STAGE_ORDER.indexOf(currentStage)
  return (
    <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-border bg-card p-2">
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
