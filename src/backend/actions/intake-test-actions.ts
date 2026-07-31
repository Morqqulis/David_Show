'use server'

import { revalidatePath } from 'next/cache'
import type { Payload } from 'payload'
import { getPayload } from '../lib/payload'
import { createPayloadIntakeStore } from '../lib/payload-intake-store'
import { type IntakeMessage } from '../lib/intake-attachments'
import {
  BUILT_IN_INVOICE_FIELDS,
  PREBUILT_INVOICE_SOURCE_FIELDS,
  type InvoiceOcr,
  type OcrResult,
} from '../lib/intake-field-mapping'
import {
  createDocumentIntelligenceOcr,
  isDocumentIntelligenceConfigured,
  readDocumentIntelligenceConfig,
} from '../lib/document-intelligence'
import {
  createIntakeTrace,
  runIntake,
  type IntakeConfig,
  type IntakeOutcome,
  type IntakeStore,
  type IntakeTrace,
} from '../lib/intake-pipeline'
import { guard, UserFacingError, type ActionResult } from '../../lib/action-result'

/**
 * The manual check behind Settings → Test invoice reading.
 *
 * It runs `runIntake` — the same function the mailbox webhook runs — against a
 * file somebody hands it, and reports every step. The only things it supplies
 * itself are the two the mailbox supplies from outside: the message, and the
 * reading of the document. Everything after that is the real thing.
 *
 * A dry run swaps the five writing methods of `IntakeStore` for recorders and
 * leaves the reading ones alone, which is what makes it provably harmless: the
 * whole flow runs, and there is no code path from it to a database write.
 */

// Nothing but async functions may be exported from a 'use server' module, so
// these stay private and the sender travels back inside the report instead.

/** The sender recorded against a check run. No real email was involved. */
const CHECK_SENDER = 'intake-test@aurora.ap'

const MAX_FILE_BYTES = 50 * 1024 * 1024
const MAX_VALUE_LENGTH = 200

export type ManualReading = { source: string; value: string; confidence: number }

export type IntakeTestReport = {
  /** `service` — the reading service read the file. `manual` — values were typed in. */
  readingSource: 'service' | 'manual'
  committed: boolean
  file: { name: string; contentType: string; size: number }
  senderAddress: string
  subject: string
  trace: IntakeTrace
  outcome: IntakeOutcome
  /** Vendor master name behind the matched id, for display. */
  matchedVendorName: string | null
  /** App field key to the label a person sees. */
  fieldLabels: Record<string, string>
  /** True when the mapping table has rows of its own rather than the shipped set. */
  mappingIsConfigured: boolean
}

export async function runIntakeCheck(formData: FormData): Promise<ActionResult<IntakeTestReport>> {
  return guard(() => runIntakeCheckInner(formData))
}

async function runIntakeCheckInner(formData: FormData): Promise<IntakeTestReport> {
  const commit = formData.get('commit') === '1'
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    throw new UserFacingError('Choose a file first — there is nothing to check.')
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new UserFacingError('That file is larger than 50 MB, which is more than can be checked.')
  }

  const useService = isDocumentIntelligenceConfigured()
  const manual = useService ? [] : parseManualReadings(formData.get('manual'))
  const payload = await getPayload()
  const actorId = await defaultActorId(payload)

  const buffer = Buffer.from(await file.arrayBuffer())
  const subject = `Invoice reading check — ${file.name}`
  const message = buildMessage(file, buffer, subject)
  const ocr = useService
    ? createDocumentIntelligenceOcr(readDocumentIntelligenceConfig())
    : manualOcr(manual)

  const store = createCheckStore(payload, actorId, commit ? 'commit' : 'dry')
  const trace = createIntakeTrace()

  let outcome: IntakeOutcome
  try {
    outcome = await runIntake({ message, ocr, store, trace })
  } catch (err) {
    console.error('[intake-check] the run could not be completed', {
      committed: commit,
      readingSource: useService ? 'service' : 'manual',
      fileName: file.name,
      contentType: file.type,
      bytes: file.size,
      message: err instanceof Error ? err.message : 'unknown error',
    })
    // Wording differs by mode on purpose. A dry run cannot have written
    // anything, so it can promise that. Creating for real is several steps —
    // the invoice, then its document, then its history — and a failure part
    // way through leaves the earlier ones in place, so it must not promise it.
    throw new UserFacingError(
      commit
        ? 'Something went wrong part way through creating this invoice. Look in To Be Assigned before trying again — it may already be there, possibly without its document attached.'
        : 'The check could not be finished. Nothing was changed and no invoice was created. Try again in a moment.',
    )
  }

  if (commit && outcome.invoices.length > 0) {
    revalidatePath('/requests')
    revalidatePath('/dashboard')
  }

  return {
    readingSource: useService ? 'service' : 'manual',
    committed: commit,
    file: { name: file.name, contentType: file.type || 'application/octet-stream', size: file.size },
    senderAddress: CHECK_SENDER,
    subject,
    trace,
    outcome,
    matchedVendorName: await vendorName(payload, trace),
    fieldLabels: await fieldLabels(payload),
    mappingIsConfigured: await hasMappingRows(payload),
  }
}

async function defaultActorId(payload: Payload) {
  const admin = await payload.find({
    collection: 'users',
    where: { email: { equals: 'david@aurora.ca' } },
    limit: 1,
  })
  return admin.docs[0]?.id
}

