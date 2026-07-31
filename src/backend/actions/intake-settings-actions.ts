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
import { guard, UserFacingError, type ActionResult } from '../../lib/action-result'
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

type IntakeSettingsPatch = {
  enabled: boolean
  mailboxAddress: string
  senderPolicy: 'internal_only' | 'public'
  internalDomains: string[]
  confidenceThreshold: number
  amountTolerance: number
}

export async function saveIntakeSettings(
  patch: IntakeSettingsPatch,
): Promise<ActionResult<{ id: string | number }>> {
  return guard(() => runSaveIntakeSettings(patch))
}

async function runSaveIntakeSettings(patch: IntakeSettingsPatch): Promise<{ id: string | number }> {
  const address = patch.mailboxAddress.trim()
  if (patch.enabled && address === '') {
    throw new UserFacingError('Enter the mailbox address before switching email intake on.')
  }
  const domains = patch.internalDomains.map((d) => d.trim().toLowerCase()).filter((d) => d !== '')
  if (patch.enabled && patch.senderPolicy === 'internal_only' && domains.length === 0) {
    throw new UserFacingError('Add at least one staff email domain, or switch the mailbox to accept anyone.')
  }
  if (patch.confidenceThreshold < 0 || patch.confidenceThreshold > 1) {
    throw new UserFacingError('The confidence setting has to be between 0 and 100 percent.')
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

type OcrMappingPatch = { appField: string; sourceField: string; enabled: boolean; order: number }

export async function upsertOcrMappingRow(
  id: string | number | null,
  patch: OcrMappingPatch,
): Promise<ActionResult<{ id: string | number }>> {
  return guard(() => runUpsertOcrMappingRow(id, patch))
}

async function runUpsertOcrMappingRow(
  id: string | number | null,
  patch: OcrMappingPatch,
): Promise<{ id: string | number }> {
  if (patch.appField.trim() === '')
    throw new UserFacingError('Choose which field in this app the value goes into.')
  if (patch.sourceField.trim() === '')
    throw new UserFacingError('Choose which reading the value comes from.')

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

type DuplicateRulePatch = {
  keyFields: string[]
  action: 'flag' | 'block' | 'allow'
  ignoreCancelled: boolean
  caseInsensitive: boolean
  appliesToManualEntry: boolean
  windowDays: number | null
}

export async function saveDuplicateRule(
  patch: DuplicateRulePatch,
): Promise<ActionResult<{ id: string | number }>> {
  return guard(() => runSaveDuplicateRule(patch))
}

async function runSaveDuplicateRule(patch: DuplicateRulePatch): Promise<{ id: string | number }> {
  const keyFields = [...new Set(patch.keyFields.filter((f) => f.trim() !== ''))]
  if (keyFields.length === 0) {
    throw new UserFacingError('Pick at least one field that decides whether two invoices are the same.')
  }
  if (patch.windowDays !== null && patch.windowDays < 1) {
    throw new UserFacingError('The number of days to look back has to be at least 1, or left blank.')
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

type SuppressionPatch = { value: string; kind: 'address' | 'domain' | 'group'; note: string }

export async function addSuppressedRecipient(
  patch: SuppressionPatch,
): Promise<ActionResult<{ id: string | number }>> {
  return guard(() => runAddSuppressedRecipient(patch))
}

async function runAddSuppressedRecipient(patch: SuppressionPatch): Promise<{ id: string | number }> {
  const value = patch.value.trim()
  if (value === '') throw new UserFacingError('Enter an email address, a domain, or a group name.')
  if (patch.kind === 'address' && !value.includes('@')) {
    throw new UserFacingError(
      'That does not look like an email address. Choose "Everyone at a domain" if you meant a domain.',
    )
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
export async function startMailboxWatch(): Promise<ActionResult<{ expiresAt: string }>> {
  return guard(runStartMailboxWatch)
}

async function runStartMailboxWatch(): Promise<{ expiresAt: string }> {
  const settings = await loadIntakeSettings()
  if (!settings.mailboxAddress) throw new UserFacingError('Enter the mailbox address first.')

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

  // Microsoft's own words are worth showing here. When it refuses, the reason
  // is nearly always something an administrator has to change in Microsoft 365
  // — permission not granted, mailbox out of the allowed list, address wrong —
  // and hiding it behind "something went wrong" costs an afternoon of guessing.
  const subscription = await createMailboxSubscription(config, settings.mailboxAddress).catch((err) => {
    const reason = err instanceof Error ? err.message : 'no reason was given'
    console.error('[intake] Microsoft refused to start watching the mailbox', {
      mailbox: settings.mailboxAddress,
      reason,
    })
    throw new UserFacingError(`Microsoft would not start watching this mailbox. It said: ${reason}`)
  })
  await upsertSingleton(payload, 'intake-settings', {
    subscriptionId: subscription.id,
    subscriptionExpiresAt: subscription.expirationDateTime,
  })
  revalidatePath(INTAKE_PATH)
  return { expiresAt: subscription.expirationDateTime }
}

export async function stopMailboxWatch(): Promise<ActionResult<void>> {
  return guard(runStopMailboxWatch)
}

async function runStopMailboxWatch(): Promise<void> {
  const settings = await loadIntakeSettings()
  const payload = await getPayload()
  if (settings.subscriptionId) {
    await deleteMailboxSubscription(readGraphConfiguration(), settings.subscriptionId).catch((err) => {
      const reason = err instanceof Error ? err.message : 'no reason was given'
      console.error('[intake] the mailbox connection could not be closed', { reason })
      throw new UserFacingError(`Microsoft would not close the connection. It said: ${reason}`)
    })
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
