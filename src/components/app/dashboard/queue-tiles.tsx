'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { StageBadge } from '../stage-badge'
import { STAGE_ORDER, type StageId } from '@/backend/lib/stage-ids'
import { useRequestsTab } from '@/stores/use-requests-tab'

export function QueueTiles({ counts }: { counts: Record<StageId | 'all', number> }) {
  const router = useRouter()
  const pathname = usePathname()
  const setTab = useRequestsTab((s) => s.setTab)

  function openStage(stage: StageId) {
    setTab(stage)
    if (pathname !== '/requests' && !pathname?.startsWith('/requests/')) {
      router.push('/requests')
    }
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
