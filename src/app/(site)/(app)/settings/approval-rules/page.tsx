import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getPayload } from '@/backend/lib/payload'
import { ApprovalRulesTable, type ApprovalRuleRow } from '@/components/app/settings/approval-rules-table'

export const dynamic = 'force-dynamic'

export default async function ApprovalRulesPage() {
  const payload = await getPayload()
  const res = await payload.find({ collection: 'approval-rules', sort: 'order', limit: 50, depth: 2 })
  const rules = res.docs as unknown as ApprovalRuleRow[]
  return (
    <Card>
      <CardHeader>
        <CardTitle>Approval Rules</CardTitle>
        <CardDescription>
          Rules evaluated at the Conditional Approvals stage. If no rule matches, invoices skip this stage entirely.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ApprovalRulesTable rows={rules} />
        <p className="mt-4 text-xs text-muted-foreground">
          The visual rule builder (drag-and-drop conditions) is the natural next iteration. In demo mode, edit rules in{' '}
          <Link className="text-primary hover:underline" href="/admin">
            Payload Admin
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  )
}
