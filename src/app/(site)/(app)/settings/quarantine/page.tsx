import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getPayload } from '@/backend/lib/payload'
import { QuarantineTable, type HeldMessage } from '@/components/app/settings/quarantine-table'
import type { SenderRejectionReason } from '@/backend/lib/intake-sender-policy'

export const dynamic = 'force-dynamic'

type QuarantineDoc = {
  id: string | number
  sender: string
  subject?: string | null
  receivedAt: string
  reason: SenderRejectionReason
  attachmentCount?: number | null
  released?: boolean
  releasedAt?: string | null
  releaseError?: string | null
}

export default async function QuarantinePage() {
  const payload = await getPayload()

  let rows: HeldMessage[] = []
  try {
    const res = await payload.find({
      collection: 'intake-quarantine' as never,
      limit: 200,
      depth: 0,
      sort: '-receivedAt',
    })
    rows = (res.docs as QuarantineDoc[]).map((doc) => ({
      id: doc.id,
      sender: doc.sender,
      subject: doc.subject ?? '',
      receivedAt: doc.receivedAt,
      reason: doc.reason,
      attachmentCount: doc.attachmentCount ?? 0,
      released: doc.released ?? false,
      releasedAt: doc.releasedAt ?? null,
      releaseError: doc.releaseError ?? null,
    }))
  } catch (err) {
    console.error('[intake] could not load the held messages', { message: (err as Error).message })
    return (
      <Card>
        <CardHeader>
          <CardTitle>Held emails</CardTitle>
          <CardDescription>
            This list could not be loaded right now. Try again in a moment; if it keeps happening, contact
            your administrator.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const waiting = rows.filter((r) => !r.released).length

  return (
    <Card>
      <CardHeader>
        <CardTitle>Held emails</CardTitle>
        <CardDescription>
          Emails that reached the accounts payable mailbox but were not accepted automatically. Nothing is
          ever thrown away — everything turned back is listed here.{' '}
          {waiting > 0
            ? `${waiting} ${waiting === 1 ? 'message is' : 'messages are'} waiting for you.`
            : 'Nothing is waiting for you.'}{' '}
          Accepting one puts it through exactly as if it had been allowed in the first place.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <QuarantineTable rows={rows} />
      </CardContent>
    </Card>
  )
}
