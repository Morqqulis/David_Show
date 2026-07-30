import { createHash, timingSafeEqual } from 'node:crypto'
import type { IntakeAttachment, IntakeMessage, MailboxSource } from './intake-attachments'

/**
 * Microsoft Graph over plain `fetch`. No SDK, no extra dependency.
 *
 * Call shapes verified against Microsoft Learn on 2026-07-29:
 * - Token: `POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`,
 *   form-encoded `client_id`, `scope=https://graph.microsoft.com/.default`,
 *   `client_secret`, `grant_type=client_credentials`; the reply carries
 *   `access_token` and `expires_in` in seconds.
 * - Subscription: `POST /v1.0/subscriptions` with `changeType`,
 *   `notificationUrl`, `resource`, `expirationDateTime`, `clientState`;
 *   renewed with `PATCH /v1.0/subscriptions/{id}`. Outlook message
 *   subscriptions may live at most 10,080 minutes (under seven days).
 * - Attachments: `GET /v1.0/users/{id}/messages/{id}/attachments` returns
 *   `contentBytes` inline for `#microsoft.graph.fileAttachment`.
 */

export type GraphCredentials = {
  tenantId: string
  clientId: string
  clientSecret: string
}

export type GraphConfiguration = GraphCredentials & {
  /** Public HTTPS address Microsoft posts change notifications to. */
  notificationUrl: string
  /** Shared secret echoed back on every notification. */
  clientState: string
}

const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0'

/** Requested subscription life. Well inside Graph's seven-day ceiling. */
export const SUBSCRIPTION_MINUTES = 4230

/** Renew once less than this is left, so a slow renewal never drops mail. */
export const RENEW_WHEN_MINUTES_LEFT = 720

/**
 * Reads and checks the mailbox credentials. Throws naming the missing variable
 * rather than failing later with an unauthorised response nobody can explain.
 * Never returns the secret to a caller that only needs to know it is present.
 */
export function readGraphConfiguration(env: NodeJS.ProcessEnv = process.env): GraphConfiguration {
  const missing = (
    ['GRAPH_TENANT_ID', 'GRAPH_CLIENT_ID', 'GRAPH_CLIENT_SECRET', 'GRAPH_NOTIFICATION_URL', 'GRAPH_WEBHOOK_SECRET'] as const
  ).filter((name) => !env[name] || env[name]?.trim() === '')
  if (missing.length > 0) {
    throw new Error(`Mailbox connection is not configured. Missing: ${missing.join(', ')}`)
  }
  return {
    tenantId: env.GRAPH_TENANT_ID as string,
    clientId: env.GRAPH_CLIENT_ID as string,
    clientSecret: env.GRAPH_CLIENT_SECRET as string,
    notificationUrl: env.GRAPH_NOTIFICATION_URL as string,
    clientState: env.GRAPH_WEBHOOK_SECRET as string,
  }
}

export function isGraphConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  try {
    readGraphConfiguration(env)
    return true
  } catch {
    return false
  }
}

/**
 * Constant-time comparison of the secret Microsoft echoes back.
 *
 * Both sides are hashed first so the comparison is over two fixed-length
 * buffers: `timingSafeEqual` throws on a length mismatch, and short-circuiting
 * on length would leak the secret's length one request at a time.
 */
export function clientStateMatches(received: unknown, expected: string): boolean {
  if (typeof received !== 'string' || received === '' || expected === '') return false
  const a = createHash('sha256').update(received, 'utf8').digest()
  const b = createHash('sha256').update(expected, 'utf8').digest()
  return timingSafeEqual(a, b)
}

let cachedToken: { value: string; expiresAt: number } | null = null

