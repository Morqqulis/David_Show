import { notFound } from 'next/navigation'
import { Download } from 'lucide-react'
import { Topbar } from '@/components/app/topbar'
import { PageHeader } from '@/components/app/page-header'
import { StagePillBar } from '@/components/app/stage-pill-bar'
import { InvoiceTable } from '@/components/app/invoice-table'
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

export default async function QueuePage({
  params,
}: {
  params: Promise<{ stageId: StageId }>
}) {
  const { stageId } = await params
  if (!STAGE_ORDER.includes(stageId)) notFound()

  const counts = await getStageCounts()
  const result = await listInvoices({ stage: stageId, pageSize: 100 })

  return (
    <>
      <Topbar
        crumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Queues' },
          { label: STAGE_LABELS[stageId] },
        ]}
      />
      <main className="flex flex-1 flex-col overflow-y-auto p-8 space-y-4">
        <PageHeader
          title={STAGE_LABELS[stageId]}
          description={STAGE_DESCRIPTIONS[stageId]}
          actions={
            <a
              href={`/api/export/invoices?stage=${stageId}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </a>
          }
        />
        <StagePillBar counts={counts} activeStage={stageId} />
        <div className="text-sm text-muted-foreground">
          {result.totalDocs} {result.totalDocs === 1 ? 'invoice' : 'invoices'} in this queue
        </div>
        <InvoiceTable rows={result.docs as never} showStageColumn={false} />
      </main>
    </>
  )
}