/**
 * The file, dressed as the one-attachment message the pipeline consumes. The
 * type and size are the file's own, so the file-type rules decide whether it
 * goes for reading exactly as they would for a real attachment.
 */
function buildMessage(file: File, buffer: Buffer, subject: string): IntakeMessage {
  const now = new Date().toISOString()
  return {
    id: `check-${now}-${Math.random().toString(36).slice(2, 10)}`,
    internetMessageId: `<check-${now}@aurora.ap>`,
    from: CHECK_SENDER,
    subject,
    receivedAt: now,
    bodyHtml: '',
    attachments: [
      {
        id: 'check-attachment',
        name: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        isInline: false,
        contentId: null,
        content: async () => buffer,
      },
    ],
  }
}

/** Values a person typed in, presented to the pipeline as an extraction. */
function manualOcr(readings: ManualReading[]): InvoiceOcr {
  const result: OcrResult = { fields: {}, pages: 1 }
  for (const reading of readings) {
    result.fields[reading.source] = { value: reading.value, confidence: reading.confidence }
  }
  return { extract: async () => result }
}

function parseManualReadings(raw: FormDataEntryValue | null): ManualReading[] {
  if (typeof raw !== 'string' || raw.trim() === '') return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.error('[intake-check] the typed-in readings could not be read', { length: raw.length })
    throw new UserFacingError('The details you typed in could not be read. Reload the page and try again.')
  }
  if (!Array.isArray(parsed)) throw new UserFacingError('The details you typed in could not be read.')

  // Validated against the model's own field list rather than a copy of the
  // eight the form offers, so the two can never drift apart.
  const allowed = new Set(PREBUILT_INVOICE_SOURCE_FIELDS.map((f) => f.name))
  const readings: ManualReading[] = []
  for (const entry of parsed) {
    const row = entry as { source?: unknown; value?: unknown; confidence?: unknown }
    if (typeof row.source !== 'string' || !allowed.has(row.source)) continue
    if (typeof row.value !== 'string' || row.value.trim() === '') continue
    const confidence = Number(row.confidence)
    readings.push({
      source: row.source,
      value: row.value.trim().slice(0, MAX_VALUE_LENGTH),
      confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
    })
  }
  return readings
}

async function vendorName(payload: Payload, trace: IntakeTrace): Promise<string | null> {
  const id = trace.units[0]?.vendorMatch.vendorId
  if (id === null || id === undefined) return null
  try {
    const vendor = await payload.findByID({ collection: 'vendors', id, depth: 0 })
    return (vendor as { name?: string }).name ?? null
  } catch (err) {
    console.error('[intake-check] the matched vendor could not be looked up', {
      vendorId: id,
      message: err instanceof Error ? err.message : 'unknown error',
    })
    return null
  }
}

async function fieldLabels(payload: Payload): Promise<Record<string, string>> {
  const labels: Record<string, string> = {}
  for (const field of BUILT_IN_INVOICE_FIELDS) labels[field.key] = field.label
  const res = await payload.find({
    collection: 'fields',
    where: { scope: { equals: 'header' } },
    limit: 200,
    depth: 0,
  })
  for (const doc of res.docs as Array<{ fieldKey?: string; label?: string }>) {
    if (doc.fieldKey && doc.label && !labels[doc.fieldKey]) labels[doc.fieldKey] = doc.label
  }
  return labels
}

async function hasMappingRows(payload: Payload): Promise<boolean> {
  const res = await payload.find({ collection: 'ocr-field-map', limit: 1, depth: 0 })
  return res.docs.length > 0
}

/**
 * The store the check runs against.
 *
 * Built on the mailbox's own store, not a second copy of it: a check harness
 * that drifts from the code it checks is worse than none. Two deliberate
 * overrides sit on top.
 *
 * `enabled` and the sender rule are forced open. Both exist to decide whether
 * an *unsolicited* email deserves to become an invoice; a person standing at
 * this screen with a file in hand is the authority those rules protect. This is
 * the same override the "release a held email" path already makes. Nothing else
 * is overridden — the confidence bar, the mapping table, the vendor master, the
 * tolerance and the duplicate rule are all the live configuration.
 *
 * In `dry` mode every reading method stays live and every writing method does
 * nothing, so a run cannot leave a trace behind.
 */
function createCheckStore(
  payload: Payload,
  actorId: string | number | undefined,
  mode: 'dry' | 'commit',
): IntakeStore {
  const store = createPayloadIntakeStore(payload, actorId)

  const loadConfig = async (): Promise<IntakeConfig> => ({
    ...(await store.loadConfig()),
    enabled: true,
    senderPolicy: { mode: 'public' as const, internalDomains: [] },
  })

  // Every check run carries a fresh message reference, so nothing it does can
  // ever look like a repeat of an earlier one.
  const hasProcessed = async () => false

  if (mode === 'commit') return { ...store, loadConfig, hasProcessed }

  return {
    ...store,
    loadConfig,
    hasProcessed,
    async createInvoice(draft) {
      return { id: 'preview', invoiceNumber: draft.invoiceNumber }
    },
    async attachDocument() {},
    async recordIntakeEvent() {},
    async quarantineMessage() {},
    async deliverReceipt() {},
  }
}
