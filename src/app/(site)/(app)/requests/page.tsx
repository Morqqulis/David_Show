import { Topbar } from '@/components/app/topbar'
import { PageHeader } from '@/components/app/page-header'
import { StagePillBar } from '@/components/app/stage-pill-bar'
import { InvoiceTable } from '@/components/app/invoice-table'
import { listInvoices, getStageCounts } from '@/backend/lib/queries'
import Link from 'next/link'
import { Download, FilePlus } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AllRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; vendor?: string; batch?: string; flag?: string }>
}) {
  const params = await searchParams
  const counts = await getStageCounts()
  const result = await listInvoices({
    search: params.q,
    vendor: params.vendor,
    batch: params.batch,
    flags: params.flag ? ([params.flag] as never) : undefined,
    pageSize: 100,
  })

  return (
    <>
      <Topbar crumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'All Requests' }]} />
      <main className="flex flex-1 flex-col overflow-y-auto p-8 space-y-4">
        <PageHeader
          title="All Requests"
          description={`${result.totalDocs} invoices · master list across every stage`}
          actions={
            <>
              <Link
                href="/new"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <FilePlus className="h-4 w-4" />
                New invoice
              </Link>
              <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted">
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </>
          }
        />

        <StagePillBar counts={counts} activeStage="all" />

        <FiltersRow initialSearch={params.q ?? ''} />

        <InvoiceTable rows={result.docs as never} />
      </main>
    </>
  )
}

function FiltersRow({ initialSearch }: { initialSearch: string }) {
  return (
    <form className="flex flex-wrap items-center gap-2" action="/requests" method="get">
      <input
        name="q"
        defaultValue={initialSearch}
        placeholder="Search by invoice #, vendor, batch…"
        className="h-9 w-80 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
      />
      <select
        name="flag"
        className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        defaultValue=""
      >
        <option value="">All flags</option>
        <option value="archiveFailed">Archive failed</option>
        <option value="possibleDuplicate">Possible duplicate</option>
        <option value="ocrFailed">OCR failed</option>
        <option value="noAttachment">No attachment</option>
        <option value="vendorSetupRequired">Vendor setup required</option>
      </select>
      <button className="h-9 rounded-md border border-border bg-background px-3 text-sm hover:bg-muted">
        Apply
      </button>
    </form>
  )
}
