import Link from 'next/link'
import { Download, FilePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Topbar } from '@/components/app/topbar'
import { PageHeader } from '@/components/app/page-header'
import { StickyFilterBar } from '@/components/app/sticky-filter-bar'
import { RequestsTabs } from '@/components/app/requests/requests-tabs'
import { FiltersRow } from '@/components/app/requests/filters-row'
import { fetchInvoicesForTabs } from '@/backend/lib/queries'
import type { StageId } from '@/backend/lib/stage-ids'
import { STAGE_ORDER } from '@/backend/lib/stage-ids'

export const dynamic = 'force-dynamic'

type SearchParams = {
  q?: string
  flag?: string
  tab?: string
  completedPage?: string
}

export default async function AllRequestsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const completedPage = params.completedPage ? Math.max(1, parseInt(params.completedPage, 10) || 1) : 1

  // Server returns ALL active invoices + first page of completed, unfiltered.
  // Client applies q/flag filters in memory and recomputes counts. Server
  // doesn't even read `?q=` / `?flag=` for the data fetch — those URL params
  // exist only to deep-link the initial filter state into the client store.
  const { active, completed } = await fetchInvoicesForTabs({ completedPage })

  // Export CSV still hits server with the URL filters, so it works regardless
  // of the client filter state (server applies them at query time).
  const exportQs = new URLSearchParams(
    Object.entries({ q: params.q, flag: params.flag })
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => [k, String(v)]) as [string, string][],
  ).toString()

  const urlTab = resolveUrlTab(params.tab)

  return (
    <>
      <Topbar crumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'All Requests' }]} />
      <main className="flex flex-1 flex-col overflow-y-auto px-8 pb-8">
        <StickyFilterBar>
          <PageHeader
            title="All Requests"
            description="Master list across every stage — switch tabs or apply filters to narrow"
            actions={
              <>
                <Button asChild>
                  <Link href="/new">
                    <FilePlus className="h-4 w-4" />
                    New invoice
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <a href={`/api/export/invoices${exportQs ? `?${exportQs}` : ''}`}>
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
          <RequestsTabs active={active} completed={completed} urlTab={urlTab} />
        </div>
      </main>
    </>
  )
}

// Returns `undefined` for missing/invalid values so the client can distinguish
// "URL says jump to this tab" from "URL is silent — trust the store". The
// latter matters on browser back-nav: re-seeding from a default-empty URL was
// clobbering whatever tab the user had selected before they drilled into an
// invoice.
function resolveUrlTab(raw: string | undefined): StageId | 'all' | undefined {
  if (!raw) return undefined
  if (raw === 'all') return 'all'
  return (STAGE_ORDER as readonly string[]).includes(raw) ? (raw as StageId) : undefined
}
