import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getPayload } from '@/backend/lib/payload'

export const dynamic = 'force-dynamic'

type Restriction = {
  id: string | number
  department?: { name: string; code: string }
  rules?: Array<{ segmentIndex: number; operator: string; value?: string; listValues?: Array<{ value: string }> }>
}

export default async function CodingRestrictionsPage() {
  const payload = await getPayload()
  const res = await payload.find({ collection: 'coding-restrictions', limit: 50, depth: 2 })
  const restrictions = res.docs as Restriction[]
  return (
    <Card>
      <CardHeader>
        <CardTitle>Coding Restrictions</CardTitle>
        <CardDescription>
          Per-department GL access rules. A coder may select a GL only if at least one of their department's rules matches.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 mb-4">
          GL segment format: <code className="rounded bg-amber-100 px-1.5 py-0.5">XX-XXXX-XXX-XXXX</code> (4 segments, hyphen delimiter, segment 3 is the department code).
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead>Rules</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {restrictions.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-medium">
                    {r.department ? `${r.department.name} (${r.department.code})` : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-xs">
                      {(r.rules ?? []).map((rule, i) => (
                        <div key={i} className="font-mono">
                          Segment {rule.segmentIndex} <Badge variant="outline" className="mx-1 text-[10px]">{rule.operator}</Badge>
                          {rule.operator === 'in'
                            ? `{ ${(rule.listValues ?? []).map((v) => v.value).join(', ')} }`
                            : rule.value}
                        </div>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
