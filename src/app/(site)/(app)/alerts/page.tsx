import Link from 'next/link'
import { Topbar } from '@/components/app/topbar'
import { PageHeader } from '@/components/app/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Money } from '@/components/app/money'
import { formatDate } from '@/backend/lib/formatting'
import { getPayload } from '@/backend/lib/payload'
import { RetryArchiveButton } from '@/components/app/retry-archive-button'
import { AlertTriangle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AlertsPage() {
  const payload = await getPayload()
  const res = await payload.find({
    collection: 'invoices',
    where: { 'flags.archiveFailed': { equals: true } } as never,
    depth: 1,
    sort: '-updatedAt',
    limit: 100,
  })
  const rows = res.docs as Array<{
    id: string | number
    invoiceNumber: string
    vendor?: { name: string }
    grandTotal: number
    updatedAt: string
    flags?: { archiveAttempts?: number }
  }>
  return (
    <>
      <Topbar crumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Alerts' }]} />
      <main className="flex-1 overflow-y-auto p-8 space-y-4">
        <PageHeader
          title="Alerts"
          description="System notifications that need admin attention. Currently: archive failures."
        />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" /> Archive failures
            </CardTitle>
            <CardDescription>
              These invoices completed but couldn't be archived to SharePoint after 5 retry attempts. Manual retry from here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Last attempt</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead className="w-[120px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                      No archive failures. Everything's synced.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={String(r.id)}>
                      <TableCell>
                        <Link href={`/requests/${r.id}`} className="font-medium hover:text-primary hover:underline">
                          {r.invoiceNumber}
                        </Link>
                      </TableCell>
                      <TableCell>{r.vendor?.name ?? '—'}</TableCell>
                      <TableCell className="text-right"><Money value={r.grandTotal} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(r.updatedAt)}</TableCell>
                      <TableCell><Badge variant="secondary">{r.flags?.archiveAttempts ?? 0}</Badge></TableCell>
                      <TableCell>
                        <RetryArchiveButton id={r.id} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </>
  )
}
