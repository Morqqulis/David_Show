import { Topbar } from '@/components/app/topbar'
import { PageHeader } from '@/components/app/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getPayload } from '@/backend/lib/payload'
import { TrashTable, type TrashRow } from '@/components/app/trash/trash-table'

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
  const rows = res.docs as unknown as TrashRow[]

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
            <TrashTable rows={rows} />
          </CardContent>
        </Card>
      </main>
    </>
  )
}
