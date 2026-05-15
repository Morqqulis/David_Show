import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getPayload } from '@/backend/lib/payload'
import { WorkflowTable } from '@/components/app/settings/workflow-table'

export const dynamic = 'force-dynamic'

export default async function WorkflowSettingsPage() {
  const payload = await getPayload()
  const stages = await payload.find({ collection: 'stages', sort: 'order', limit: 50, depth: 0 })
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Workflow stages</CardTitle>
          <CardDescription>
            Three stages are required and cannot be disabled (To Be Assigned, Ready for Processing, Completed). Others can be toggled off — invoices will skip them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkflowTable stages={stages.docs as never} />
        </CardContent>
      </Card>
    </div>
  )
}
