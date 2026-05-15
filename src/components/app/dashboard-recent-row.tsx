'use client'

import Link from 'next/link'
import { StageBadge } from './stage-badge'
import { Money } from './money'
import { formatRelative } from '@/backend/lib/formatting'
import type { StageId } from '@/backend/lib/stage-ids'
import { usePrefetchInvoice } from '@/hooks/use-ap-queries'

export type RecentRowData = {
  id: string | number
  invoiceNumber: string
  vendor?: { name?: string }
  grandTotal: number
  currentStage?: { systemId: StageId; label?: string }
  updatedAt: string
}

export function DashboardRecentRow({ inv }: { inv: RecentRowData }) {
  const prefetch = usePrefetchInvoice()
  return (
    <Link
      href={`/requests/${inv.id}`}
      onMouseEnter={() => prefetch(inv.id)}
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
