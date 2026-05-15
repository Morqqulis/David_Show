import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getPayload } from '@/backend/lib/payload'
import { UsersTable, type UserRow } from '@/components/app/settings/users-table'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const payload = await getPayload()
  const res = await payload.find({ collection: 'users', limit: 200, depth: 1 })
  const rows = res.docs as unknown as UserRow[]
  return (
    <Card>
      <CardHeader>
        <CardTitle>Users</CardTitle>
        <CardDescription>
          In production, users sync from Entra ID. Roles and department assignment are managed here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <UsersTable rows={rows} />
      </CardContent>
    </Card>
  )
}
