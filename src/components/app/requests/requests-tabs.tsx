'use client'

import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { STAGE_ORDER } from '@/backend/lib/stage-ids'
import type { StageCounts } from '@/stores/use-effective-counts'
import { useStageLabels } from '@/hooks/use-stage-labels'

/**
 * The stage strip above the table.
 *
 * Counts come from the server in the same response as the rows, so a badge can
 * never disagree with the list underneath it. Labels are the admin-editable
 * ones, not the internal stage ids.
 */
export function RequestsTabsList({ counts }: { counts: StageCounts }) {
  const labels = useStageLabels()

  return (
    <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
      <TabsTrigger
        value="all"
        className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
      >
        All <CountBadge>{counts.all}</CountBadge>
      </TabsTrigger>
      {STAGE_ORDER.map((stage) => (
        <TabsTrigger
          key={stage}
          value={stage}
          className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
        >
          {labels[stage]} <CountBadge>{counts[stage]}</CountBadge>
        </TabsTrigger>
      ))}
    </TabsList>
  )
}

function CountBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1 rounded-full bg-muted px-1.5 py-px text-[10px] tabular-nums font-semibold text-muted-foreground group-data-[state=active]:bg-primary-foreground/20 group-data-[state=active]:text-primary-foreground">
      {children}
    </span>
  )
}
