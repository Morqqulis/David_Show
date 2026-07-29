import { classifyAttachments, type AttachmentPolicy, type IntakeAttachment, type IntakeMessage, type MailboxSource } from './intake-attachments'
import { DEFAULT_AMOUNT_TOLERANCE, parseAmount, parseIsoDate, reconcileAmounts, type Reconciliation } from './intake-amounts'
import { applyFieldMapping, BUILT_IN_INVOICE_FIELDS, type InvoiceOcr, type MappedExtraction, type OcrFieldMapping, type OcrResult } from './intake-field-mapping'
import { matchVendor, type VendorMatch, type VendorRecord } from './intake-vendor-match'
import { evaluateSenderPolicy, senderRejectionMessage, type SenderPolicy, type SenderRejectionReason } from './intake-sender-policy'
import { resolveDuplicateOutcome, type DuplicateCandidate, type DuplicateRule } from './duplicate-detection'
import { DEFAULT_EMAIL_WRAPPER, renderEmail, type EmailWrapper } from './email-render'

/**
 * Turning one email into invoices.
 *
 * Everything that touches a network — the mailbox, the extraction service, the
 * database — arrives as a parameter, so the whole flow runs in a test with
 * fakes and no connection to anything.
 *
 * ## Failure and retry, and the alternative that was rejected
 *
 * Microsoft Graph gives a webhook three seconds to answer and then retries a
 * failed delivery for up to four hours. Reading a scan takes five to thirty
 * seconds, so the work cannot happen inside the response.
 *
 * *Rejected — a queue table drained by a background worker.* Textbook fit for a
 * slow job behind a fast webhook, and retry timing would be ours to control.
 * But this application has no worker, no scheduler and no queue runtime; adding
 * one means a new deployment component whose failure mode is silence, and
 * "invoices stopped appearing and nothing said so" is the worst outcome here.
 *
 * *Chosen — answer immediately, work afterwards, with the mailbox as the queue.*
 * The webhook answers Graph at once and the framework runs this pipeline after
 * the response is sent. Every unit of work carries an idempotency key
 * (`messageKey`), so Graph's own four-hour retry is the retry mechanism and a
 * repeated delivery is free rather than harmful. Anything that fails outright
 * leaves an intake record an admin can see and re-run, so no message is ever
 * lost quietly. The cost is that the retry cadence is Graph's rather than ours,
 * which is acceptable for a mailbox that receives a few dozen messages a day.
 *
 * The file runs slightly past the 200-line guide because splitting the reply
 * wording away from the flow that decides which reply applies would put one
 * decision in two files.
 */

export type IntakeConfig = {
  enabled: boolean
  senderPolicy: SenderPolicy
  attachmentPolicy: AttachmentPolicy
  mapping: OcrFieldMapping[]
  confidenceThreshold: number
  amountTolerance: number
  duplicateRule: DuplicateRule
  /** Header field keys from Settings → Fields; anything here goes to customFields. */
  customFieldKeys: string[]
  /** Absolute address of this app, used to build the link in the reply. */
  appBaseUrl?: string
  wrapper?: EmailWrapper
}

export type IntakeFlags = {
  noAttachment: boolean
  ocrFailed: boolean
  vendorSetupRequired: boolean
  possibleDuplicate: boolean
  /** Amount Before Taxes plus Total Tax does not equal the Invoice Total. */
  amountMismatch: boolean
}

export type IntakeProvenance = {
  sender: string
  subject: string
  receivedAt: string
  messageId: string
  internetMessageId: string
  attachmentName: string | null
  amountMismatch: boolean
  amountDifference: number
}

export type IntakeInvoiceDraft = {
  invoiceNumber: string
  vendorId: string | number | null
  invoiceDate: string | null
  dueDate: string | null
  poNumber: string | null
  subtotal: number | null
  totalTax: number | null
  grandTotal: number | null
  customFields: Record<string, string>
  /** App field keys whose values were read off the scan, not typed by a person. */
  ocrFields: string[]
  ocrConfidence: number | null
  createdVia: 'email'
  flags: IntakeFlags
  intake: IntakeProvenance
}

