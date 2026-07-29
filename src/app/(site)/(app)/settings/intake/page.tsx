import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getPayload } from '@/backend/lib/payload'
import { isGraphConfigured } from '@/backend/lib/graph-mailbox'
import { DEFAULT_CONFIDENCE_THRESHOLD } from '@/backend/lib/intake-field-mapping'
import { DEFAULT_SENDER_POLICY } from '@/backend/lib/intake-sender-policy'
import { DEFAULT_AMOUNT_TOLERANCE } from '@/backend/lib/intake-amounts'
import {
  IntakeSettingsForm,
  MailboxConnection,
  type IntakeSettingsValue,
} from '@/components/app/settings/intake-settings-form'
import {
  EmailSuppressionList,
  type SuppressionRow,
} from '@/components/app/settings/email-suppression-list'

export const dynamic = 'force-dynamic'

type SettingsDoc = {
  enabled?: boolean
  mailboxAddress?: string
  senderPolicy?: 'internal_only' | 'public'
  internalDomains?: Array<{ domain: string }>
  confidenceThreshold?: number
  amountTolerance?: number
  subscriptionId?: string | null
  subscriptionExpiresAt?: string | null
  lastNotificationAt?: string | null
}

export default async function IntakeSettingsPage() {
  const payload = await getPayload()

  let settings: SettingsDoc = {}
  let suppression: SuppressionRow[] = []
  try {
    const [settingsRes, suppressionRes] = await Promise.all([
      payload.find({ collection: 'intake-settings' as never, limit: 1, depth: 0 }),
      payload.find({ collection: 'email-suppression' as never, limit: 200, depth: 0 }),
    ])
    settings = (settingsRes.docs[0] as SettingsDoc | undefined) ?? {}
    suppression = (
      suppressionRes.docs as Array<{
        id: string | number
        value: string
        kind: SuppressionRow['kind']
        note?: string | null
      }>
    ).map((row) => ({ id: row.id, value: row.value, kind: row.kind, note: row.note ?? '' }))
  } catch (err) {
    console.error('[intake] could not load the mailbox settings', { message: (err as Error).message })
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email Intake</CardTitle>
          <CardDescription>
            These settings could not be loaded right now. Try again in a moment; if it keeps happening,
            contact your administrator.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const value: IntakeSettingsValue = {
    enabled: settings.enabled ?? false,
    mailboxAddress: settings.mailboxAddress ?? '',
    senderPolicy: settings.senderPolicy ?? DEFAULT_SENDER_POLICY.mode,
    internalDomains: (settings.internalDomains ?? []).map((d) => d.domain).join(', '),
    confidencePercent: Math.round((settings.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD) * 100),
    amountTolerance: settings.amountTolerance ?? DEFAULT_AMOUNT_TOLERANCE,
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Emailing invoices in</CardTitle>
          <CardDescription>
            Staff forward an invoice to a mailbox and it appears in To Be Assigned, with the details already
            filled in from the document.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IntakeSettingsForm value={value} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connection to the mailbox</CardTitle>
          <CardDescription>
            Start this once the address above is right. Invoices normally appear in the queue within a couple
            of minutes of being sent.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MailboxConnection
            connected={Boolean(settings.subscriptionId)}
            expiresAt={settings.subscriptionExpiresAt ?? null}
            lastNotificationAt={settings.lastNotificationAt ?? null}
            credentialsPresent={isGraphConfigured()}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Who does not get a confirmation reply</CardTitle>
          <CardDescription>
            Everyone who emails an invoice in gets a short reply saying it arrived. Put anyone here who
            forwards invoices often enough that the replies would become noise.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailSuppressionList rows={suppression} />
        </CardContent>
      </Card>
    </div>
  )
}
