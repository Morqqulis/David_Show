import Link from 'next/link'
import { Topbar } from '@/components/app/topbar'
import { PageHeader } from '@/components/app/page-header'
import { StageBadge } from '@/components/app/stage-badge'
import { Money } from '@/components/app/money'
import { DashboardRecentRow } from '@/components/app/dashboard-recent-row'
import { getPayload } from '@/backend/lib/payload'
import { getStageCounts } from '@/backend/lib/queries'
import { STAGE_LABELS, STAGE_ORDER, type StageId } from '@/backend/lib/stage-ids'
import { formatRelative } from '@/backend/lib/formatting'
import { ArrowUpRight, FilePlus, Inbox, ListChecks, Receipt, Database } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const payload = await getPayload()

  let counts
  let recentInvoices: Array<{
    id: string | number
    invoiceNumber: string
    vendor?: { name?: string }
    grandTotal: number
    currentStage?: { systemId: StageId; label?: string }
    updatedAt: string
  }> = []
  let recentAudit: Array<{
    id: string | number
    action: string
    createdAt: string
    invoice?: { invoiceNumber?: string; id?: string | number }
    actor?: { name?: string }
  }> = []
  let totals = { open: 0, openValue: 0, dueSoon: 0, archiveFailed: 0 }

  try {
    counts = await getStageCounts()
    const recent = await payload.find({
      collection: 'invoices',
      depth: 2,
      sort: '-updatedAt',
      limit: 6,
      where: { softDeleted: { not_equals: true } },
    })
    recentInvoices = recent.docs as never

    const audit = await payload.find({
      collection: 'audit-events',
      sort: '-createdAt',
      depth: 2,
      limit: 8,
    })
    recentAudit = audit.docs as never

    const open = await payload.find({
      collection: 'invoices',
      depth: 0,
      limit: 0,
      where: {
        and: [
          { 'currentStage.systemId': { not_in: ['completed'] } },
          { softDeleted: { not_equals: true } },
        ],
      },
    })
    totals.open = open.totalDocs

    const valueAgg = await payload.find({
      collection: 'invoices',
      depth: 0,
      limit: 1000,
      where: { softDeleted: { not_equals: true } },
    })
    totals.openValue = (valueAgg.docs as Array<{ grandTotal: number; currentStage?: { systemId?: StageId } }>).reduce(
      (acc, x) => (x.currentStage && x.currentStage.systemId !== 'completed' ? acc + (x.grandTotal ?? 0) : acc),
      0,
    )

    const sevenDays = new Date()
    sevenDays.setDate(sevenDays.getDate() + 7)
    const dueSoon = await payload.count({
      collection: 'invoices',
      where: {
        and: [
          { dueDate: { less_than_equal: sevenDays.toISOString() } },
          { softDeleted: { not_equals: true } },
          { 'currentStage.systemId': { not_in: ['completed'] } },
        ],
      },
    })
    totals.dueSoon = dueSoon.totalDocs

    const archiveFailed = await payload.count({
      collection: 'invoices',
      where: { 'flags.archiveFailed': { equals: true } },
    })
    totals.archiveFailed = archiveFailed.totalDocs
  } catch (err) {
    return (
      <>
        <Topbar crumbs={[{ label: 'Home' }]} />
        <main className="flex-1 overflow-y-auto p-8">
          <SeedPrompt error={(err as Error).message} />
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
              <Link
                href="/new"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <FilePlus className="h-4 w-4" />
                New invoice
              </Link>
              <Link
                href="/requests"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
              >
                All requests
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </>
          }
        />

        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiCard icon={<Receipt className="h-4 w-4" />} label="Open invoices" value={totals.open.toString()} hint="across all active stages" />
          <KpiCard icon={<Database className="h-4 w-4" />} label="Open value" value={<Money value={totals.openValue} />} hint="not yet completed" />
          <KpiCard icon={<Inbox className="h-4 w-4" />} label="Due within 7 days" value={totals.dueSoon.toString()} tone={totals.dueSoon > 0 ? 'warning' : 'default'} />
          <KpiCard icon={<ListChecks className="h-4 w-4" />} label="Archive failures" value={totals.archiveFailed.toString()} tone={totals.archiveFailed > 0 ? 'danger' : 'default'} />
        </div>

        {/* Queue tiles */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Workflow at a glance</h2>
            <Link href="/requests" className="text-xs text-primary hover:underline">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {STAGE_ORDER.map((s) => (
              <Link
                key={s}
                href={`/queues/${s}`}
                className="group flex flex-col gap-1 rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-sm"
              >
                <StageBadge stage={s} size="sm" />
                <div className="mt-2 flex items-end justify-between">
                  <span className="text-3xl font-semibold tabular-nums">{counts![s]}</span>
                  <span className="text-xs text-muted-foreground">
                    {counts![s] === 1 ? 'invoice' : 'invoices'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Two columns: recent invoices + activity */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">Recently updated</h3>
              <Link href="/requests" className="text-xs text-primary hover:underline">
                Browse all →
              </Link>
            </div>
            <div className="divide-y divide-border">
              {recentInvoices.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No invoices yet.</div>
              ) : (
                recentInvoices.map((inv) => <DashboardRecentRow key={String(inv.id)} inv={inv as never} />)
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">Recent activity</h3>
            </div>
            <div className="divide-y divide-border">
              {recentAudit.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No activity yet.</div>
              ) : (
                recentAudit.map((evt) => (
                  <div key={String(evt.id)} className="flex items-start gap-3 px-4 py-3">
                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold uppercase">
                      {(evt.actor?.name ?? '·').slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm">
                        <span className="font-medium">{evt.actor?.name ?? 'System'}</span>{' '}
                        <span className="text-muted-foreground">{humanizeAction(evt.action)}</span>{' '}
                        {evt.invoice?.invoiceNumber ? (
                          <Link href={`/requests/${evt.invoice.id}`} className="font-medium text-primary hover:underline">
                            {evt.invoice.invoiceNumber}
                          </Link>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{formatRelative(evt.createdAt)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>
    </>
  )
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  tone = 'default',
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  hint?: string
  tone?: 'default' | 'warning' | 'danger'
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span
          className={
            tone === 'warning'
              ? 'text-amber-600'
              : tone === 'danger'
                ? 'text-red-600'
                : 'text-primary'
          }
        >
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      {hint ? <div className="text-[11px] text-muted-foreground">{hint}</div> : null}
    </div>
  )
}

function humanizeAction(action: string) {
  const map: Record<string, string> = {
    created: 'created invoice',
    updated: 'updated stage on',
    approved: 'approved',
    rejected: 'rejected',
    reassigned: 'reassigned',
    coded: 'coded lines on',
    batch_applied: 'applied batch to',
    batch_closed: 'closed batch including',
    verified: 'verified',
    unverified: 'cleared verification on',
    document_uploaded: 'uploaded document to',
    comment_added: 'commented on',
  }
  return map[action] ?? action.replace(/_/g, ' ')
}

function SeedPrompt({ error }: { error: string }) {
  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-dashed border-border bg-card p-8 text-center">
      <h2 className="text-lg font-semibold">Database not seeded</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Looks like the AP Invoice tables don't have demo data yet. POST <code className="rounded bg-muted px-1.5 py-0.5">/api/seed</code> to populate Aurora.
      </p>
      <pre className="mt-4 overflow-x-auto rounded bg-muted/50 p-3 text-left text-xs">{error}</pre>
      <form action="/api/seed" method="post" className="mt-4">
        <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          Run seed now
        </button>
      </form>
    </div>
  )
}