export type RenderedReceipt = {
  to: string
  kind: 'created' | 'created_no_attachment' | 'quarantined'
  /** Mailbox reference of the email being replied to, so the reply is auditable. */
  messageId: string
  subject: string
  fromLine: string
  html: string
}

export type IntakeEventEntry = {
  messageKey: string
  messageId: string
  internetMessageId: string
  sender: string
  subject: string
  receivedAt: string
  status: 'created' | 'quarantined' | 'blocked_duplicate' | 'skipped' | 'failed'
  invoiceId: string | number | null
  attachmentName: string | null
  ocrStatus: 'extracted' | 'failed' | 'skipped' | null
  extraction: OcrResult | null
  appliedValues: Record<string, unknown> | null
  confidenceThreshold: number
  failureReason: string | null
}

/** Everything the pipeline needs from the database, and nothing else. */
export interface IntakeStore {
  loadConfig(): Promise<IntakeConfig>
  listVendors(): Promise<VendorRecord[]>
  listDuplicateCandidates(
    fields: Record<string, unknown>,
    rule: DuplicateRule,
  ): Promise<DuplicateCandidate[]>
  hasProcessed(messageKey: string): Promise<boolean>
  nextIntakeReference(receivedAt: string): Promise<string>
  createInvoice(draft: IntakeInvoiceDraft): Promise<{ id: string | number; invoiceNumber: string }>
  attachDocument(
    invoiceId: string | number,
    file: { name: string; contentType: string; buffer: Buffer },
  ): Promise<void>
  recordIntakeEvent(entry: IntakeEventEntry): Promise<void>
  quarantineMessage(entry: {
    sender: string
    subject: string
    receivedAt: string
    reason: SenderRejectionReason
    messageId: string
    internetMessageId: string
    attachmentCount: number
  }): Promise<void>
  isSuppressed(address: string): Promise<boolean>
  /** The single seam an outgoing message leaves through. */
  deliverReceipt(receipt: RenderedReceipt): Promise<void>
}

export type IntakeOutcome = {
  status: 'processed' | 'quarantined' | 'skipped' | 'disabled'
  invoices: Array<{ id: string | number; invoiceNumber: string; attachmentName: string | null }>
  blocked: Array<{ attachmentName: string | null; reason: string }>
}

/**
 * An optional write-only record of what one run did, step by step.
 *
 * Nothing in the flow ever reads it and it is absent unless a caller asks for
 * it, so the decisions below are identical with and without it. It exists for
 * the manual check screen in Settings, which has to show a finance clerk how a
 * document turned into an invoice rather than just handing them the result.
 */
export type IntakeAttachmentSummary = { name: string; contentType: string; size: number }

export type IntakeUnitTrace = {
  attachmentName: string | null
  contentType: string | null
  size: number | null
  /** The file's type qualified it for reading, so the extraction service was called. */
  sentForReading: boolean
  ocrStatus: 'extracted' | 'failed' | 'skipped' | null
  ocrFailure: string | null
  extraction: OcrResult | null
  confidenceThreshold: number
  mapping: OcrFieldMapping[]
  mapped: MappedExtraction
  vendorName: string
  vendorMatch: VendorMatch
  amounts: {
    subtotal: number | null
    totalTax: number | null
    grandTotal: number | null
    tolerance: number
    reconciliation: Reconciliation
  }
  duplicate: {
    rule: DuplicateRule
    candidatesCompared: number
    signature: string | null
    matches: Array<{ id: string | number; invoiceNumber: string }>
    blocked: boolean
    flagged: boolean
  }
  draft: IntakeInvoiceDraft | null
  created: { id: string | number; invoiceNumber: string } | null
  blockedReason: string | null
}

export type IntakeTrace = {
  senderAccepted: boolean
  senderRejection: SenderRejectionReason | null
  classification: {
    forReading: IntakeAttachmentSummary[]
    attachedOnly: IntakeAttachmentSummary[]
    ignored: IntakeAttachmentSummary[]
  }
  units: IntakeUnitTrace[]
}

export function createIntakeTrace(): IntakeTrace {
  return {
    senderAccepted: true,
    senderRejection: null,
    classification: { forReading: [], attachedOnly: [], ignored: [] },
    units: [],
  }
}

function summarise(attachment: IntakeAttachment): IntakeAttachmentSummary {
  return { name: attachment.name, contentType: attachment.contentType, size: attachment.size }
}

