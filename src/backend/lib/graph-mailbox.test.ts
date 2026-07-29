import { describe, expect, test } from 'bun:test'
import {
  RENEW_WHEN_MINUTES_LEFT,
  SUBSCRIPTION_MINUTES,
  clientStateMatches,
  isGraphConfigured,
  needsRenewal,
  readGraphConfiguration,
  subscriptionExpiry,
} from './graph-mailbox'

/**
 * Only the parts that decide whether a request is trusted, and the arithmetic
 * behind the subscription's lifetime. The HTTP calls themselves need a real
 * Microsoft 365 tenant and are not exercised here.
 */

const ENV = {
  GRAPH_TENANT_ID: 'tenant-guid',
  GRAPH_CLIENT_ID: 'client-guid',
  GRAPH_CLIENT_SECRET: 'shhh',
  GRAPH_NOTIFICATION_URL: 'https://ap.aurora.ca/api/intake/graph',
  GRAPH_WEBHOOK_SECRET: 'a-long-random-shared-secret',
} as unknown as NodeJS.ProcessEnv

describe('clientStateMatches — every branch', () => {
  test('accepts the exact secret', () => {
    expect(clientStateMatches('a-long-random-shared-secret', 'a-long-random-shared-secret')).toBe(true)
  })

  test('rejects a different secret of the same length', () => {
    expect(clientStateMatches('a-long-random-shared-secreT', 'a-long-random-shared-secret')).toBe(false)
  })

  test('rejects a secret of a different length instead of throwing', () => {
    // timingSafeEqual throws on unequal lengths; hashing first is what makes
    // this a boolean rather than a crash the caller has to catch.
    expect(clientStateMatches('short', 'a-long-random-shared-secret')).toBe(false)
    expect(clientStateMatches('a-long-random-shared-secret-and-then-some', 'a-long-random-shared-secret')).toBe(false)
  })

  test('rejects a prefix of the real secret', () => {
    expect(clientStateMatches('a-long-random-shared-secre', 'a-long-random-shared-secret')).toBe(false)
  })

  test('rejects anything that is not a string', () => {
    for (const value of [undefined, null, 0, {}, [], true]) {
      expect(clientStateMatches(value, 'a-long-random-shared-secret')).toBe(false)
    }
  })

  test('rejects an empty secret on either side', () => {
    expect(clientStateMatches('', 'a-long-random-shared-secret')).toBe(false)
    expect(clientStateMatches('anything', '')).toBe(false)
    expect(clientStateMatches('', '')).toBe(false)
  })

  test('an attacker sending the hash of the secret does not get in', () => {
    // Both sides are hashed, so a caller who somehow learned the digest cannot
    // present it as the secret.
    const digest = '0d0f8fd4dcbbe73f3a1e7f2f0bf2e9c6e9e1b5f0c8e9b1a2c3d4e5f60718293a'
    expect(clientStateMatches(digest, 'a-long-random-shared-secret')).toBe(false)
  })

  test('an object pretending to be a string does not get in', () => {
    const impostor = { toString: () => 'a-long-random-shared-secret' }
    expect(clientStateMatches(impostor, 'a-long-random-shared-secret')).toBe(false)
  })
})

describe('readGraphConfiguration', () => {
  test('returns every value when the environment is complete', () => {
    expect(readGraphConfiguration(ENV)).toEqual({
      tenantId: 'tenant-guid',
      clientId: 'client-guid',
      clientSecret: 'shhh',
      notificationUrl: 'https://ap.aurora.ca/api/intake/graph',
      clientState: 'a-long-random-shared-secret',
    })
  })

  test('names every missing variable rather than failing later', () => {
    expect(() => readGraphConfiguration({} as NodeJS.ProcessEnv)).toThrow(/GRAPH_TENANT_ID/)
    expect(() => readGraphConfiguration({ ...ENV, GRAPH_WEBHOOK_SECRET: '' })).toThrow(/GRAPH_WEBHOOK_SECRET/)
    expect(() => readGraphConfiguration({ ...ENV, GRAPH_CLIENT_SECRET: '   ' })).toThrow(/GRAPH_CLIENT_SECRET/)
  })

  test('isGraphConfigured answers without throwing', () => {
    expect(isGraphConfigured(ENV)).toBe(true)
    expect(isGraphConfigured({} as NodeJS.ProcessEnv)).toBe(false)
  })
})

describe('subscription lifetime', () => {
  test('stays inside the seven-day ceiling Microsoft allows for mail', () => {
    expect(SUBSCRIPTION_MINUTES).toBeLessThan(10_080)
  })

  test('the expiry is the requested number of minutes ahead, in ISO form', () => {
    const from = new Date('2026-07-29T00:00:00.000Z')
    const expiry = subscriptionExpiry(from)
    expect(new Date(expiry).getTime() - from.getTime()).toBe(SUBSCRIPTION_MINUTES * 60_000)
    expect(expiry).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  test('renews well before the deadline, never after it', () => {
    const now = new Date('2026-07-29T00:00:00.000Z')
    const wellAhead = new Date(now.getTime() + (RENEW_WHEN_MINUTES_LEFT + 60) * 60_000).toISOString()
    const closeIn = new Date(now.getTime() + (RENEW_WHEN_MINUTES_LEFT - 60) * 60_000).toISOString()

    expect(needsRenewal(wellAhead, now)).toBe(false)
    expect(needsRenewal(closeIn, now)).toBe(true)
  })

  test('treats a missing or unreadable expiry as needing a new subscription', () => {
    expect(needsRenewal(null)).toBe(true)
    expect(needsRenewal(undefined)).toBe(true)
    expect(needsRenewal('not a date')).toBe(true)
  })

  test('an expiry already in the past needs renewal', () => {
    const now = new Date('2026-07-29T00:00:00.000Z')
    expect(needsRenewal('2026-07-28T00:00:00.000Z', now)).toBe(true)
  })
})
