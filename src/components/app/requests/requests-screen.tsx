'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { InvoiceTable, type InvoiceRow } from '@/components/app/invoice-table'
import type { ColumnFilterOption } from '@/components/app/invoice-table/column-filter'
import { PaginationBar } from '@/components/app/pagination-bar'
import type { InvoiceColumn, SavedViewSpec } from '@/backend/lib/invoice-filters'
import type { SavedViewRecord } from '@/backend/lib/queries'
import { useRequestsTab, type RequestsTab } from '@/stores/use-requests-tab'
import { useEffectiveCounts, type StageCounts } from '@/stores/use-effective-counts'
import { RequestsTabsList } from './requests-tabs'
import { SavedViewsBar } from './saved-views-bar'
import { defaultSpec, specsEqual, writeSpec } from './view-spec-url'

export type RequestsScreenProps = {
  rows: InvoiceRow[]
  counts: StageCounts
  pagination: { page: number; totalPages: number; totalDocs: number; pageSize: number }
  columns: InvoiceColumn[]
  filterOptions: Record<string, ColumnFilterOption[]>
  savedViews: SavedViewRecord[]
  roles: Array<{ id: string | number; name: string }>
  /** The arrangement the server just answered with, read out of the URL. */
  spec: SavedViewSpec
  activeViewId: string | null
}

function toSpec(view: SavedViewRecord): SavedViewSpec {
  return {
    stage: view.stage,
    columns: view.columns,
    columnOrder: view.columnOrder,
    filters: view.filters,
    sort: view.sort,
  }
}

/**
 * Owns the All Requests screen.
 *
 * The URL carries the whole arrangement — stage, columns, column order,
 * filters, sort, page — and the server answers with the rows and counts that
 * match it. Filtering therefore covers every invoice rather than the page that
 * happens to be loaded. A local copy of the arrangement keeps the controls
 * instant while the server catches up.
 */
export function RequestsScreen({
  rows,
  counts,
  pagination,
  columns,
  filterOptions,
  savedViews,
  roles,
  spec: serverSpec,
  activeViewId,
}: RequestsScreenProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [spec, setSpec] = useState<SavedViewSpec>(serverSpec)
  const [viewId, setViewId] = useState<string | null>(activeViewId)
  const [views, setViews] = useState<SavedViewRecord[]>(savedViews)

  // Adopt whatever the server answered with whenever it genuinely differs —
  // browser back/forward, a deep link, a stage switch.
  const serverFingerprint = JSON.stringify(serverSpec)
  const lastServerFingerprint = useRef(serverFingerprint)
  useEffect(() => {
    if (lastServerFingerprint.current !== serverFingerprint) {
      lastServerFingerprint.current = serverFingerprint
      setSpec(JSON.parse(serverFingerprint) as SavedViewSpec)
      setViewId(activeViewId)
    }
  }, [serverFingerprint, activeViewId])

  // Counts and rows arrive in the same response, so the sidebar badge and the
  // table body are published in the same React commit and cannot disagree.
  const setEffectiveCounts = useEffectiveCounts((s) => s.setCounts)
  useEffect(() => {
    setEffectiveCounts(counts)
    return () => setEffectiveCounts(null)
  }, [counts, setEffectiveCounts])

  const setTab = useRequestsTab((s) => s.setTab)

  function push(next: SavedViewSpec, options: { viewId?: string | null; page?: number }) {
    const params = writeSpec(new URLSearchParams(searchParams.toString()), next, columns, options)
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  function applySpec(next: SavedViewSpec) {
    setSpec(next)
    push(next, { viewId })
  }

  /** A view belongs to the stage it was built on, so changing stage steps off it. */
  function applyStage(stage: string) {
    if (stage === serverSpec.stage) return
    const next = defaultSpec(stage, columns)
    setTab(stage as RequestsTab)
    setViewId(null)
    setSpec(next)
    push(next, { viewId: null })
  }

  // Only the latest callback is held in a ref, and only an effect ever writes
  // it. An earlier version also kept the current stage in a ref, written from
  // three places and read from a subscription; under the React Compiler that
  // is a tracked-mutation hazard rather than a harmless shortcut, and the
  // compiler lint says so. The stage is a prop-derived value, so the
  // subscription can close over it and re-subscribe when the server answers on
  // a different one.
  const applyStageRef = useRef(applyStage)
  useEffect(() => {
    applyStageRef.current = applyStage
  })

  // Keep the shared store aligned with the stage the server answered on, so
  // the sidebar highlight follows a deep link or a back/forward step.
  useEffect(() => {
    setTab(serverSpec.stage as RequestsTab)
  }, [serverSpec.stage, setTab])

  // The sidebar queue buttons change the shared store instead of navigating.
  // Subscribing rather than reading the value means the initial store value is
  // never mistaken for a click.
  useEffect(() => {
    return useRequestsTab.subscribe((state, previous) => {
      if (state.tab === previous.tab) return
      if (state.tab !== serverSpec.stage) applyStageRef.current(state.tab)
    })
  }, [serverSpec.stage])

  function applyView(view: SavedViewRecord | null) {
    const next = view ? toSpec(view) : defaultSpec(spec.stage, columns)
    setTab(next.stage as RequestsTab)
    setViewId(view ? String(view.id) : null)
    setSpec(next)
    push(next, { viewId: view ? String(view.id) : null })
  }

  const activeView = views.find((v) => String(v.id) === viewId) ?? null
  const isDirty = activeView ? !specsEqual(spec, toSpec(activeView)) : false

  return (
    <Tabs value={spec.stage} onValueChange={applyStage} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RequestsTabsList counts={counts} />
        <SavedViewsBar
          views={views}
          roles={roles}
          activeView={activeView}
          spec={spec}
          isDirty={isDirty}
          onViewsChange={setViews}
          onApply={applyView}
        />
      </div>

      <TabsContent value={spec.stage} className="m-0 space-y-4">
        <InvoiceTable
          rows={rows}
          columns={columns}
          spec={spec}
          filterOptions={filterOptions}
          onSpecChange={applySpec}
          isPending={isPending}
        />
        <PaginationBar
          page={pagination.page}
          totalPages={pagination.totalPages}
          totalDocs={pagination.totalDocs}
          pageSize={pagination.pageSize}
          basePath={pathname}
        />
      </TabsContent>
    </Tabs>
  )
}