function startUnitTrace(
  trace: IntakeTrace,
  attachment: IntakeAttachment | null,
  extractable: boolean,
  config: IntakeConfig,
): IntakeUnitTrace {
  const unit: IntakeUnitTrace = {
    attachmentName: attachment?.name ?? null,
    contentType: attachment?.contentType ?? null,
    size: attachment?.size ?? null,
    sentForReading: extractable,
    ocrStatus: attachment ? 'skipped' : null,
    ocrFailure: null,
    extraction: null,
    confidenceThreshold: config.confidenceThreshold,
    mapping: config.mapping,
    mapped: { values: {}, confidences: {}, belowThreshold: [], notFound: [] },
    vendorName: '',
    vendorMatch: { vendorId: null, ambiguous: false, score: 0 },
    amounts: {
      subtotal: null,
      totalTax: null,
      grandTotal: null,
      tolerance: config.amountTolerance ?? DEFAULT_AMOUNT_TOLERANCE,
      reconciliation: { reconciles: true, checked: false, difference: 0 },
    },
    duplicate: {
      rule: config.duplicateRule,
      candidatesCompared: 0,
      signature: null,
      matches: [],
      blocked: false,
      flagged: false,
    },
    draft: null,
    created: null,
    blockedReason: null,
  }
  trace.units.push(unit)
  return unit
}

const MESSAGE_LEVEL_KEY = 'message'

export async function runIntake(input: {
  message: IntakeMessage
  ocr: InvoiceOcr
  store: IntakeStore
  /** Filled in as the run proceeds. Never read by the flow. */
  trace?: IntakeTrace
}): Promise<IntakeOutcome> {
  const { message, ocr, store, trace } = input
  const config = await store.loadConfig()
  const empty: IntakeOutcome = { status: 'skipped', invoices: [], blocked: [] }

  if (!config.enabled) {
    if (await store.hasProcessed(unitKey(message, MESSAGE_LEVEL_KEY))) return empty
    await store.recordIntakeEvent(
      baseEvent(message, MESSAGE_LEVEL_KEY, config, {
        status: 'skipped',
        failureReason: 'Email intake is switched off, so this message was not turned into an invoice.',
      }),
    )
    return { ...empty, status: 'disabled' }
  }

  const decision = evaluateSenderPolicy(message.from, config.senderPolicy)
  if (trace) {
    trace.senderAccepted = decision.accepted
    trace.senderRejection = decision.reason
  }
  if (!decision.accepted && decision.reason) {
    if (await store.hasProcessed(unitKey(message, MESSAGE_LEVEL_KEY))) return empty
    await store.quarantineMessage({
      sender: message.from,
      subject: message.subject,
      receivedAt: message.receivedAt,
      reason: decision.reason,
      messageId: message.id,
      internetMessageId: message.internetMessageId,
      attachmentCount: message.attachments.length,
    })
    await store.recordIntakeEvent(
      baseEvent(message, MESSAGE_LEVEL_KEY, config, {
        status: 'quarantined',
        failureReason: senderRejectionMessage(decision.reason),
      }),
    )
    await maybeDeliver(store, config, message, 'quarantined', [], decision.reason)
    return { ...empty, status: 'quarantined' }
  }

  const sorted = classifyAttachments(message, config.attachmentPolicy)
  const units = [...sorted.forOcr, ...sorted.attachOnly]
  const extractable = new Set(sorted.forOcr.map((a) => a.id))
  if (trace) {
    trace.classification = {
      forReading: sorted.forOcr.map(summarise),
      attachedOnly: sorted.attachOnly.map(summarise),
      ignored: sorted.discarded.map(summarise),
    }
  }

  const pending: Array<IntakeAttachment | null> = []
  for (const attachment of units) {
    if (!(await store.hasProcessed(unitKey(message, attachment.id)))) pending.push(attachment)
  }
  // No genuine attachment at all: the email itself still becomes an invoice, so
  // Finance sees it in the queue instead of it evaporating. The body is never
  // read — pulling figures out of prose is a different and far less reliable
  // problem, and one this version does not attempt.
  if (units.length === 0 && !(await store.hasProcessed(unitKey(message, MESSAGE_LEVEL_KEY)))) {
    pending.push(null)
  }
  if (pending.length === 0) return empty

  const outcome: IntakeOutcome = { status: 'processed', invoices: [], blocked: [] }
  for (const attachment of pending) {
    const created = await processOne({
      message,
      attachment,
      extractable: attachment !== null && extractable.has(attachment.id),
      config,
      ocr,
      store,
      trace,
    })
    if (created.invoice) outcome.invoices.push(created.invoice)
    if (created.blocked) outcome.blocked.push(created.blocked)
  }

  if (outcome.invoices.length > 0) {
    const kind = units.length === 0 ? 'created_no_attachment' : 'created'
    await maybeDeliver(store, config, message, kind, outcome.invoices, null)
  }
  return outcome
}

