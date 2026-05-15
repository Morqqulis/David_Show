import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getPayload } from '@/backend/lib/payload'
import { SectionsCrud } from '@/components/app/settings/sections-crud'

export const dynamic = 'force-dynamic'

export default async function SectionsSettingsPage() {
  const payload = await getPayload()
  const sections = await payload.find({ collection: 'sections', sort: 'order', limit: 50, depth: 0 })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Header Sections</CardTitle>
        <CardDescription>Named, ordered groups for header fields on the New Request and invoice Header tab.</CardDescription>
      </CardHeader>
      <CardContent>
        <SectionsCrud sections={sections.docs as never} />
      </CardContent>
    </Card>
  )
}
