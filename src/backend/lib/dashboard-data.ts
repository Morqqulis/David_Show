import { unstable_cache } from 'next/cache'
import { getPayload } from './payload'
import { getStageCounts } from './queries'
import { MAX_PAGE_SIZE } from './queries'
import type { StageId } from './stage-ids'

export type DashboardData = {
  counts: Record<StageId | 'all', number>
  recentInvoices: Array<{
    id: string | number
    invoiceNumber: string
    vendor?: { name?: string }
    grandTotal: number
    currentStage?: { systemId: StageId; label?: string }
    updatedAt: string
  }>
  recentAudit: Array<{
    id: string | number
    action: string
    createdAt: string
    invoice?: { invoiceNumber?: string; id?: string | number }
    actor?: { name?: string }
  }>
  totals: {
    open: number
    openValue: number
    openValueIsEstimate: boolean
    dueSoon: number
    archiveFailed: number
  }
}

// Cap how many invoices we summarise for the dashboard "Open value" KPI.
// At this size the page renders fast even on small Vercel instances.
// Above the cap we mark the value as an estimate (still useful, but flagged).
const OPEN_VALUE_SAMPLE_CAP = MAX_PAGE_SIZE * 4 // 200

/**
 * Wrapped in `unstable_cache` with TTL 30s and tag 'invoices'. Page nav back
 * to /dashboard within that window hits the cache (no DB queries). Mutations
 * call `revalidateTag('invoices')` to drop the cache immediately on changes.
 */
export const getDashboardData = unstable_cache(
  async function getDashboardData(): Promise<DashboardData> {
  const payload = await getPayload()
  const sevenDays = new Date()
  sevenDays.setDate(sevenDays.getDate() + 7)

  const [counts, recent, audit, open, openSample, dueSoon, archiveFailed] = await Promise.all([
    getStageCounts(),
    payload.find({
      collection: 'invoices',
      depth: 2,
      sort: '-updatedAt',
      limit: 6,
      where: { softDeleted: { not_equals: true } },
    }),
    payload.find({
      collection: 'audit-events',
      sort: '-createdAt',
      depth: 2,
      limit: 8,
    }),
    payload.count({
      collection: 'invoices',
      where: {
        and: [
          { 'currentStage.systemId': { not_in: ['completed'] } },
          { softDeleted: { not_equals: true } },
        ],
      },
    }),
    payload.find({
      collection: 'invoices',
      depth: 0,
      limit: OPEN_VALUE_SAMPLE_CAP,
      sort: '-grandTotal',
      where: {
        and: [
          { 'currentStage.systemId': { not_in: ['completed'] } },
          { softDeleted: { not_equals: true } },
        ],
      },
    }),
    payload.count({
      collection: 'invoices',
      where: {
        and: [
          { dueDate: { less_than_equal: sevenDays.toISOString() } },
          { softDeleted: { not_equals: true } },
          { 'currentStage.systemId': { not_in: ['completed'] } },
        ],
      },
    }),
    payload.count({
      collection: 'invoices',
      where: { 'flags.archiveFailed': { equals: true } },
    }),
  ])

  const openValue = (openSample.docs as Array<{ grandTotal?: number }>).reduce(
    (acc, x) => acc + (x.grandTotal ?? 0),
    0,
  )

  return {
    counts,
    recentInvoices: recent.docs as never,
    recentAudit: audit.docs as never,
    totals: {
      open: open.totalDocs,
      openValue,
      openValueIsEstimate: open.totalDocs > OPEN_VALUE_SAMPLE_CAP,
      dueSoon: dueSoon.totalDocs,
      archiveFailed: archiveFailed.totalDocs,
    },
  }
  },
  ['dashboard-data'],
  { tags: ['invoices'], revalidate: 30 },
)
