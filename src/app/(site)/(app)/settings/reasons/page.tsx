import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchAllReasonLists } from '@/backend/actions/reason-actions'
import { ReasonsCrud } from '@/components/app/settings/reasons-crud'

export const dynamic = 'force-dynamic'

export default async function ReasonsPage() {
  const lists = await fetchAllReasonLists()
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reasons</CardTitle>
        <CardDescription>
          The choices staff pick from when they reassign, reject or cancel an invoice. Each action keeps
          its own list. Every list ends with Other, which is built in and lets someone type a reason
          nobody thought of — you can hide it, but not delete it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ReasonsCrud lists={lists} />
      </CardContent>
    </Card>
  )
}
