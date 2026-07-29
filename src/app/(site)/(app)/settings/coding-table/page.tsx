import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CodingTableForm } from '@/components/app/settings/coding-table-form'
import { fetchCodingRules } from '@/backend/actions/coding-rules-actions'

export const dynamic = 'force-dynamic'

export default async function CodingTableSettingsPage() {
  const rules = await fetchCodingRules()
  return (
    <Card>
      <CardHeader>
        <CardTitle>Coding Table</CardTitle>
        <CardDescription>
          Decide what counts as a fully coded invoice, and what happens when someone tries to
          approve one that is not.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CodingTableForm rules={rules} />
      </CardContent>
    </Card>
  )
}