/**
 * The webhook's entry point. The notification's payload is never trusted as the
 * source of truth — the message is always fetched back from the mailbox by id.
 */
export async function processMailboxNotification(input: {
  messageId: string
  mailbox: MailboxSource
  ocr: InvoiceOcr
  store: IntakeStore
}): Promise<IntakeOutcome> {
  const message = await input.mailbox.fetchMessage(input.messageId)
  const outcome = await runIntake({ message, ocr: input.ocr, store: input.store })
  if (outcome.status !== 'skipped') await input.mailbox.markProcessed(input.messageId)
  return outcome
}

async function processOne(args: {
  message: IntakeMessage
  attachment: IntakeAttachment | null
  extractable: boolean
  config: IntakeConfig
  ocr: InvoiceOcr
  store: IntakeStore
  trace?: IntakeTrace
}): Promise<{
  invoice: { id: string | number; invoiceNumber: string; attachmentName: string | null } | null
  blocked: { attachmentName: string | null; reason: string } | null
}> {
  const { message, attachment, extractable, config, ocr, store, trace } = args
  const key = attachment ? attachment.id : MESSAGE_LEVEL_KEY
  const name = attachment?.name ?? null
  // Pushed now and filled in as the run proceeds, so both exit paths below —
  // blocked as a duplicate, and created — leave a complete record without the
  // flow having to remember to record anything at the end.
  const unit = trace ? startUnitTrace(trace, attachment, extractable, config) : null

  let bytes: Buffer | null = null
  let reading: OcrResult | null = null
  let ocrStatus: IntakeEventEntry['ocrStatus'] = attachment ? 'skipped' : null

  if (attachment) {
    bytes = await attachment.content()
    if (extractable) {
      try {
        reading = await ocr.extract({ buffer: bytes, contentType: attachment.contentType })
        ocrStatus = 'extracted'
      } catch (err) {
        // A bad scan is expected traffic, not an outage. The record is created
        // anyway with the file on it so a person can read what the machine
        // could not.
        ocrStatus = 'failed'
        if (unit) unit.ocrFailure = err instanceof Error ? err.message : 'unknown error'
        console.error('[intake] could not read an emailed attachment', {
          messageId: message.id,
          attachmentName: name,
          contentType: attachment.contentType,
          bytes: bytes.length,
          message: err instanceof Error ? err.message : 'unknown error',
        })
      }
    }
  }

  const mapped = reading
    ? applyFieldMapping(reading, config.mapping, config.confidenceThreshold)
    : { values: {}, confidences: {}, belowThreshold: [], notFound: [] }

  const vendors = await store.listVendors()
  const extractedVendor = mapped.values.vendorName ?? ''
  const vendorMatch = matchVendor(extractedVendor, vendors)

  const subtotal = parseAmount(mapped.values.subtotal ?? null)
  const totalTax = parseAmount(mapped.values.totalTax ?? null)
  const grandTotal = parseAmount(mapped.values.grandTotal ?? null)
  const balance = reconcileAmounts(subtotal, totalTax, grandTotal, config.amountTolerance ?? DEFAULT_AMOUNT_TOLERANCE)

  const keyFieldValues: Record<string, unknown> = {
    invoiceNumber: mapped.values.invoiceNumber ?? '',
    vendorName: extractedVendor,
    poNumber: mapped.values.poNumber ?? '',
    invoiceDate: mapped.values.invoiceDate ?? '',
    dueDate: mapped.values.dueDate ?? '',
    subtotal,
    totalTax,
    grandTotal,
    fiscalYear: '',
  }
  const candidates = await store.listDuplicateCandidates(keyFieldValues, config.duplicateRule)
  const duplicate = resolveDuplicateOutcome(keyFieldValues, candidates, config.duplicateRule)

  if (unit) {
    unit.ocrStatus = ocrStatus
    unit.extraction = reading
    unit.mapped = mapped
    unit.vendorName = extractedVendor
    unit.vendorMatch = vendorMatch
    unit.amounts = {
      subtotal,
      totalTax,
      grandTotal,
      tolerance: config.amountTolerance ?? DEFAULT_AMOUNT_TOLERANCE,
      reconciliation: balance,
    }
    unit.duplicate = {
      rule: config.duplicateRule,
      candidatesCompared: candidates.length,
      signature: duplicate.signature,
      matches: duplicate.matches.map((m) => ({ id: m.id, invoiceNumber: m.invoiceNumber })),
      blocked: duplicate.blocked,
      flagged: duplicate.flagged,
    }
  }

  if (duplicate.blocked) {
    const reason = `The same invoice is already in the system (${duplicate.matches
      .map((m) => m.invoiceNumber)
      .join(', ')}), and duplicates are set to be refused.`
    await store.recordIntakeEvent(
      baseEvent(message, key, config, {
        status: 'blocked_duplicate',
        attachmentName: name,
        ocrStatus,
        extraction: reading,
        failureReason: reason,
      }),
    )
    if (unit) unit.blockedReason = reason
    return { invoice: null, blocked: { attachmentName: name, reason } }
  }

  const builtIn = new Set(BUILT_IN_INVOICE_FIELDS.map((f) => f.key))
  const customFields: Record<string, string> = {}
  for (const [field, value] of Object.entries(mapped.values)) {
    if (!builtIn.has(field) && config.customFieldKeys.includes(field)) customFields[field] = value
  }

  const draft: IntakeInvoiceDraft = {
    invoiceNumber: mapped.values.invoiceNumber ?? (await store.nextIntakeReference(message.receivedAt)),
    vendorId: vendorMatch.vendorId,
    invoiceDate: parseIsoDate(mapped.values.invoiceDate ?? null),
    dueDate: parseIsoDate(mapped.values.dueDate ?? null),
    poNumber: mapped.values.poNumber ?? null,
    subtotal,
    totalTax,
    grandTotal,
    customFields,
    ocrFields: Object.keys(mapped.values),
    ocrConfidence: vendorMatch.score > 0 ? vendorMatch.score : null,
    createdVia: 'email',
    flags: {
      noAttachment: attachment === null,
      ocrFailed: ocrStatus === 'failed',
      // A name was read but nothing in the vendor master resembles it, so
      // somebody has to add the vendor. Two plausible matches is a different
      // situation: the vendor exists and a person just has to say which.
      vendorSetupRequired: extractedVendor !== '' && vendorMatch.vendorId === null && !vendorMatch.ambiguous,
      possibleDuplicate: duplicate.flagged,
      // Also a queue flag, not just intake provenance, so Finance can pull
      // every non-reconciling invoice out of All Requests instead of finding
      // them one at a time. A mismatch never blocks creation.
      amountMismatch: balance.checked && !balance.reconciles,
    },
    intake: {
      sender: message.from,
      subject: message.subject,
      receivedAt: message.receivedAt,
      messageId: message.id,
      internetMessageId: message.internetMessageId,
      attachmentName: name,
      amountMismatch: balance.checked && !balance.reconciles,
      amountDifference: balance.difference,
    },
  }

  if (unit) unit.draft = draft
  const invoice = await store.createInvoice(draft)
  if (unit) unit.created = { id: invoice.id, invoiceNumber: invoice.invoiceNumber }
  if (attachment && bytes) {
    await store.attachDocument(invoice.id, {
      name: attachment.name,
      contentType: attachment.contentType,
      buffer: bytes,
    })
  }
  await store.recordIntakeEvent(
    baseEvent(message, key, config, {
      status: 'created',
      invoiceId: invoice.id,
      attachmentName: name,
      ocrStatus,
      extraction: reading,
      appliedValues: { ...mapped.values, vendorId: vendorMatch.vendorId, belowThreshold: mapped.belowThreshold },
    }),
  )

  return { invoice: { ...invoice, attachmentName: name }, blocked: null }
}

