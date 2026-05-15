import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getPayload } from '@/backend/lib/payload'
import { FieldsTable } from '@/components/app/settings/fields'

export const dynamic = 'force-dynamic'

export default async function FieldsSettingsPage() {
  const payload = await getPayload()
  const [fields, sections, stages] = await Promise.all([
    payload.find({ collection: 'fields', sort: 'order', limit: 200, depth: 1 }),
    payload.find({ collection: 'sections', sort: 'order', limit: 50, depth: 0 }),
    payload.find({ collection: 'stages', sort: 'order', limit: 50, depth: 0 }),
  ])
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Fields</CardTitle>
          <CardDescription>
            Every header field, every coding-line column, every list column, every CSV export column lives here. System fields can be relabeled but not removed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldsTable fields={fields.docs as never} sections={sections.docs as never} stages={stages.docs as never} />
        </CardContent>
      </Card>
    </div>
  )
}
