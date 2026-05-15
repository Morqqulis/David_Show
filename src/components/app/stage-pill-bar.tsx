'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { STAGE_LABELS, STAGE_ORDER, type StageId } from '@/backend/lib/stage-ids'

type Counts = Partial<Record<StageId, number>> & { all?: number }

export function StagePillBar({
  counts,
  basePath = '/requests',
  activeStage,
}: {
  counts: Counts
  basePath?: string
  activeStage?: StageId | 'all'
}) {
  const pathname = usePathname()
  const params = useSearchParams()
  const stageParam = (params.get('stage') as StageId | null) ?? null
  const active = activeStage ?? (pathname?.startsWith('/queues/') ? (pathname.split('/')[2] as StageId) : stageParam ?? 'all')

  const items: { id: StageId | 'all'; label: string; count?: number }[] = [
    { id: 'all', label: 'All', count: counts.all },
    ...STAGE_ORDER.map((s) => ({ id: s, label: STAGE_LABELS[s], count: counts[s] })),
  ]

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
      {items.map((item) => {
        const isActive = active === item.id
        const href =
          item.id === 'all'
            ? basePath === '/requests'
              ? '/requests'
              : `${basePath}`
            : basePath === '/requests'
              ? `/queues/${item.id}`
              : `/queues/${item.id}`
        return (
          <Link
            key={item.id}
            href={href}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              isActive
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background hover:bg-muted',
            )}
          >
            <span>{item.label}</span>
            {item.count != null ? (
              <span
                className={cn(
                  'rounded-full px-1.5 py-px text-[10px] tabular-nums font-semibold',
                  isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                {item.count}
              </span>
            ) : null}
          </Link>
        )
      })}
    </div>
  )
}
