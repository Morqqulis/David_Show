'use server'

import { revalidatePath } from 'next/cache'
import type { Payload } from 'payload'
import { getPayload } from '../lib/payload'
import { resolveDuplicateOutcome, type DuplicateRule } from '../lib/duplicate-detection'
import { processMailboxNotification, type IntakeOutcome } from '../lib/intake-pipeline'
import {
  createPayloadIntakeStore,
  findDuplicateCandidates,
  readDuplicateRule,
  readIntakeSettings,
  type IntakeSettingsDoc,
} from '../lib/payload-intake-store'
import { createGraphMailbox, readGraphConfiguration, resolveMailboxId } from '../lib/graph-mailbox'
import { createDocumentIntelligenceOcr, readDocumentIntelligenceConfig } from '../lib/document-intelligence'
import { guard, UserFacingError, type ActionResult } from '../../lib/action-result'

/**
 * The entry points that drive email intake.
 *
 * The database side lives in backend/lib/payload-intake-store.ts — see the note
 * there for why it cannot live in this file.
 */


async function defaultActorId(payload: Payload) {
  const admin = await payload.find({
    collection: 'users',
    where: { email: { equals: 'david@aurora.ca' } } as never,
    limit: 1,
  })
  return admin.docs[0]?.id
}

// The store implementation and the config/settings readers moved to
// backend/lib/payload-intake-store.ts. A `'use server'` file may only export
// async functions, so the store factory could not be shared from here — and the
// manual check screen grew a second copy of it as a result. These two remain as
// server actions because screens call them directly.

export async function loadIntakeSettings(): Promise<IntakeSettingsDoc & { id?: string | number }> {
  return readIntakeSettings(await getPayload())
}

export async function loadDuplicateRule(): Promise<DuplicateRule> {
  return readDuplicateRule(await getPayload())
}


/**
 * Reads one message out of the mailbox and turns it into invoices.
 *
 * Called by the change-notification route after it has answered Microsoft, and
 * again by an admin releasing a held message. The message is always fetched
 * back from the mailbox by id — a notification's payload is never trusted as
 * the source of truth.
 */
export async function runIntakeForMessage(messageId: string): Promise<IntakeOutcome> {
  const payload = await getPayload()
  const actorId = await defaultActorId(payload)
  const settings = await loadIntakeSettings()

  if (!settings.mailboxAddress) {
    throw new Error('No mailbox address has been set, so nothing can be collected.')
  }

  const graph = readGraphConfiguration()
  const mailbox = createGraphMailbox(graph, await resolveMailboxId(graph, settings.mailboxAddress))
  const ocr = createDocumentIntelligenceOcr(readDocumentIntelligenceConfig())
  const store = createPayloadIntakeStore(payload, actorId)

  const outcome = await processMailboxNotification({ messageId, mailbox, ocr, store })

  if (outcome.invoices.length > 0) {
    revalidatePath('/requests')
    revalidatePath('/dashboard')
  }
  return outcome
}

/** An admin decided a held message is genuine. It runs the normal intake path. */
export async function releaseQuarantinedMessage(
  id: string | number,
): Promise<ActionResult<{ created: number }>> {
  return guard(() => runReleaseQuarantinedMessage(id))
}

async function runReleaseQuarantinedMessage(id: string | number): Promise<{ created: number }> {
  const payload = await getPayload()
  const actorId = await defaultActorId(payload)
  const held = (await payload.findByID({
    collection: 'intake-quarantine' as never,
    id: id as never,
    depth: 0,
  })) as { messageId: string }

  try {
    // Releasing bypasses the sender check by design: an administrator looking
    // at the message is the authority the policy exists to protect.
    const outcome = await runIntakeForMessageBypassingPolicy(held.messageId)
    await payload.update({
      collection: 'intake-quarantine' as never,
      id: id as never,
      data: { released: true, releasedAt: new Date().toISOString(), releasedBy: actorId, releaseError: null } as never,
    })
    revalidatePath('/settings/quarantine')
    revalidatePath('/requests')
    return { created: outcome.invoices.length }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'The message could not be collected.'
    console.error('[intake] releasing a held message failed', { quarantineId: id, reason })
    await payload.update({
      collection: 'intake-quarantine' as never,
      id: id as never,
      data: { releaseError: reason } as never,
    })
    revalidatePath('/settings/quarantine')
    // The reason is already recorded on the held message; showing the same
    // words in the toast saves the admin a trip to the row they just clicked.
    throw new UserFacingError(reason)
  }
}

/**
 * The release path. Identical to normal intake except the sender policy is
 * treated as public for this one message, and the message-level key from the
 * original rejection is cleared so the run is not skipped as already handled.
 */
async function runIntakeForMessageBypassingPolicy(messageId: string): Promise<IntakeOutcome> {
  const payload = await getPayload()
  const actorId = await defaultActorId(payload)
  const settings = await loadIntakeSettings()
  if (!settings.mailboxAddress) throw new Error('No mailbox address has been set.')

  const previous = await payload.find({
    collection: 'intake-events' as never,
    where: { messageKey: { equals: `${messageId}::message` } } as never,
    limit: 1,
    depth: 0,
  })
  const held = previous.docs[0] as { id: string | number } | undefined
  if (held) await payload.delete({ collection: 'intake-events' as never, id: held.id as never })

  const store = createPayloadIntakeStore(payload, actorId)
  const base = store.loadConfig.bind(store)
  store.loadConfig = async () => ({
    ...(await base()),
    enabled: true,
    senderPolicy: { mode: 'public', internalDomains: [] },
  })

  const graph = readGraphConfiguration()
  const mailbox = createGraphMailbox(graph, await resolveMailboxId(graph, settings.mailboxAddress))
  const ocr = createDocumentIntelligenceOcr(readDocumentIntelligenceConfig())
  return processMailboxNotification({ messageId, mailbox, ocr, store })
}

/**
 * The duplicate check for an invoice somebody types in, which the rule applies
 * to as well as emailed ones. Returns what the configured action means for this
 * invoice; the caller creates, flags or refuses accordingly.
 */
export async function evaluateManualInvoiceDuplicate(fields: {
  invoiceNumber?: string
  vendorName?: string
  poNumber?: string
  subtotal?: number | null
  totalTax?: number | null
  grandTotal?: number | null
  invoiceDate?: string
  dueDate?: string
  fiscalYear?: string
}): Promise<{ blocked: boolean; flagged: boolean; matches: Array<{ invoiceNumber: string }> }> {
  const rule = await loadDuplicateRule()
  if (!rule.appliesToManualEntry) return { blocked: false, flagged: false, matches: [] }

  const payload = await getPayload()
  const candidates = await findDuplicateCandidates(payload, fields, rule)
  const outcome = resolveDuplicateOutcome(fields, candidates, rule)
  return {
    blocked: outcome.blocked,
    flagged: outcome.flagged,
    matches: outcome.matches.map((m) => ({ invoiceNumber: m.invoiceNumber })),
  }
}
