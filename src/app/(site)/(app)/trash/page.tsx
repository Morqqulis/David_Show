import Link from 'next/link'
import { Topbar } from '@/components/app/topbar'
import { PageHeader } from '@/components/app/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Money } from '@/components/app/money'
import { Button } from '@/components/ui/button'
import { Undo2 } from 'lucide-react'
import { formatDate } from '@/backend/lib/formatting'
import { getPayload } from '@/backend/lib/payload'
import { RestoreButton } from '@/components/app/restore-button'

export const dynamic = 'force-dynamic'

export default async function TrashPage() {
  const payload = await getPayload()
  const res = await payload.find({
    collection: 'invoices',
    where: { softDeleted: { equals: true } } as never,
    depth: 1,
    sort: '-updatedAt',
    limit: 100,
  })
  const rows = res.docs as Array<{
    id: string | number
    invoiceNumber: string
    vendor?: { name: string }
    grandTotal: number
    deletedReason?: string
    updatedAt: string
  }>
  return (
    <>
      <Topbar crumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Trash' }]} />
      <main className="flex-1 overflow-y-auto p-8 space-y-4">
        <PageHeader title="Trash" description="Soft-deleted invoices. Admins can restore them." />
        <Card>
          <CardHeader>
            <CardTitle>Deleted records</CardTitle>
            <CardDescription>
              Records stay in the database for audit purposes — they're hidden from default views but never erased.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Deleted</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="w-[120px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                      Trash is empty.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={String(r.id)}>
                      <TableCell className="font-medium">{r.invoiceNumber}</TableCell>
                      <TableCell>{r.vendor?.name ?? '—'}</TableCell>
                      <TableCell className="text-right"><Money value={r.grandTotal} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(r.updatedAt)}</TableCell>
                      <TableCell className="text-xs">{r.deletedReason ?? '—'}</TableCell>
                      <TableCell>
                        <RestoreButton id={r.id} />
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