/** Cached until a minute before expiry, so a clock skew never uses a dead token. */
export async function graphAccessToken(config: GraphCredentials): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value

  const body = new URLSearchParams({
    client_id: config.clientId,
    scope: 'https://graph.microsoft.com/.default',
    client_secret: config.clientSecret,
    grant_type: 'client_credentials',
  })
  const response = await fetch(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!response.ok) {
    // The reply body carries the secret back in some error shapes, so only the
    // status and Microsoft's own error code are logged.
    const detail = (await response.json().catch(() => ({}))) as { error?: string }
    console.error('[intake] could not sign in to the mailbox service', {
      status: response.status,
      error: detail.error ?? null,
    })
    throw new Error('Could not sign in to the mailbox service.')
  }

  const json = (await response.json()) as { access_token: string; expires_in: number }
  cachedToken = { value: json.access_token, expiresAt: Date.now() + (json.expires_in - 60) * 1000 }
  return json.access_token
}

/** Dropped after a 401 so the next call fetches a fresh token instead of looping. */
export function clearGraphTokenCache() {
  cachedToken = null
}

async function graphFetch(
  config: GraphCredentials,
  path: string,
  init: RequestInit = {},
  attempt = 0,
): Promise<Response> {
  const token = await graphAccessToken(config)
  const response = await fetch(`${GRAPH_ROOT}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })

  if (response.status === 401 && attempt === 0) {
    clearGraphTokenCache()
    return graphFetch(config, path, init, attempt + 1)
  }
  if (response.status === 429 && attempt < 3) {
    const wait = Number(response.headers.get('Retry-After') ?? '5')
    await sleep((Number.isFinite(wait) ? wait : 5) * 1000)
    return graphFetch(config, path, init, attempt + 1)
  }
  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as { error?: { code?: string } }
    console.error('[intake] the mailbox service refused a request', {
      path: path.replace(/messages\/[^/?]+/, 'messages/…'),
      status: response.status,
      code: detail.error?.code ?? null,
    })
    throw new Error('The mailbox service could not be reached.')
  }
  return response
}

type GraphMessage = {
  id: string
  internetMessageId?: string
  subject?: string
  receivedDateTime?: string
  from?: { emailAddress?: { address?: string } }
  body?: { content?: string; contentType?: string }
}

type GraphAttachment = {
  '@odata.type'?: string
  id: string
  name?: string
  contentType?: string
  size?: number
  isInline?: boolean
  contentId?: string | null
  contentBytes?: string
}

/**
 * Turns the address an administrator typed into something Graph will accept.
 *
 * `/users/{id}` resolves an object id or a userPrincipalName and NOTHING else —
 * an SMTP address that happens to be a proxy alias returns 404, with no hint
 * that the address was the problem. Shared mailboxes are created with a UPN on
 * the tenant's `.onmicrosoft.com` domain and a friendly address on the vanity
 * domain, so the two nearly always differ: an admin who types
 * `invoices@city.ca` is handing us an address Graph has never heard of.
 *
 * So: look the address up by `mail` first and use the object id, which is
 * stable even if the address is later renamed. Fall back to the raw value when
 * the lookup finds nothing, because a real UPN is a legitimate thing to type
 * and should keep working.
 */
export async function resolveMailboxId(
  config: GraphConfiguration,
  mailboxAddress: string,
): Promise<string> {
  const address = mailboxAddress.trim()
  if (address === '') throw new Error('No mailbox address has been set.')

  try {
    const filter = encodeURIComponent(`mail eq '${address.replace(/'/g, "''")}'`)
    const response = await graphFetch(config, `/users?$filter=${filter}&$select=id`)
    const body = (await response.json()) as { value?: Array<{ id?: string }> }
    const id = body.value?.[0]?.id
    if (id) return id
  } catch (err) {
    // A failed lookup is not fatal — the address may already be a UPN, and the
    // call below will say so far more clearly than this one can.
    console.error('[graph-mailbox] could not look the mailbox up by address', {
      reason: err instanceof Error ? err.message : String(err),
    })
  }

  return address
}

/**
 * The mailbox, as the pipeline sees it. `mailbox` is the object id or
 * userPrincipalName resolved by `resolveMailboxId` — not the address from
 * Settings, which Graph may not recognise.
 */
