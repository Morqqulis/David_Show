import { notFound } from 'next/navigation'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Topbar } from '@/components/app/topbar'
import { PageHeader } from '@/components/app/page-header'
import { StagePillBar } from '@/components/app/stage-pill-bar'
import { StickyFilterBar } from '@/components/app/sticky-filter-bar'
import { InvoiceTable } from '@/components/app/invoice-table'
import { PaginationBar } from '@/components/app/pagination-bar'
import { listInvoices, getStageCounts } from '@/backend/lib/queries'
import { STAGE_LABELS, STAGE_ORDER, type StageId } from '@/backend/lib/stage-ids'

export const dynamic = 'force-dynamic'

const STAGE_DESCRIPTIONS: Record<StageId, string> = {
  to_be_assigned: 'Intake landing zone — assign to one or more reviewers to begin coding.',
  to_be_coded: 'Reviewers code lines and approve. Multi-recipient: all must approve, only one needs to code.',
  conditional_approvals: 'Rule-routed approvers above thresholds. Auto-skipped when no rules match.',
  ap_review: 'Final finance gate before processing. AP can edit any field or reject back.',
  ready_for_processing: 'AP assigns batch numbers and exports CSV for ERP import.',
  processed: 'Imported into the ERP. AP confirms readiness for treasurer.',
  treasurer_review: 'Spot-check by treasurer. Verify individuals and close the batch when satisfied.',
  completed: 'Terminal state. Auto-archived to SharePoint document set.',
}

type SearchParams = { page?: string }

export default async function QueuePage({
  params,
  searchParams,
}: {
  params: Promise<{ stageId: StageId }>
  searchParams: Promise<SearchParams>
}) {
  const { stageId } = await params
  const sp = await searchParams
  if (!STAGE_ORDER.includes(stageId)) notFound()
  const page = sp.page ? Math.max(1, parseInt(sp.page, 10) || 1) : 1

  // Parallel independent queries — saves a roundtrip on Vercel Postgres.
  const [counts, result] = await Promise.all([
    getStageCounts(),
    listInvoices({ stage: stageId, page }),
  ])

  return (
    <>
      <Topbar
        crumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Queues' },
          { label: STAGE_LABELS[stageId] },
        ]}
      />
      <main className="flex flex-1 flex-col overflow-y-auto px-8 pb-8">
        <StickyFilterBar>
          <PageHeader
            title={STAGE_LABELS[stageId]}
            description={STAGE_DESCRIPTIONS[stageId]}
            actions={
              <Button asChild variant="outline">
                <a href={`/api/export/invoices?stage=${stageId}`}>
                  <Download className="h-4 w-4" />
                  Export CSV
                </a>
              </Button>
            }
          />
          <StagePillBar counts={counts} activeStage={stageId} />
          <div className="text-sm text-muted-foreground">
            {result.totalDocs} {result.totalDocs === 1 ? 'invoice' : 'invoices'} in this queue
          </div>
        </StickyFilterBar>

        <div className="space-y-4 pt-4">
          <InvoiceTable rows={result.docs as never} showStageColumn={false} />
          <PaginationBar
            page={result.page}
            totalPages={result.totalPages}
            totalDocs={result.totalDocs}
            pageSize={result.pageSize}
            basePath={`/queues/${stageId}`}
          />
        </div>
      </main>
    </>
  )
}
