import { SidebarNav } from '@/components/app/sidebar-nav'
import { getAlertsCount, getStageCounts } from '@/backend/lib/queries'

export const dynamic = 'force-dynamic'

const EMPTY_COUNTS = {
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

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // SSR-hydrate the sidebar so first paint shows real numbers, then TanStack
  // polls every 30s for live updates.
  let counts = EMPTY_COUNTS
  let alerts = 0
  try {
    counts = await getStageCounts()
    alerts = await getAlertsCount()
  } catch {
    // Tables not seeded yet — sidebar starts at 0 and polls catch up.
  }
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <aside className="w-[240px] shrink-0 border-r border-border bg-sidebar text-sidebar-foreground">
        <SidebarNav initial={{ counts, alerts }} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
