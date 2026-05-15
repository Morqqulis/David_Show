import { SidebarNav } from '@/components/app/sidebar-nav'
import { getAlertsCount, getStageCounts } from '@/backend/lib/queries'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [counts, alertsCount] = await Promise.all([
    safeStageCounts(),
    safeAlertsCount(),
  ])
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <aside className="w-[240px] shrink-0 border-r border-border bg-sidebar text-sidebar-foreground">
        <SidebarNav
          queueCounts={{
            tba: counts.to_be_assigned,
            tbc: counts.to_be_coded,
            cap: counts.conditional_approvals,
            apr: counts.ap_review,
            rfp: counts.ready_for_processing,
            prc: counts.processed,
            trv: counts.treasurer_review,
            cmp: counts.completed,
            all: counts.all,
          }}
          alertsCount={alertsCount}
        />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  )
}

async function safeStageCounts() {
  try {
    return await getStageCounts()
  } catch {
    return {
      all: 0,
      to_be_assigned: 0,
      to_be_coded: 0,
      conditional_approvals: 0,
      ap_review: 0,
      ready_for_processing: 0,
      processed: 0,
      treasurer_review: 0,
      completed: 0,
    }
  }
}

async function safeAlertsCount() {
  try {
    return await getAlertsCount()
  } catch {
    return 0
  }
}
