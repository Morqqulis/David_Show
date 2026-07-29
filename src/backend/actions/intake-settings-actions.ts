'use server'

import { revalidatePath } from 'next/cache'
import type { Payload } from 'payload'
import { getPayload } from '../lib/payload'
import {
  createMailboxSubscription,
  deleteMailboxSubscription,
  needsRenewal,
  readGraphConfiguration,
  renewMailboxSubscription,
} from '../lib/graph-mailbox'
import { loadIntakeSettings } from './intake-actions'

/**
 * Everything the four intake settings screens save.
 *
 * Each action returns the row id so an optimistically added row can swap its
 * temporary id for the real one, matching the convention the other settings
 * tables in this app already follow.
 */

const INTAKE_PATH = '/settings/intake'
const OCR_PATH = '/settings/ocr'
const DUPLICATES_PATH = '/settings/duplicate-detection'

/** Single-row settings: update the row if it exists, create it if it does not. */
async function upsertSingleton(
  payload: Payload,
  collection: string,
  data: Record<string, unknown>,
): Promise<{ id: string | number }> {
  const existing = await payload.find({ collection: collection as never, limit: 1, depth: 0 })
  const current = existing.docs[0] as { id: string | number } | undefined
  if (current) {
    await payload.update({ collection: collection as never, id: current.id as never, data: data as never })
    return { id: current.id }
  }
  const created = (await payload.create({
    collection: collection as never,
    data: data as never,
  })) as { id: string | number }
  return { id: created.id }
}

export async function saveIntakeSettings(patch: {
  enabled: boolean
  mailboxAddress: string
  senderPolicy: 'internal_only' | 'public'
  internalDomains: string[]
  confidenceThreshold: number
  amountTolerance: number
}): Promise<{ id: string | number }> {
  const address = patch.mailboxAddress.trim()
  if (patch.enabled && address === '') {
    throw new Error('Enter the mailbox address before switching email intake on.')
  }
  const domains = patch.internalDomains.map((d) => d.trim().toLowerCase()).filter((d) => d !== '')
  if (patch.enabled && patch.senderPolicy === 'internal_only' && domains.length === 0) {
    throw new Error('Add at least one staff email domain, or switch the mailbox to accept anyone.')
  }
  if (patch.confidenceThreshold < 0 || patch.confidenceThreshold > 1) {
    throw new Error('The confidence setting has to be between 0 and 100 percent.')
  }

  const payload = await getPayload()
  const result = await upsertSingleton(payload, 'intake-settings', {
    enabled: patch.enabled,
    mailboxAddress: address || null,
    senderPolicy: patch.senderPolicy,
    internalDomains: domains.map((domain) => ({ domain })),
    confidenceThreshold: patch.confidenceThreshold,
    amountTolerance: patch.amountTolerance,
  })
  revalidatePath(INTAKE_PATH)
  revalidatePath(OCR_PATH)
  return result
}

export async function upsertOcrMappingRow(
  id: string | number | null,
  patch: { appField: string; sourceField: string; enabled: boolean; order: number },
): Promise<{ id: string | number }> {
  if (patch.appField.trim() === '') throw new Error('Choose which field in this app the value goes into.')
  if (patch.sourceField.trim() === '') throw new Error('Choose which reading the value comes from.')

  const payload = await getPayload()
  if (id) {
    await payload.update({ collection: 'ocr-field-map' as never, id: id as never, data: patch as never })
    revalidatePath(OCR_PATH)
    return { id }
  }
  const created = (await payload.create({
    collection: 'ocr-field-map' as never,
    data: patch as never,
  })) as { id: string | number }
  revalidatePath(OCR_PATH)
  return { id: created.id }
}

export async function deleteOcrMappingRow(id: string | number): Promise<void> {
  const payload = await getPayload()
  await payload.delete({ collection: 'ocr-field-map' as never, id: id as never })
  revalidatePath(OCR_PATH)
}

