import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getPayload } from '@/backend/lib/payload'
import { RolesTable, type RoleRow } from '@/components/app/settings/roles-table'

export const dynamic = 'force-dynamic'

export default async function RolesPage() {
  const payload = await getPayload()
  const res = await payload.find({ collection: 'roles', limit: 50, depth: 0 })
  const roles = res.docs as unknown as RoleRow[]
  return (
    <Card>
      <CardHeader>
        <CardTitle>Roles & Permissions</CardTitle>
        <CardDescription>
          Roles are a collection of permissions (action × object × scope) plus three flags:
          Confidential, Bypass Coding Restrictions, and whether the role may reassign an invoice
          to itself.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RolesTable rows={roles} />
        <p className="mt-4 text-xs text-muted-foreground">
          Role editor with the full permission matrix is wired in Payload Admin (
          <a className="text-primary hover:underline" href="/admin">
            /admin
          </a>
          ). The in-app editor for this view is intentionally lightweight in v1.
        </p>
      </CardContent>
    </Card>
  )
}
