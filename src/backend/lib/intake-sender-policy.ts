/**
 * Who is allowed to email an invoice into the AP mailbox.
 *
 * Two options, because that is what the client asked for and no more: accept
 * only the municipality's own staff, or accept anyone on the internet. Anything
 * this function rejects goes to the quarantine list for an admin to look at —
 * nothing that arrives in the mailbox is ever silently dropped.
 *
 * Pure and dependency-free so it can be exercised exhaustively in tests. This
 * is a security boundary: the address it reads comes from outside the
 * municipality and cannot be trusted to be well formed.
 */

export type SenderPolicyMode = 'internal_only' | 'public'

export type SenderPolicy = {
  mode: SenderPolicyMode
  /** Domains counted as internal, e.g. `aurora.ca`. Ignored when mode is public. */
  internalDomains: string[]
}

export type SenderRejectionReason =
  | 'external_sender'
  | 'unreadable_sender'
  | 'no_internal_domains_configured'

export type SenderDecision = {
  accepted: boolean
  reason: SenderRejectionReason | null
}

/**
 * A fresh install accepts only internal senders. An allow-list that defaults to
 * "everyone" would turn a mailbox into an open door before anyone had a chance
 * to think about it.
 */
export const DEFAULT_SENDER_POLICY: SenderPolicy = {
  mode: 'internal_only',
  internalDomains: [],
}

export function evaluateSenderPolicy(from: string, policy: SenderPolicy): SenderDecision {
  const domain = senderDomain(from)
  if (domain === null) return { accepted: false, reason: 'unreadable_sender' }

  if (policy.mode === 'public') return { accepted: true, reason: null }

  const allowed = policy.internalDomains.map(normaliseDomain).filter((d) => d.length > 0)
  if (allowed.length === 0) return { accepted: false, reason: 'no_internal_domains_configured' }

  const internal = allowed.some((d) => domain === d || domain.endsWith(`.${d}`))
  return internal ? { accepted: true, reason: null } : { accepted: false, reason: 'external_sender' }
}

/**
 * The domain part of a sender address, or null when the address cannot be read
 * with certainty.
 *
 * Deliberately strict. `a@evil.com@aurora.ca` is not a valid address, and
 * splitting it on the last `@` would read the domain as the municipality's own.
 * Anything with more than one `@` is refused rather than interpreted.
 */
export function senderDomain(from: string): string | null {
  if (typeof from !== 'string') return null
  let address = from.trim()
  if (address === '') return null

  // `Marcus Patel <marcus@aurora.ca>` — the real address is inside the angle
  // brackets, and the display name in front of it is attacker-controlled text.
  const bracketed = address.match(/<([^<>]*)>\s*$/)
  if (bracketed) address = bracketed[1].trim()

  const parts = address.split('@')
  if (parts.length !== 2) return null
  const [local, rawDomain] = parts
  if (local.trim() === '') return null

  const domain = normaliseDomain(rawDomain)
  // A domain with no dot is a local host name, not something an invoice can
  // arrive from over the internet.
  if (domain === '' || !domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) {
    return null
  }
  if (/[^a-z0-9.-]/.test(domain)) return null
  return domain
}

function normaliseDomain(value: string): string {
  return value.trim().toLowerCase().replace(/\.+$/, '')
}

/** What the quarantine screen shows a finance clerk. Never a code, never jargon. */
export function senderRejectionMessage(reason: SenderRejectionReason): string {
  switch (reason) {
    case 'external_sender':
      return 'This message came from outside the municipality, and the mailbox is currently set to accept invoices from staff only.'
    case 'unreadable_sender':
      return 'The sender address on this message could not be read, so it was held for review.'
    case 'no_internal_domains_configured':
      return 'No staff email domains have been set up yet, so nothing can be accepted automatically. Add your email domain in the mailbox settings.'
  }
}