export function createGraphMailbox(config: GraphConfiguration, mailbox: string): MailboxSource {
  const owner = encodeURIComponent(mailbox)

  return {
    async fetchMessage(messageId: string): Promise<IntakeMessage> {
      const id = encodeURIComponent(messageId)
      const select = 'id,internetMessageId,subject,receivedDateTime,from,body'
      const messageResponse = await graphFetch(config, `/users/${owner}/messages/${id}?$select=${select}`)
      const message = (await messageResponse.json()) as GraphMessage

      const attachmentResponse = await graphFetch(config, `/users/${owner}/messages/${id}/attachments`)
      const { value = [] } = (await attachmentResponse.json()) as { value: GraphAttachment[] }

      const attachments: IntakeAttachment[] = value
        // Only real files carry bytes. A forwarded email or a OneDrive link
        // arrives as a different attachment type with nothing to read.
        .filter((a) => a['@odata.type'] === '#microsoft.graph.fileAttachment')
        .map((a) => {
          const bytes = a.contentBytes ?? ''
          return {
            id: a.id,
            name: a.name ?? 'attachment',
            contentType: a.contentType ?? 'application/octet-stream',
            size: a.size ?? Buffer.byteLength(bytes, 'base64'),
            isInline: a.isInline ?? false,
            contentId: a.contentId ?? null,
            content: async () => Buffer.from(bytes, 'base64'),
          }
        })

      return {
        id: message.id,
        internetMessageId: message.internetMessageId ?? message.id,
        from: message.from?.emailAddress?.address ?? '',
        subject: message.subject ?? '',
        receivedAt: message.receivedDateTime ?? new Date().toISOString(),
        bodyHtml: message.body?.content ?? '',
        attachments,
      }
    },

    async markProcessed(messageId: string) {
      // Marking read is the visible signal to anyone watching the mailbox that
      // the message has been dealt with. It is not what stops reprocessing —
      // the intake record's message key does that.
      await graphFetch(config, `/users/${owner}/messages/${encodeURIComponent(messageId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ isRead: true }),
      })
    },
  }
}

export type GraphSubscription = { id: string; expirationDateTime: string }

export async function createMailboxSubscription(
  config: GraphConfiguration,
  mailboxAddress: string,
): Promise<GraphSubscription> {
  // Resolved rather than used verbatim: the address an administrator typed is
  // often a proxy alias that Graph does not recognise. See `resolveMailboxId`.
  const mailbox = await resolveMailboxId(config, mailboxAddress)
  const response = await graphFetch(config, '/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      changeType: 'created',
      notificationUrl: config.notificationUrl,
      resource: `users/${mailbox}/mailFolders('inbox')/messages`,
      expirationDateTime: subscriptionExpiry(new Date()),
      clientState: config.clientState,
      latestSupportedTlsVersion: 'v1_2',
    }),
  })
  return (await response.json()) as GraphSubscription
}

export async function renewMailboxSubscription(
  config: GraphConfiguration,
  subscriptionId: string,
): Promise<GraphSubscription> {
  const response = await graphFetch(config, `/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ expirationDateTime: subscriptionExpiry(new Date()) }),
  })
  return (await response.json()) as GraphSubscription
}

export async function deleteMailboxSubscription(config: GraphConfiguration, subscriptionId: string): Promise<void> {
  await graphFetch(config, `/subscriptions/${encodeURIComponent(subscriptionId)}`, { method: 'DELETE' })
}

export function subscriptionExpiry(from: Date): string {
  return new Date(from.getTime() + SUBSCRIPTION_MINUTES * 60_000).toISOString()
}

export function needsRenewal(expiresAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!expiresAt) return true
  const expiry = new Date(expiresAt).getTime()
  if (Number.isNaN(expiry)) return true
  return expiry - now.getTime() <= RENEW_WHEN_MINUTES_LEFT * 60_000
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
