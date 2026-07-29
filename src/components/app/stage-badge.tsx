'use client'

import { cn } from '@/lib/utils'
import { STAGE_ORDER, type StageId } from '@/backend/lib/stage-ids'
import { useStageLabels } from '@/hooks/use-stage-labels'

/**
 * Workflow status pills, as a single-hue ramp derived from the brand colour.
 *
 * Ported from the AP Invoice UI reference build. The progression carries
 * meaning and is not decorative: not-started is neutral grey, the working
 * stages deepen through tints of the brand as the invoice advances, the two
 * late stages are solid brand on white text, and done is green. Because every
 * step is a `color-mix` of `--primary`, re-skinning the app to another
 * municipality's brand re-tints the whole ramp with no further work — the
 * previous implementation hardcoded unrelated Tailwind hues (blue, violet,
 * amber) that could never follow the brand and read as arbitrary.
 *
 * Every combination below was measured against WCAG 2.2 AA for normal text.
 * The ramp stops at 36% because 44% falls to 4.21:1 and fails.
 */
type PillStyle = { bg: string; fg: string; dot: string }

const NEUTRAL: PillStyle = {
  bg: 'bg-secondary',
  fg: 'text-secondary-foreground', // #56657A on #EDF1F7 — 5.24:1
  dot: 'bg-muted-foreground',
}

/** `color-mix` percentage of --primary against white, per stage. */
const TINT_STEPS: Partial<Record<StageId, number>> = {
  to_be_coded: 14, // 6.93:1
  conditional_approvals: 22, // 6.13:1
  ap_review: 30, // 5.34:1
  ready_for_processing: 36, // 4.83:1
}

const SOLID: Partial<Record<StageId, PillStyle>> = {
  processed: {
    bg: 'bg-primary',
    fg: 'text-primary-foreground', // 5.93:1
    dot: 'bg-primary-foreground/70',
  },
  treasurer_review: {
    bg: 'bg-[color-mix(in_srgb,var(--primary)_78%,black)]',
    fg: 'text-primary-foreground', // 8.57:1
    dot: 'bg-primary-foreground/70',
  },
}

const DONE: PillStyle = {
  bg: 'bg-[color-mix(in_srgb,var(--chart-5)_18%,white)]',
  fg: 'text-[#0C6B45]', // 5.46:1
  dot: 'bg-[var(--chart-5)]',
}

function pillStyle(systemId: StageId): PillStyle {
  if (systemId === 'completed') return DONE
  const solid = SOLID[systemId]
  if (solid) return solid
  const step = TINT_STEPS[systemId]
  if (step == null) return NEUTRAL
  return {
    bg: `bg-[color-mix(in_srgb,var(--primary)_${step}%,white)]`,
    fg: 'text-[color-mix(in_srgb,var(--primary)_78%,black)]',
    dot: 'bg-primary',
  }
}

export function StageBadge({
  stage,
  size = 'md',
  className,
}: {
  stage: StageId | { systemId: StageId; label?: string }
  size?: 'sm' | 'md'
  className?: string
}) {
  const systemId = typeof stage === 'string' ? stage : (stage.systemId as StageId)
  const labels = useStageLabels()
  const label = typeof stage === 'string' ? labels[systemId] : (stage.label ?? labels[systemId])
  // An unknown systemId (a stage renamed in the database beyond the eight the
  // app ships with) falls through to the neutral pill rather than rendering
  // unstyled text.
  const style = STAGE_ORDER.includes(systemId) ? pillStyle(systemId) : NEUTRAL
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium',
        size === 'sm' ? 'text-[10px]' : 'text-xs',
        style.bg,
        style.fg,
        className,
      )}
    >
      <span
        className={cn(
          'inline-block rounded-full',
          size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2',
          style.dot,
        )}
      />
      {label}
    </span>
  )
}
