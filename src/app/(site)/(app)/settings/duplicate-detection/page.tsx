import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getPayload } from '@/backend/lib/payload'
import { DEFAULT_DUPLICATE_RULE } from '@/backend/lib/duplicate-detection'
import {
  DuplicateRulesForm,
  type DuplicateRuleValue,
} from '@/components/app/settings/duplicate-rules-form'

export const dynamic = 'force-dynamic'

type RuleDoc = {
  keyFields?: Array<{ field: string }>
  action?: DuplicateRuleValue['action']
  ignoreCancelled?: boolean
  caseInsensitive?: boolean
  appliesToManualEntry?: boolean
  windowDays?: number | null
}

export default async function DuplicateDetectionPage() {
  const payload = await getPayload()

  let doc: RuleDoc | undefined
  try {
    const res = await payload.find({ collection: 'duplicate-rules' as never, limit: 1, depth: 0 })
    doc = res.docs[0] as RuleDoc | undefined
  } catch (err) {
    console.error('[intake] could not load the duplicate rule', { message: (err as Error).message })
    return (
      <Card>
        <CardHeader>
          <CardTitle>Repeated invoices</CardTitle>
          <CardDescription>
            This setting could not be loaded right now. Try again in a moment; if it keeps happening, contact
            your administrator.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const keyFields = (doc?.keyFields ?? []).map((k) => k.field).filter(Boolean)
  const value: DuplicateRuleValue = {
    keyFields: keyFields.length > 0 ? keyFields : DEFAULT_DUPLICATE_RULE.keyFields,
    action: doc?.action ?? DEFAULT_DUPLICATE_RULE.action,
    ignoreCancelled: doc?.ignoreCancelled ?? DEFAULT_DUPLICATE_RULE.ignoreCancelled,
    caseInsensitive: doc?.caseInsensitive ?? DEFAULT_DUPLICATE_RULE.caseInsensitive,
    appliesToManualEntry: doc?.appliesToManualEntry ?? DEFAULT_DUPLICATE_RULE.appliesToManualEntry,
    windowDays: doc?.windowDays ?? DEFAULT_DUPLICATE_RULE.windowDays,
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Repeated invoices</CardTitle>
        <CardDescription>
          The same invoice often arrives twice — the vendor emails it to you and a colleague forwards their
          copy as well. Decide here what counts as the same invoice and what should happen.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DuplicateRulesForm value={value} />
      </CardContent>
    </Card>
  )
}
