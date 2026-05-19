'use client'

import { useEffect, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { InvoiceTable } from '@/components/app/invoice-table'
import { PaginationBar } from '@/components/app/pagination-bar'
import { STAGE_LABELS, STAGE_ORDER, type StageId } from '@/backend/lib/stage-ids'
import type { InvoiceListResult } from '@/backend/lib/queries'
import { useRequestsTab } from '@/stores/use-requests-tab'
import { useEffectiveCounts, type StageCounts } from '@/stores/use-effective-counts'
import { useRequestsFilters, type InvoiceFlagFilter } from '@/stores/use-requests-filters'

type Doc = InvoiceListResult['docs'][number]

export type RequestsTabsProps = {
  active: Doc[]
  completed: InvoiceListResult
  /** From `?tab=` on initial server render — seeds the store on mount. */
  initialTab: StageId | 'all'
}

/**
 * Single-page Tabs UX for invoices.
 *
 * Everything that doesn't require a server roundtrip is derived from the
 * `active` array in memory:
 *  - Active tab switches: just toggle the Zustand-backed `tab` value.
 *  - Filters (search / flag): client-side predicate applied to `active` and
 *    the currently-loaded completed page. Apply feels instant.
 *  - Tab counts + Sidebar counts: recomputed from the same filtered array
 *    in the same React commit (no lag between the table and the chrome).
 *
 * Server still owns: completed pagination, full historical archive search
 * (intentionally not implemented yet — flag for later if a customer needs it).
 */
export function RequestsTabs({ active, completed, initialTab }: RequestsTabsProps) {
  const pathname = usePathname()
  const tab = useRequestsTab((s) => s.tab)
  const setTab = useRequestsTab((s) => s.setTab)
  const setEffectiveCounts = useEffectiveCounts((s) => s.setCounts)
  const q = useRequestsFilters((s) => s.q)
  const flag = useRequestsFilters((s) => s.flag)

  // Seed tab from URL on mount (deep-link support).
  useEffect(() => {
    setTab(initialTab)
  }, [initialTab, setTab])

  // Filter `active` array in memory. Same predicate is used for both the
  // grouped per-stage view and the recomputed counts.
  const filteredActive = useMemo(() => filterRows(active, q, flag), [active, q, flag])
  const filteredCompleted = useMemo(() => filterRows(completed.docs, q, flag), [completed.docs, q, flag])

  // Recompute counts from filtered data — these flow back to TabsTrigger
  // badges and to Sidebar via the effective-counts store.
  const counts = useMemo<StageCounts>(() => {
    const out: StageCounts = {
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
    for (const row of filteredActive) {
      const sysId = (row as { currentStage?: { systemId?: StageId } }).currentStage?.systemId
      if (!sysId) continue
      out[sysId] += 1
    }
    // Completed: only the visible page is in memory, so reflect filter on
    // that subset. We do NOT pretend to know historical completed totals
    // under a client filter.
    out.completed = filteredCompleted.length
    out.all = filteredActive.length + out.completed
    return out
  }, [filteredActive, filteredCompleted])

  // Publish filtered counts to the shared store so Sidebar reflects them.
  useEffect(() => {
    setEffectiveCounts(counts)
    return () => setEffectiveCounts(null)
  }, [counts, setEffectiveCounts])

  // Group filtered active by stage.
  const byStage = useMemo(() => {
    const map: Partial<Record<StageId, Doc[]>> = {}
    for (const row of filteredActive) {
      const sysId = (row as { currentStage?: { systemId?: StageId } }).currentStage?.systemId
      if (!sysId) continue
      if (!map[sysId]) map[sysId] = []
      map[sysId]!.push(row)
    }
    return map
  }, [filteredActive])

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as StageId | 'all')} className="space-y-4">
      <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
        <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          All <CountBadge>{counts.all}</CountBadge>
        </TabsTrigger>
        {STAGE_ORDER.map((s) => (
          <TabsTrigger
            key={s}
            value={s}
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            {STAGE_LABELS[s]} <CountBadge>{counts[s]}</CountBadge>
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="all" className="m-0">
        <InvoiceTable rows={filteredActive as never} />
      </TabsContent>

      {STAGE_ORDER.filter((s) => s !== 'completed').map((s) => (
        <TabsContent key={s} value={s} className="m-0">
          <InvoiceTable rows={(byStage[s] ?? []) as never} showStageColumn={false} />
        </TabsContent>
      ))}

      <TabsContent value="completed" className="m-0 space-y-4">
        <InvoiceTable rows={filteredCompleted as never} showStageColumn={false} />
        <PaginationBar
          page={completed.page}
          totalPages={completed.totalPages}
          totalDocs={completed.totalDocs}
          pageSize={completed.pageSize}
          basePath={pathname}
        />
      </TabsContent>
    </Tabs>
  )
}

function filterRows(rows: Doc[], q: string, flag: InvoiceFlagFilter): Doc[] {
  if (!q && !flag) return rows
  const needle = q.trim().toLowerCase()
  return rows.filter((row) => {
    if (flag) {
      const flags = (row as { flags?: Record<string, unknown> }).flags ?? {}
      if (!flags[flag]) return false
    }
    if (needle) {
      const r = row as {
        invoiceNumber?: string
        poNumber?: string
        vendor?: { name?: string }
        batch?: { number?: string }
      }
      const hay = [
        r.invoiceNumber,
        r.poNumber,
        r.vendor?.name,
        r.batch?.number,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!hay.includes(needle)) return false
    }
    return true
  })
}

function CountBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1 rounded-full bg-muted px-1.5 py-px text-[10px] tabular-nums font-semibold text-muted-foreground group-data-[state=active]:bg-primary-foreground/20 group-data-[state=active]:text-primary-foreground">
      {children}
    </span>
  )
}
