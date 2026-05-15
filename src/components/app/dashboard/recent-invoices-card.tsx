import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardRecentRow, type RecentRowData } from '../dashboard-recent-row'

export function RecentInvoicesCard({ rows }: { rows: RecentRowData[] }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
        <CardTitle className="text-sm">Recently updated</CardTitle>
        <Link href="/requests" className="text-xs text-primary hover:underline">
          Browse all →
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No invoices yet.</div>
          ) : (
            rows.map((inv) => <DashboardRecentRow key={String(inv.id)} inv={inv} />)
          )}
        </div>
      </CardContent>
    </Card>
  )
}