function unitKey(message: IntakeMessage, unit: string): string {
  return `${message.id}::${unit}`
}

function baseEvent(
  message: IntakeMessage,
  unit: string,
  config: IntakeConfig,
  patch: Partial<IntakeEventEntry> & Pick<IntakeEventEntry, 'status'>,
): IntakeEventEntry {
  return {
    messageKey: unitKey(message, unit),
    messageId: message.id,
    internetMessageId: message.internetMessageId,
    sender: message.from,
    subject: message.subject,
    receivedAt: message.receivedAt,
    invoiceId: null,
    attachmentName: null,
    ocrStatus: null,
    extraction: null,
    appliedValues: null,
    confidenceThreshold: config.confidenceThreshold,
    failureReason: null,
    ...patch,
  }
}

/**
 * E-08 Invoice Received, and its failure-notice variant.
 *
 * Wording lives here as the shipped default. An administrator editing the
 * template in Settings → Email overrides it; this is what a fresh install
 * sends. `{{InvoiceList}}` and `{{HeldReason}}` are additions to the token
 * registry that this event needs.
 */
export const INTAKE_RECEIPT_TEMPLATES: Record<RenderedReceipt['kind'], { subject: string; bodyHtml: string }> = {
  created: {
    subject: 'We received your invoice — {{InvoiceList}}',
    bodyHtml:
      '<p>Hi {{Submitter}},</p><p>Thank you. Your email reached the accounts payable mailbox at {{Municipality}} and the following was created: <strong>{{InvoiceList}}</strong>.</p><p>It is now waiting to be assigned to someone. You do not need to do anything else.</p><p><a href="{{InvoiceURL}}">Open it in {{AppName}}</a></p>',
  },
  created_no_attachment: {
    subject: 'We received your email — {{InvoiceList}}',
    bodyHtml:
      '<p>Hi {{Submitter}},</p><p>Thank you. Your email reached the accounts payable mailbox at {{Municipality}} and <strong>{{InvoiceList}}</strong> was created.</p><p>There was <strong>no attachment</strong> on your message, so there is no invoice document on the record yet. Please reply to this message with the invoice file attached — there is no need to send everything again.</p><p><a href="{{InvoiceURL}}">Open it in {{AppName}}</a></p>',
  },
  quarantined: {
    subject: 'Your email to accounts payable is waiting for review',
    bodyHtml:
      '<p>Hi {{Submitter}},</p><p>Your email reached the accounts payable mailbox at {{Municipality}}, but it was not turned into an invoice automatically. {{HeldReason}}</p><p>Someone in Accounts Payable will look at it. You do not need to send it again.</p>',
  },
}

