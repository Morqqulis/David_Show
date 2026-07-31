import { AlertTriangle } from 'lucide-react'
import { Topbar } from '@/components/app/topbar'
import { PageHeader } from '@/components/app/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getPayload } from '@/backend/lib/payload'
import { AlertsTable, type AlertRow } from '@/components/app/alerts/alerts-table'

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
  const rows = res.docs as unknown as AlertRow[]

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
              These invoices completed but couldn&apos;t be archived to SharePoint after 5 retry attempts. Manual retry from here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertsTable rows={rows} />
          </CardContent>
        </Card>
      </main>
    </>
  )
}
