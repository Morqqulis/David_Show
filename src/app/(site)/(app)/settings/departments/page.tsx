import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getPayload } from '@/backend/lib/payload'
import { DepartmentsCrud } from '@/components/app/settings/departments-crud'

export const dynamic = 'force-dynamic'

export default async function DepartmentsSettingsPage() {
  const payload = await getPayload()
  const dep = await payload.find({ collection: 'departments', sort: 'name', limit: 100, depth: 0 })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Departments</CardTitle>
        <CardDescription>Municipal departments. Used for assignment, coding restrictions, conditional approval routing.</CardDescription>
      </CardHeader>
      <CardContent>
        <DepartmentsCrud rows={dep.docs as never} />
      </CardContent>
    </Card>
  )
}
