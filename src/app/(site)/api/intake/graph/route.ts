import { after } from 'next/server'
import { clientStateMatches, readGraphConfiguration } from '@/backend/lib/graph-mailbox'
import { runIntakeForMessage } from '@/backend/actions/intake-actions'
import { renewMailboxWatchIfDue, touchLastNotification } from '@/backend/actions/intake-settings-actions'

/**
 * Where Microsoft tells us an email arrived.
 *
 * This is a public endpoint on the open internet and every byte of its input is
 * untrusted. Three rules hold without exception:
 *
 * 1. The subscription handshake is answered exactly as documented — the
 *    validation token echoed back as plain text — or Microsoft refuses to
 *    create the subscription at all.
 * 2. The shared secret on every notification is compared in constant time. A
 *    mismatch is refused and logged with the reason and nothing else.
 * 3. A notification is a nudge, never data. The message is always fetched back
 *    from the mailbox by id, so a forged payload cannot invent an invoice.
 *
 * Microsoft allows three seconds for a reply and retries a failure for up to
 * four hours. Reading a scan takes far longer than three seconds, so the reply
 * goes out first and the work runs afterwards through `after()`.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 300

type ChangeNotification = {
  subscriptionId?: string
  clientState?: unknown
  changeType?: string
  resource?: string
  resourceData?: { id?: string }
}

export async function POST(request: Request) {
  const url = new URL(request.url)

  // Step 1 of creating a subscription: Microsoft posts the notification address
  // with a token in the query string and expects it back, undecorated, as
  // text/plain. Anything else and the subscription is never created.
  const validationToken = url.searchParams.get('validationToken')
  if (validationToken !== null) {
    // Returned exactly as received, URL-decoded and unescaped, because
    // Microsoft rejects an encoded token. `nosniff` is what makes that safe:
    // the token is opaque attacker-reachable text, and without it a browser
    // could decide a text/plain body looked like markup.
    return new Response(validationToken, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
    })
  }

  let expectedSecret: string
  try {
    expectedSecret = readGraphConfiguration().clientState
  } catch {
    // Refusing tells Microsoft to retry; the mail is still in the mailbox and
    // nothing is lost while an operator finishes the configuration.
    console.error('[intake] a mailbox notification arrived before the connection was configured')
    return new Response('Not configured', { status: 503 })
  }

  let payload: { value?: ChangeNotification[] }
  try {
    payload = (await request.json()) as { value?: ChangeNotification[] }
  } catch {
    console.error('[intake] a mailbox notification could not be read as JSON')
    return new Response('Bad request', { status: 400 })
  }

  const notifications = Array.isArray(payload.value) ? payload.value : []
  if (notifications.length === 0) {
    console.error('[intake] a mailbox notification arrived with nothing in it')
    return new Response('Bad request', { status: 400 })
  }

  // Every notification in the batch must carry the secret. One bad entry means
  // the whole batch is refused rather than partly trusted.
  const messageIds: string[] = []
  for (const notification of notifications) {
    if (!clientStateMatches(notification.clientState, expectedSecret)) {
      console.error('[intake] a mailbox notification was refused', {
        reason: 'the shared secret did not match',
        subscriptionId: notification.subscriptionId ?? null,
      })
      return new Response('Forbidden', { status: 403 })
    }
    const messageId = notification.resourceData?.id
    if (typeof messageId !== 'string' || messageId.trim() === '') {
      console.error('[intake] a mailbox notification was refused', {
        reason: 'it named no message',
        subscriptionId: notification.subscriptionId ?? null,
      })
      return new Response('Bad request', { status: 400 })
    }
    messageIds.push(messageId)
  }

  // Answer now, work after. Anything that fails below leaves an intake record
  // an administrator can see and re-run, and Microsoft's own retry will deliver
  // the same notification again — which is free, because each unit of work
  // carries an idempotency key.
  after(async () => {
    await touchLastNotification().catch(() => {})
    for (const messageId of messageIds) {
      try {
        await runIntakeForMessage(messageId)
      } catch (err) {
        console.error('[intake] an emailed message could not be turned into an invoice', {
          reason: err instanceof Error ? err.message : 'unknown error',
        })
      }
    }
    await renewMailboxWatchIfDue()
  })

  return new Response(null, { status: 202 })
}
