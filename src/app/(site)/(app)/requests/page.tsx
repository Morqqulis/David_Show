import Link from 'next/link'
import { Download, FilePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Topbar } from '@/components/app/topbar'
import { PageHeader } from '@/components/app/page-header'
import { StickyFilterBar } from '@/components/app/sticky-filter-bar'
import { RequestsScreen } from '@/components/app/requests/requests-screen'
import { FiltersRow } from '@/components/app/requests/filters-row'
import type { ColumnFilterOption } from '@/components/app/invoice-table/column-filter'
import {
  defaultSpec,
  readPage,
  readSpec,
  readViewId,
  type RequestsParams,
} from '@/components/app/requests/view-spec-url'
import {
  fetchRequestsPage,
  getColumnFieldDocs,
  getFilterOptionSources,
  listPublishableRoles,
  listSavedViewsForActor,
} from '@/backend/lib/queries'
import {
  buildInvoiceSort,
  compileInvoiceFilters,
  resolveInvoiceColumns,
  type SavedViewSpec,
} from '@/backend/lib/invoice-filters'
import type { InvoiceListFilters, SavedViewRecord } from '@/backend/lib/queries'
import type { StageId } from '@/backend/lib/stage-ids'

export const dynamic = 'force-dynamic'

/** Params that mean "the user has arranged this screen themselves". */
const ARRANGEMENT_PARAMS = ['tab', 'cols', 'order', 'filters', 'sort', 'view', 'q', 'flag'] as const

export default async function AllRequestsPage({
  searchParams,
}: {
  searchParams: Promise<RequestsParams>
}) {
  const params = await searchParams

  const [fieldDocs, optionSources, savedViews, roles] = await Promise.all([
    getColumnFieldDocs(),
    getFilterOptionSources(),
    listSavedViewsForActor(),
    listPublishableRoles(),
  ])

  const columns = resolveInvoiceColumns(fieldDocs)

  // An untouched arrival opens on the view the user marked as their default.
  // Any arrangement in the link wins, so a shared link always shows what the
  // sender saw.
  const untouched = ARRANGEMENT_PARAMS.every((key) => !params[key])
  const defaultView = untouched ? savedViews.find((v) => v.isDefault) : undefined
  const spec = defaultView ? specOf(defaultView, columns) : readSpec(params, columns)
  const activeViewId = defaultView ? String(defaultView.id) : readViewId(params)

  const page = readPage(params)
  const flag = params.flag
  const result = await fetchRequestsPage({
    stage: spec.stage as StageId | 'all',
    search: params.q || undefined,
    flags: flag ? ([flag] as InvoiceListFilters['flags']) : undefined,
    columnClauses: compileInvoiceFilters(spec.filters, columns),
    sort: buildInvoiceSort(spec.sort, columns),
    page,
  })

  // The export answers the same question the screen is showing, so it reuses
  // the same link, parameters and all.
  const exportQs = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => typeof v === 'string' && v !== '')
      .map(([k, v]) => [k, String(v)]),
  )
  if (defaultView) {
    exportQs.set('tab', spec.stage)
    exportQs.set('cols', spec.columns.join(','))
    exportQs.set('order', spec.columnOrder.join(','))
    exportQs.set('filters', JSON.stringify(spec.filters))
    exportQs.set('sort', JSON.stringify(spec.sort))
  }

  const filterOptions: Record<string, ColumnFilterOption[]> = {
    departments: optionSources.departments,
    assignees: optionSources.assignees,
    currentStage: optionSources.stages,
  }

  return (
    <>
      <Topbar crumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'All Requests' }]} />
      <main className="flex flex-1 flex-col overflow-y-auto px-8 pb-8">
        <StickyFilterBar>
          <PageHeader
            title="All Requests"
            description="Master list across every stage — switch tabs, filter columns, or open a saved view"
            actions={
              <>
                <Button asChild>
                  <Link href="/new">
                    <FilePlus className="h-4 w-4" />
                    New invoice
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <a href={`/api/export/invoices?${exportQs.toString()}`}>
                    <Download className="h-4 w-4" />
                    Export CSV
                  </a>
                </Button>
              </>
            }
          />
          <FiltersRow urlQ={params.q} urlFlag={params.flag} />
        </StickyFilterBar>

        <div className="pt-4">
          <RequestsScreen
            rows={result.docs as never}
            counts={result.counts}
            pagination={{
              page: result.page,
              totalPages: result.totalPages,
              totalDocs: result.totalDocs,
              pageSize: result.pageSize,
            }}
            columns={columns}
            filterOptions={filterOptions}
            savedViews={savedViews}
            roles={roles}
            spec={spec}
            activeViewId={activeViewId}
          />
        </div>
      </main>
    </>
  )
}

/**
 * Turn a stored view into the arrangement the screen runs on. A view saved
 * before a column existed simply falls back to the stage default for whatever
 * it does not carry.
 */
function specOf(view: SavedViewRecord, columns: InvoiceColumnList): SavedViewSpec {
  const base = defaultSpec(view.stage, columns)
  return {
    stage: view.stage,
    columns: view.columns.length > 0 ? view.columns : base.columns,
    columnOrder: view.columnOrder.length > 0 ? view.columnOrder : base.columnOrder,
    filters: view.filters,
    sort: view.sort.length > 0 ? view.sort : base.sort,
  }
}

type InvoiceColumnList = ReturnType<typeof resolveInvoiceColumns>
