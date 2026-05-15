import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getPayload } from '@/backend/lib/payload'
import { Money } from '@/components/app/money'

export const dynamic = 'force-dynamic'

type Rule = {
  id: string | number
  name: string
  order: number
  enabled: boolean
  conditions?: {
    operator: 'and' | 'or'
    conditions: Array<{ fieldKey: string; operator: string; value: unknown }>
  }
  approvers?: Array<{ type: string; user?: { name?: string }; role?: { name?: string }; department?: { name?: string } }>
  mode?: string
}

export default async function ApprovalRulesPage() {
  const payload = await getPayload()
  const res = await payload.find({ collection: 'approval-rules', sort: 'order', limit: 50, depth: 2 })
  const rules = res.docs as Rule[]
  return (
    <Card>
      <CardHeader>
        <CardTitle>Approval Rules</CardTitle>
        <CardDescription>
          Rules evaluated at the Conditional Approvals stage. If no rule matches, invoices skip this stage entirely.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Order</TableHead>
                <TableHead>Rule</TableHead>
                <TableHead>Conditions</TableHead>
                <TableHead>Approvers</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Enabled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="tabular-nums">{r.order}</TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>
                    <div className="space-y-1 text-xs">
                      <Badge variant="outline">{r.conditions?.operator ?? '—'}</Badge>
                      <ul className="space-y-0.5">
                        {(r.conditions?.conditions ?? []).map((c, i) => (
                          <li key={i} className="font-mono text-[11px] text-muted-foreground">
                            {c.fieldKey} <span className="text-foreground">{c.operator}</span>{' '}
                            {renderValue(c.fieldKey, c.value)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5 text-xs">
                      {(r.approvers ?? []).map((a, i) => (
                        <div key={i}>
                          <Badge variant="secondary" className="text-[10px]">{a.type}</Badge>{' '}
                          <span>{a.user?.name ?? a.role?.name ?? a.department?.name ?? ''}</span>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{r.mode ?? 'parallel'}</Badge></TableCell>
                  <TableCell>{r.enabled ? <Badge>on</Badge> : <Badge variant="secondary">off</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          The visual rule builder (drag-and-drop conditions) is the natural next iteration. In demo mode, edit rules in <a className="text-primary hover:underline" href="/admin">Payload Admin</a>.
        </p>
      </CardContent>
    </Card>
  )
}

function renderValue(key: string, v: unknown) {
  if (key === 'grandTotal' || key === 'subtotal') return <Money value={Number(v)} />
  return String(v ?? '')
}
