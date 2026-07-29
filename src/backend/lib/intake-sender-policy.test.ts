import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_SENDER_POLICY,
  evaluateSenderPolicy,
  senderRejectionMessage,
  type SenderPolicy,
} from './intake-sender-policy'

const INTERNAL: SenderPolicy = { mode: 'internal_only', internalDomains: ['aurora.ca', 'auroraworks.ca'] }
const PUBLIC: SenderPolicy = { mode: 'public', internalDomains: ['aurora.ca'] }

describe('evaluateSenderPolicy — internal domain only', () => {
  test('accepts an address on a listed domain', () => {
    expect(evaluateSenderPolicy('marcus.patel@aurora.ca', INTERNAL)).toEqual({
      accepted: true,
      reason: null,
    })
  })

  test('accepts regardless of the case the sender typed', () => {
    expect(evaluateSenderPolicy('  Marcus.Patel@AURORA.CA  ', INTERNAL).accepted).toBe(true)
  })

  test('accepts a subdomain of a listed domain', () => {
    // Only the municipality can create hosts under its own domain, so
    // mail.aurora.ca is as trustworthy as aurora.ca.
    expect(evaluateSenderPolicy('scanner@mail.aurora.ca', INTERNAL).accepted).toBe(true)
  })

  test('accepts any of several listed domains', () => {
    expect(evaluateSenderPolicy('ap@auroraworks.ca', INTERNAL).accepted).toBe(true)
  })

  test('rejects an outside domain', () => {
    expect(evaluateSenderPolicy('billing@vendor.com', INTERNAL)).toEqual({
      accepted: false,
      reason: 'external_sender',
    })
  })
})

describe('evaluateSenderPolicy — attack vectors', () => {
  test('a look-alike domain that merely ends with the internal name is rejected', () => {
    // `evil-aurora.ca` and `notaurora.ca` both end with "aurora.ca" as raw
    // text. Only a dot-separated suffix may count as a subdomain.
    expect(evaluateSenderPolicy('billing@evil-aurora.ca', INTERNAL).accepted).toBe(false)
    expect(evaluateSenderPolicy('billing@notaurora.ca', INTERNAL).accepted).toBe(false)
  })

  test('the internal domain used as a subdomain of an attacker domain is rejected', () => {
    expect(evaluateSenderPolicy('billing@aurora.ca.evil.com', INTERNAL).accepted).toBe(false)
  })

  test('a second @ smuggled into the local part is rejected as unreadable', () => {
    // `a@evil.com@aurora.ca` is not a valid address. Splitting on the last @
    // would read the domain as aurora.ca and let it through.
    expect(evaluateSenderPolicy('a@evil.com@aurora.ca', INTERNAL)).toEqual({
      accepted: false,
      reason: 'unreadable_sender',
    })
  })

  test('a display-name wrapper is unwrapped before the domain is read', () => {
    expect(evaluateSenderPolicy('"AP aurora.ca" <billing@vendor.com>', INTERNAL)).toEqual({
      accepted: false,
      reason: 'external_sender',
    })
    expect(evaluateSenderPolicy('Marcus Patel <marcus@aurora.ca>', INTERNAL).accepted).toBe(true)
  })

  test('a blank or malformed sender is rejected under every policy', () => {
    for (const policy of [INTERNAL, PUBLIC]) {
      expect(evaluateSenderPolicy('', policy).reason).toBe('unreadable_sender')
      expect(evaluateSenderPolicy('   ', policy).reason).toBe('unreadable_sender')
      expect(evaluateSenderPolicy('no-at-sign', policy).reason).toBe('unreadable_sender')
      expect(evaluateSenderPolicy('trailing@', policy).reason).toBe('unreadable_sender')
      expect(evaluateSenderPolicy('@leading.ca', policy).reason).toBe('unreadable_sender')
      expect(evaluateSenderPolicy('dotless@localhost', policy).reason).toBe('unreadable_sender')
    }
  })

  test('an internal-only policy with no domains configured accepts nobody', () => {
    // Fail closed: an unconfigured allow-list must not mean "allow everyone".
    const unconfigured: SenderPolicy = { mode: 'internal_only', internalDomains: [] }
    expect(evaluateSenderPolicy('marcus@aurora.ca', unconfigured)).toEqual({
      accepted: false,
      reason: 'no_internal_domains_configured',
    })
  })
})

describe('evaluateSenderPolicy — public', () => {
  test('accepts a sender from anywhere on the internet', () => {
    expect(evaluateSenderPolicy('billing@vendor.com', PUBLIC)).toEqual({
      accepted: true,
      reason: null,
    })
  })

  test('still rejects an unreadable address', () => {
    expect(evaluateSenderPolicy('a@b@c.com', PUBLIC).reason).toBe('unreadable_sender')
  })
})

describe('senderRejectionMessage', () => {
  test('every rejection reason has plain-language wording with no jargon', () => {
    const reasons = ['external_sender', 'unreadable_sender', 'no_internal_domains_configured'] as const
    for (const reason of reasons) {
      const message = senderRejectionMessage(reason)
      expect(message.length).toBeGreaterThan(20)
      expect(message).not.toContain('_')
    }
  })
})

describe('DEFAULT_SENDER_POLICY', () => {
  test('defaults to the safe option so a fresh install is not an open relay', () => {
    expect(DEFAULT_SENDER_POLICY.mode).toBe('internal_only')
  })
})
