import Link from 'next/link'
import { StageBadge } from './stage-badge'
import { Money } from './money'
import { formatRelative } from '@/backend/lib/formatting'
import type { StageId } from '@/backend/lib/stage-ids'

export type RecentRowData = {
  id: string | number
  invoiceNumber: string
  vendor?: { name?: string }
  grandTotal: number
  currentStage?: { systemId: StageId; label?: string }
  updatedAt: string
}

// Server component. We intentionally skip TanStack hover-prefetch here:
// the prefetch is a server action POST that takes 2-3s on Vercel Postgres
// and competes with the click navigation for the same connection pool.
export function DashboardRecentRow({ inv }: { inv: RecentRowData }) {
  return (
    <Link
      href={`/requests/${inv.id}`}
      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{inv.invoiceNumber}</span>
          {inv.currentStage ? <StageBadge stage={inv.currentStage as never} size="sm" /> : null}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {inv.vendor?.name ?? '—'} · updated {formatRelative(inv.updatedAt)}
        </div>
      </div>
      <Money value={inv.grandTotal} className="font-semibold" />
    </Link>
  )
}
