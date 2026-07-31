import Link from 'next/link'
import { ArrowUpRight, FilePlus, Inbox, ListChecks, Receipt, Database } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Topbar } from '@/components/app/topbar'
import { PageHeader } from '@/components/app/page-header'
import { Money } from '@/components/app/money'
import { KpiCard } from '@/components/app/dashboard/kpi-card'
import { SeedPrompt } from '@/components/app/dashboard/seed-prompt'
import { QueueTiles } from '@/components/app/dashboard/queue-tiles'
import { ActivityFeed } from '@/components/app/dashboard/activity-feed'
import { RecentInvoicesCard } from '@/components/app/dashboard/recent-invoices-card'
import { getDashboardData } from '@/backend/lib/dashboard-data'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  // The try wraps the data read and nothing else. Wrapping the markup as well
  // is what `react-hooks/error-boundaries` objects to, and rightly: a render
  // that throws inside a try never reaches the catch, so the fallback would be
  // a promise the page could not keep.
  let data: Awaited<ReturnType<typeof getDashboardData>> | null = null
  let failure: string | null = null
  try {
    data = await getDashboardData()
  } catch (err) {
    failure = err instanceof Error ? err.message : 'The dashboard could not be loaded.'
    console.error('[dashboard] the dashboard data could not be read', { reason: failure })
  }

  if (!data) {
    return (
      <>
        <Topbar crumbs={[{ label: 'Home' }]} />
        <main className="flex-1 overflow-y-auto p-8">
          <SeedPrompt error={failure ?? 'The dashboard could not be loaded.'} />
        </main>
      </>
    )
  }

  return (
    <>
      <Topbar crumbs={[{ label: 'Home' }]} />
      <main className="flex-1 overflow-y-auto p-8 space-y-6">
        <PageHeader
          title="Welcome back, David"
          description="Here's where everything stands across Accounts Payable today."
          actions={
            <>
              <Button asChild>
                <Link href="/new">
                  <FilePlus className="h-4 w-4" />
                  New invoice
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/requests">
                  All requests
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </>
          }
        />

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiCard icon={<Receipt className="h-4 w-4" />} label="Open invoices" value={data.totals.open.toString()} hint="across all active stages" />
          <KpiCard
            icon={<Database className="h-4 w-4" />}
            label="Open value"
            value={<Money value={data.totals.openValue} />}
            hint={data.totals.openValueIsEstimate ? 'estimate of top 200' : 'not yet completed'}
          />
          <KpiCard icon={<Inbox className="h-4 w-4" />} label="Due within 7 days" value={data.totals.dueSoon.toString()} tone={data.totals.dueSoon > 0 ? 'warning' : 'default'} />
          <KpiCard icon={<ListChecks className="h-4 w-4" />} label="Archive failures" value={data.totals.archiveFailed.toString()} tone={data.totals.archiveFailed > 0 ? 'danger' : 'default'} />
        </div>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Workflow at a glance</h2>
            <Link href="/requests" className="text-xs text-primary hover:underline">
              View all →
            </Link>
          </div>
          <QueueTiles counts={data.counts} />
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <RecentInvoicesCard rows={data.recentInvoices} />
          <ActivityFeed events={data.recentAudit} />
        </section>
      </main>
    </>
  )
}