export async function saveDuplicateRule(patch: {
  keyFields: string[]
  action: 'flag' | 'block' | 'allow'
  ignoreCancelled: boolean
  caseInsensitive: boolean
  appliesToManualEntry: boolean
  windowDays: number | null
}): Promise<{ id: string | number }> {
  const keyFields = [...new Set(patch.keyFields.filter((f) => f.trim() !== ''))]
  if (keyFields.length === 0) {
    throw new Error('Pick at least one field that decides whether two invoices are the same.')
  }
  if (patch.windowDays !== null && patch.windowDays < 1) {
    throw new Error('The number of days to look back has to be at least 1, or left blank.')
  }

  const payload = await getPayload()
  const result = await upsertSingleton(payload, 'duplicate-rules', {
    keyFields: keyFields.map((field) => ({ field })),
    action: patch.action,
    ignoreCancelled: patch.ignoreCancelled,
    caseInsensitive: patch.caseInsensitive,
    appliesToManualEntry: patch.appliesToManualEntry,
    windowDays: patch.windowDays,
  })
  revalidatePath(DUPLICATES_PATH)
  return result
}

export async function addSuppressedRecipient(patch: {
  value: string
  kind: 'address' | 'domain' | 'group'
  note: string
}): Promise<{ id: string | number }> {
  const value = patch.value.trim()
  if (value === '') throw new Error('Enter an email address, a domain, or a group name.')
  if (patch.kind === 'address' && !value.includes('@')) {
    throw new Error('That does not look like an email address. Choose "Everyone at a domain" if you meant a domain.')
  }

  const payload = await getPayload()
  const created = (await payload.create({
    collection: 'email-suppression' as never,
    data: { value, kind: patch.kind, note: patch.note.trim() || null } as never,
  })) as { id: string | number }
  revalidatePath(INTAKE_PATH)
  return { id: created.id }
}

export async function deleteSuppressedRecipient(id: string | number): Promise<void> {
  const payload = await getPayload()
  await payload.delete({ collection: 'email-suppression' as never, id: id as never })
  revalidatePath(INTAKE_PATH)
}

/**
 * Starts watching the mailbox. Microsoft calls the notification address back
 * before it will create the subscription, so this fails immediately and
 * visibly if the address is wrong, rather than going quiet.
 */
export async function startMailboxWatch(): Promise<{ expiresAt: string }> {
  const settings = await loadIntakeSettings()
  if (!settings.mailboxAddress) throw new Error('Enter the mailbox address first.')

  const config = readGraphConfiguration()
  const payload = await getPayload()

  // A live subscription is replaced rather than duplicated: Microsoft refuses a
  // second subscription for the same mailbox and change type anyway.
  if (settings.subscriptionId) {
    await deleteMailboxSubscription(config, settings.subscriptionId).catch((err) => {
      console.error('[intake] the old mailbox connection could not be closed', {
        reason: err instanceof Error ? err.message : 'unknown',
      })
    })
  }

  const subscription = await createMailboxSubscription(config, settings.mailboxAddress)
  await upsertSingleton(payload, 'intake-settings', {
    subscriptionId: subscription.id,
    subscriptionExpiresAt: subscription.expirationDateTime,
  })
  revalidatePath(INTAKE_PATH)
  return { expiresAt: subscription.expirationDateTime }
}

export async function stopMailboxWatch(): Promise<void> {
  const settings = await loadIntakeSettings()
  const payload = await getPayload()
  if (settings.subscriptionId) {
    await deleteMailboxSubscription(readGraphConfiguration(), settings.subscriptionId)
  }
  await upsertSingleton(payload, 'intake-settings', {
    subscriptionId: null,
    subscriptionExpiresAt: null,
  })
  revalidatePath(INTAKE_PATH)
}

/**
 * Extends the mailbox connection when it is close to lapsing. Safe to call on
 * every notification, which is what keeps it alive without a scheduler.
 */
export async function renewMailboxWatchIfDue(): Promise<void> {
  const settings = await loadIntakeSettings()
  if (!settings.subscriptionId) return
  if (!needsRenewal(settings.subscriptionExpiresAt)) return

  try {
    const renewed = await renewMailboxSubscription(readGraphConfiguration(), settings.subscriptionId)
    const payload = await getPayload()
    await upsertSingleton(payload, 'intake-settings', {
      subscriptionExpiresAt: renewed.expirationDateTime,
    })
  } catch (err) {
    console.error('[intake] the mailbox connection could not be extended', {
      reason: err instanceof Error ? err.message : 'unknown',
    })
  }
}

/** Records that the mailbox told us something arrived, for the settings screen. */
export async function touchLastNotification(): Promise<void> {
  const payload = await getPayload()
  await upsertSingleton(payload, 'intake-settings', { lastNotificationAt: new Date().toISOString() })
}
