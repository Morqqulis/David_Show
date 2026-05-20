'use client'

import { cn } from '@/lib/utils'
import { STAGE_TONE, type StageId } from '@/backend/lib/stage-ids'
import { useStageLabels } from '@/hooks/use-stage-labels'

const TONE_CLASSES: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  blue: 'bg-blue-100 text-blue-800 ring-blue-200',
  violet: 'bg-violet-100 text-violet-800 ring-violet-200',
  amber: 'bg-amber-100 text-amber-800 ring-amber-200',
  green: 'bg-green-100 text-green-800 ring-green-200',
  red: 'bg-red-100 text-red-800 ring-red-200',
}

export function StageBadge({
  stage,
  size = 'md',
  className,
}: {
  stage: StageId | { systemId: StageId; label?: string; tone?: keyof typeof TONE_CLASSES }
  size?: 'sm' | 'md'
  className?: string
}) {
  const systemId = typeof stage === 'string' ? stage : (stage.systemId as StageId)
  const labels = useStageLabels()
  const label = typeof stage === 'string' ? labels[systemId] : (stage.label ?? labels[systemId])
  const tone = typeof stage === 'string' ? STAGE_TONE[systemId] : (stage.tone ?? STAGE_TONE[systemId])
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ring-1 ring-inset',
        size === 'sm' ? 'text-[10px]' : 'text-xs',
        TONE_CLASSES[tone],
        className,
      )}
    >
      <span className={cn('inline-block rounded-full', size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2', dotColor(tone))} />
      {label}
    </span>
  )
}

function dotColor(tone: string) {
  return {
    slate: 'bg-slate-500',
    blue: 'bg-blue-500',
    violet: 'bg-violet-500',
    amber: 'bg-amber-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
  }[tone] ?? 'bg-slate-500'
}
