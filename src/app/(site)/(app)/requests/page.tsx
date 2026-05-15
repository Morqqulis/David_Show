import Link from 'next/link'
import { Download, FilePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Topbar } from '@/components/app/topbar'
import { PageHeader } from '@/components/app/page-header'
import { StagePillBar } from '@/components/app/stage-pill-bar'
import { StickyFilterBar } from '@/components/app/sticky-filter-bar'
import { InvoiceTable } from '@/components/app/invoice-table'
import { PaginationBar } from '@/components/app/pagination-bar'
import { listInvoices, getStageCounts } from '@/backend/lib/queries'

export const dynamic = 'force-dynamic'

type SearchParams = { q?: string; vendor?: string; batch?: string; flag?: string; page?: string }

export default async function AllRequestsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const page = params.page ? Math.max(1, parseInt(params.page, 10) || 1) : 1
  // Run independent queries in parallel — saves ~300ms+ per page render.
  const [counts, result] = await Promise.all([
    getStageCounts(),
    listInvoices({
      search: params.q,
      vendor: params.vendor,
      batch: params.batch,
      flags: params.flag ? ([params.flag] as never) : undefined,
      page,
    }),
  ])

  const exportQs = new URLSearchParams(
    Object.entries({ q: params.q, vendor: params.vendor, batch: params.batch, flag: params.flag })
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => [k, String(v)]) as [string, string][],
  ).toString()

  return (
    <>
      <Topbar crumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'All Requests' }]} />
      <main className="flex flex-1 flex-col overflow-y-auto px-8 pb-8">
        <StickyFilterBar>
          <PageHeader
            title="All Requests"
            description={`${result.totalDocs} invoices · master list across every stage`}
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
          <StagePillBar counts={counts} activeStage="all" />
          <FiltersRow initialSearch={params.q ?? ''} initialFlag={params.flag ?? ''} />
        </StickyFilterBar>

        <div className="space-y-4 pt-4">
          <InvoiceTable rows={result.docs as never} />
          <PaginationBar
            page={result.page}
            totalPages={result.totalPages}
            totalDocs={result.totalDocs}
            pageSize={result.pageSize}
            basePath="/requests"
          />
        </div>
      </main>
    </>
  )
}

function FiltersRow({ initialSearch, initialFlag }: { initialSearch: string; initialFlag: string }) {
  return (
    <form className="flex flex-wrap items-center gap-2" action="/requests" method="get">
      <Input
        name="q"
        defaultValue={initialSearch}
        placeholder="Search by invoice #, vendor, batch…"
        className="h-9 w-80"
      />
      <NativeSelect name="flag" defaultValue={initialFlag} className="h-9">
        <option value="">All flags</option>
        <option value="archiveFailed">Archive failed</option>
        <option value="possibleDuplicate">Possible duplicate</option>
        <option value="ocrFailed">OCR failed</option>
        <option value="noAttachment">No attachment</option>
        <option value="vendorSetupRequired">Vendor setup required</option>
      </NativeSelect>
      <Button type="submit" variant="outline" size="sm" className="h-9">
        Apply
      </Button>
    </form>
  )
}
