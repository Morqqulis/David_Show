import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getPayload } from '@/backend/lib/payload'

export const dynamic = 'force-dynamic'

export default async function TriggersPage() {
  const payload = await getPayload()
  const res = await payload.find({ collection: 'email-triggers', limit: 100, depth: 2 })
  const triggers = res.docs as Array<{
    id: string | number
    name: string
    event: string
    stage?: { label: string; systemId: string }
    template?: { name: string }
    enabled: boolean
    recipients?: Array<{ type: string; dynamicKey?: string; role?: { name: string }; user?: { name: string }; email?: string }>
  }>

  return (
    <Card>
      <CardHeader>
        <CardTitle>Triggers</CardTitle>
        <CardDescription>
          Map system events (and the stage they fire at) to a template + recipient list. Recipients can be dynamic roles, groups, individuals, or literal emails.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Recipients</TableHead>
              <TableHead>Enabled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {triggers.map((t) => (
              <TableRow key={String(t.id)}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell><Badge variant="outline">{t.event}</Badge></TableCell>
                <TableCell>{t.stage?.label ?? <span className="text-muted-foreground">any</span>}</TableCell>
                <TableCell>{t.template?.name ?? '—'}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(t.recipients ?? []).map((r, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">
                        {r.type === 'dynamic'
                          ? `dynamic: ${r.dynamicKey}`
                          : r.type === 'role'
                            ? `role: ${r.role?.name}`
                            : r.type === 'user'
                              ? `user: ${r.user?.name}`
                              : `email: ${r.email}`}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{t.enabled ? <Badge>on</Badge> : <Badge variant="secondary">off</Badge>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