async function maybeDeliver(
  store: IntakeStore,
  config: IntakeConfig,
  message: IntakeMessage,
  kind: RenderedReceipt['kind'],
  invoices: Array<{ id: string | number; invoiceNumber: string }>,
  heldReason: SenderRejectionReason | null,
) {
  if (await store.isSuppressed(message.from)) return

  const template = INTAKE_RECEIPT_TEMPLATES[kind]
  const base = config.appBaseUrl ?? ''
  const values: Record<string, string> = {
    '{{Submitter}}': message.from,
    '{{Municipality}}': DEFAULT_EMAIL_WRAPPER.fromName.replace(/\s*—.*$/, ''),
    '{{AppName}}': 'AuroraAP',
    '{{InvoiceList}}': invoices.map((i) => i.invoiceNumber).join(', '),
    '{{InvoiceNumber}}': invoices[0]?.invoiceNumber ?? '',
    '{{InvoiceURL}}': invoices[0] ? `${base}/requests/${invoices[0].id}` : `${base}/requests`,
    '{{HeldReason}}': heldReason ? senderRejectionMessage(heldReason) : '',
  }

  const rendered = renderEmail({
    subject: template.subject,
    bodyHtml: template.bodyHtml,
    wrapper: config.wrapper ?? DEFAULT_EMAIL_WRAPPER,
    values,
  })
  await store.deliverReceipt({ to: message.from, kind, messageId: message.id, ...rendered })
}
