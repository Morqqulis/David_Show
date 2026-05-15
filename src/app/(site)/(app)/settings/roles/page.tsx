import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Lock } from 'lucide-react'
import { getPayload } from '@/backend/lib/payload'

export const dynamic = 'force-dynamic'

type Role = {
  id: string | number
  name: string
  description?: string
  permissions?: Array<{ action: string; object: string; scope: string }>
  confidential?: boolean
  bypassCodingRestrictions?: boolean
  isSystem?: boolean
}

export default async function RolesPage() {
  const payload = await getPayload()
  const res = await payload.find({ collection: 'roles', limit: 50, depth: 0 })
  const roles = res.docs as Role[]
  return (
    <Card>
      <CardHeader>
        <CardTitle>Roles & Permissions</CardTitle>
        <CardDescription>
          Roles are a collection of permissions (action × object × scope) plus two flags: Confidential and Bypass Coding Restrictions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Permissions</TableHead>
                <TableHead>Confidential</TableHead>
                <TableHead>Bypass coding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{r.name}</span>
                      {r.isSystem ? <Lock className="h-3 w-3 text-muted-foreground" /> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.description ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.permissions?.length ?? 0}</TableCell>
                  <TableCell>{r.confidential ? <Badge>yes</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{r.bypassCodingRestrictions ? <Badge>yes</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Role editor with the full permission matrix is wired in Payload Admin (<a className="text-primary hover:underline" href="/admin">/admin</a>). The in-app editor for this view is intentionally lightweight in v1 — most clients tweak it once at onboarding.
        </p>
      </CardContent>
    </Card>
  )
}
