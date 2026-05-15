import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { getPayload } from '@/backend/lib/payload'
import { initials } from '@/backend/lib/formatting'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const payload = await getPayload()
  const res = await payload.find({ collection: 'users', limit: 200, depth: 1 })
  const users = res.docs as Array<{
    id: string | number
    name?: string
    email?: string
    role?: { name?: string }
    department?: { name?: string }
    active?: boolean
  }>
  return (
    <Card>
      <CardHeader>
        <CardTitle>Users</CardTitle>
        <CardDescription>
          In production, users sync from Entra ID. Roles and department assignment are managed here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={String(u.id)}>
                  <TableCell>
                    <div className="grid h-7 w-7 place-items-center rounded-full bg-muted text-[10px] font-semibold uppercase">
                      {initials(u.name)}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell><Badge variant="outline">{u.role?.name ?? '—'}</Badge></TableCell>
                  <TableCell>{u.department?.name ?? '—'}</TableCell>
                  <TableCell>{u.active === false ? <Badge variant="secondary">inactive</Badge> : <Badge>active</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
