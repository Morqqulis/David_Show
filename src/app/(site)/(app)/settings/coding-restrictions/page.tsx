import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getPayload } from '@/backend/lib/payload'
import {
  CodingRestrictionsTable,
  type RestrictionRow,
} from '@/components/app/settings/coding-restrictions-table'

export const dynamic = 'force-dynamic'

export default async function CodingRestrictionsPage() {
  const payload = await getPayload()
  const res = await payload.find({ collection: 'coding-restrictions', limit: 50, depth: 2 })
  const restrictions = res.docs as unknown as RestrictionRow[]
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
        <CodingRestrictionsTable rows={restrictions} />
      </CardContent>
    </Card>
  )
}
