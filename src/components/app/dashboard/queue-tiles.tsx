'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { StageBadge } from '../stage-badge'
import { STAGE_ORDER, type StageId } from '@/backend/lib/stage-ids'
import { useRequestsTab } from '@/stores/use-requests-tab'
import { isRequestsListPath, requestsListHref } from '@/lib/requests-routes'

export function QueueTiles({ counts }: { counts: Record<StageId | 'all', number> }) {
  const router = useRouter()
  const pathname = usePathname()
  const setTab = useRequestsTab((s) => s.setTab)

  // Same rule as the left-hand navigation: on the list itself the screen picks
  // the change up from the shared store and keeps the user's arrangement; from
  // anywhere else the queue has to travel in the address or the server answers
  // "all" and the tile click is thrown away.
  function openStage(stage: StageId) {
    setTab(stage)
    if (!isRequestsListPath(pathname)) router.push(requestsListHref(stage))
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {STAGE_ORDER.map((s) => (
        <button key={s} type="button" onClick={() => openStage(s)} className="group text-left">
          <Card className="transition-shadow group-hover:shadow-sm">
            <CardContent className="flex flex-col gap-1 p-4">
              <StageBadge stage={s} size="sm" />
              <div className="mt-2 flex items-end justify-between">
                <span className="text-3xl font-semibold tabular-nums">{counts[s]}</span>
                <span className="text-xs text-muted-foreground">
                  {counts[s] === 1 ? 'invoice' : 'invoices'}
                </span>
              </div>
            </CardContent>
          </Card>
        </button>
      ))}
    </div>
  )
}
