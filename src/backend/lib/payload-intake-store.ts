import type { Payload } from 'payload'
import { getStageBySystemId, recordAudit } from './stage-engine'
import { DEFAULT_ATTACHMENT_POLICY } from './intake-attachments'
import { DEFAULT_AMOUNT_TOLERANCE } from './intake-amounts'
import { DEFAULT_CONFIDENCE_THRESHOLD, DEFAULT_FIELD_MAPPING } from './intake-field-mapping'
import { DEFAULT_SENDER_POLICY } from './intake-sender-policy'
import { DEFAULT_DUPLICATE_RULE, type DuplicateCandidate, type DuplicateRule } from './duplicate-detection'
import type {
  IntakeConfig,
  IntakeEventEntry,
  IntakeInvoiceDraft,
  IntakeStore,
  RenderedReceipt,
} from './intake-pipeline'

/**
 * The database side of invoice intake.
 *
 * The pipeline itself knows nothing about Payload — everything it needs arrives
 * through the `IntakeStore` interface implemented here, which is what lets the
 * whole flow run in a test against fakes.
 *
 * This lives in `lib` rather than beside the intake server actions for a
 * mundane but load-bearing reason: a `'use server'` file may only export async
 * functions, so a store factory cannot be exported from one. When it lived
 * there, the manual check screen could not reach it and grew its own copy —
 * roughly two hundred lines of duplicated database access, which is exactly the
 * shape of thing that drifts. A check harness that diverges from the code it
 * checks is worse than no harness, so there is one implementation and both
 * callers import it.
 */

export type IntakeSettingsDoc = {
  enabled?: boolean
  mailboxAddress?: string
  senderPolicy?: 'internal_only' | 'public'
  internalDomains?: Array<{ domain: string }>
  confidenceThreshold?: number
  amountTolerance?: number
  subscriptionId?: string | null
  subscriptionExpiresAt?: string | null
}

export async function readIntakeSettings(
  payload: Payload,
): Promise<IntakeSettingsDoc & { id?: string | number }> {
  const res = await payload.find({ collection: 'intake-settings' as never, limit: 1, depth: 0 })
  return (res.docs[0] as (IntakeSettingsDoc & { id: string | number }) | undefined) ?? {}
}

export async function readDuplicateRule(payload: Payload): Promise<DuplicateRule> {
  const res = await payload.find({ collection: 'duplicate-rules' as never, limit: 1, depth: 0 })
  const doc = res.docs[0] as
    | (Omit<DuplicateRule, 'keyFields'> & { keyFields?: Array<{ field: string }> })
    | undefined
  if (!doc) return DEFAULT_DUPLICATE_RULE
  const keyFields = (doc.keyFields ?? []).map((k) => k.field).filter(Boolean)
  return {
    keyFields: keyFields.length > 0 ? keyFields : DEFAULT_DUPLICATE_RULE.keyFields,
    action: doc.action ?? DEFAULT_DUPLICATE_RULE.action,
    ignoreCancelled: doc.ignoreCancelled ?? DEFAULT_DUPLICATE_RULE.ignoreCancelled,
    caseInsensitive: doc.caseInsensitive ?? DEFAULT_DUPLICATE_RULE.caseInsensitive,
    appliesToManualEntry: doc.appliesToManualEntry ?? DEFAULT_DUPLICATE_RULE.appliesToManualEntry,
    windowDays: doc.windowDays ?? null,
  }
}

export async function buildIntakeConfig(payload: Payload): Promise<IntakeConfig> {
  const [settings, mapRes, headerFields, rule] = await Promise.all([
    readIntakeSettings(payload),
    payload.find({ collection: 'ocr-field-map' as never, limit: 200, depth: 0, sort: 'order' }),
    payload.find({
      collection: 'fields',
      where: { scope: { equals: 'header' } } as never,
      limit: 200,
      depth: 0,
    }),
    readDuplicateRule(payload),
  ])

  const rows = mapRes.docs as Array<{ appField: string; sourceField: string; enabled?: boolean }>
  return {
    enabled: settings.enabled ?? false,
    senderPolicy: {
      mode: settings.senderPolicy ?? DEFAULT_SENDER_POLICY.mode,
      internalDomains: (settings.internalDomains ?? []).map((d) => d.domain),
    },
    attachmentPolicy: DEFAULT_ATTACHMENT_POLICY,
    mapping:
      rows.length > 0
        ? rows.map((r) => ({
            appField: r.appField,
            sourceField: r.sourceField,
            enabled: r.enabled !== false,
          }))
        : DEFAULT_FIELD_MAPPING,
    confidenceThreshold: settings.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD,
    amountTolerance: settings.amountTolerance ?? DEFAULT_AMOUNT_TOLERANCE,
    duplicateRule: rule,
    customFieldKeys: (headerFields.docs as Array<{ fieldKey: string }>).map((f) => f.fieldKey),
    appBaseUrl: process.env.APP_BASE_URL ?? '',
  }
}

/**
 * Invoices the duplicate rule should compare against.
 *
 * Narrowed by invoice number when one was read, because that is the selective
 * part of every sensible key; with no number the comparison falls back to a
 * bounded recent window so a blank reading cannot walk the whole table.
 */
export async function findDuplicateCandidates(
  payload: Payload,
  fields: Record<string, unknown>,
  rule: DuplicateRule,
): Promise<DuplicateCandidate[]> {
  const where: Record<string, unknown> = { softDeleted: { equals: false } }
  const invoiceNumber = typeof fields.invoiceNumber === 'string' ? fields.invoiceNumber.trim() : ''
  if (invoiceNumber !== '') where.invoiceNumber = { equals: invoiceNumber }
  if (rule.windowDays !== null) {
    const since = new Date(Date.now() - rule.windowDays * 86_400_000).toISOString()
    where.createdAt = { greater_than: since }
  }

  const res = await payload.find({
    collection: 'invoices',
    where: where as never,
    limit: invoiceNumber === '' ? 200 : 50,
    depth: 1,
    sort: '-createdAt',
  })

  return (res.docs as unknown as Array<Record<string, unknown>>).map((doc) => ({
    id: doc.id as string | number,
    invoiceNumber: String(doc.invoiceNumber ?? ''),
    fields: {
      invoiceNumber: doc.invoiceNumber,
      vendorName:
        typeof doc.vendor === 'object' && doc.vendor ? (doc.vendor as { name?: string }).name : '',
      poNumber: doc.poNumber,
      invoiceDate: doc.invoiceDate,
      dueDate: doc.dueDate,
      subtotal: doc.subtotal,
      totalTax: doc.totalTax,
      grandTotal: doc.grandTotal,
      fiscalYear: doc.fiscalYear,
    },
  }))
}

export function createPayloadIntakeStore(
  payload: Payload,
  actorId: string | number | undefined,
): IntakeStore {
  return {
    loadConfig: () => buildIntakeConfig(payload),

    async listVendors() {
      const res = await payload.find({
        collection: 'vendors',
        where: { active: { equals: true } } as never,
        limit: 2000,
        depth: 0,
      })
      return (res.docs as Array<{ id: string | number; name: string }>).map((v) => ({
        id: v.id,
        name: v.name,
      }))
    },

    listDuplicateCandidates: (fields, rule) => findDuplicateCandidates(payload, fields, rule),

    async hasProcessed(messageKey) {
      const res = await payload.find({
        collection: 'intake-events' as never,
        where: { messageKey: { equals: messageKey } } as never,
        limit: 1,
        depth: 0,
      })
      return res.docs.length > 0
    },

    async nextIntakeReference(receivedAt) {
      const day = (receivedAt || new Date().toISOString()).slice(0, 10)
      // limit: 1 because only the count is wanted; asking for the rows would
      // pull every message of the day back for a number.
      const res = await payload.find({
        collection: 'intake-events' as never,
        where: { receivedAt: { greater_than_equal: `${day}T00:00:00.000Z` } } as never,
        limit: 1,
        depth: 0,
      })
      return `EMAIL-${day.replace(/-/g, '')}-${(res.totalDocs ?? 0) + 1}`
    },

    async createInvoice(draft: IntakeInvoiceDraft) {
      const stage = await getStageBySystemId(payload, 'to_be_assigned')
      if (!stage) throw new Error('The To Be Assigned queue is missing, so no invoice could be created.')

      const created = await payload.create({
        collection: 'invoices',
        data: {
          invoiceNumber: draft.invoiceNumber,
          vendor: draft.vendorId,
          invoiceDate: draft.invoiceDate ?? undefined,
          dueDate: draft.dueDate ?? undefined,
          poNumber: draft.poNumber ?? undefined,
          // `undefined`, never 0. `parseAmount` goes to the trouble of
          // returning null for an amount it could not read precisely so that
          // "we do not know" survives, and coercing it to zero here threw that
          // away at the last step: a $5,000 invoice whose total was read at low
          // confidence was stored, displayed and exported as $0.00. Zero is a
          // real amount and a claim about the invoice; a blank field is a
          // question a clerk can answer.
          subtotal: draft.subtotal ?? undefined,
          totalTax: draft.totalTax ?? undefined,
          grandTotal: draft.grandTotal ?? undefined,
          currentStage: stage.id,
          createdVia: 'email',
          ocrConfidence: draft.ocrConfidence ?? undefined,
          ocrFields: draft.ocrFields,
          customFields: draft.customFields,
          // No department and no assignee are guessed. Landing unassigned is
          // the entire purpose of the To Be Assigned queue.
          flags: {
            noAttachment: draft.flags.noAttachment,
            ocrFailed: draft.flags.ocrFailed,
            vendorSetupRequired: draft.flags.vendorSetupRequired,
            possibleDuplicate: draft.flags.possibleDuplicate,
            // Carried through so Finance can pull every non-reconciling invoice
            // out of All Requests with the flag filter. Dropping it here meant
            // the pipeline computed the flag and nothing ever stored it.
            amountMismatch: draft.flags.amountMismatch,
          },
          intake: draft.intake,
        } as never,
      })
      return { id: created.id as string | number, invoiceNumber: draft.invoiceNumber }
    },

    async attachDocument(invoiceId, file) {
      // Same upload shape as the Files tab, so an emailed document and an
      // uploaded one are indistinguishable everywhere downstream.
      const document = await payload.create({
        collection: 'documents',
        data: { invoice: invoiceId, uploadedBy: actorId, softDeleted: false } as never,
        file: {
          data: file.buffer,
          mimetype: file.contentType || 'application/octet-stream',
          name: file.name,
          size: file.buffer.length,
        },
      })
      const invoice = (await payload.findByID({
        collection: 'invoices',
        id: invoiceId as never,
        depth: 0,
      })) as { documents?: Array<string | number> | null }
      const existing = Array.isArray(invoice.documents) ? invoice.documents : []
      await payload.update({
        collection: 'invoices',
        id: invoiceId as never,
        data: { documents: [...existing, document.id] } as never,
      })
    },

    async recordIntakeEvent(entry: IntakeEventEntry) {
      await payload.create({
        collection: 'intake-events' as never,
        data: {
          messageKey: entry.messageKey,
          messageId: entry.messageId,
          internetMessageId: entry.internetMessageId,
          sender: entry.sender,
          subject: entry.subject,
          receivedAt: entry.receivedAt,
          status: entry.status,
          invoice: entry.invoiceId,
          attachmentName: entry.attachmentName,
          ocrStatus: entry.ocrStatus,
          extraction: entry.extraction,
          appliedValues: entry.appliedValues,
          confidenceThreshold: entry.confidenceThreshold,
          failureReason: entry.failureReason,
        } as never,
      })

      // The invoice audit log deliberately does not track later edits to
      // extracted values, so this entry is the only record of what the reading
      // originally said. It therefore carries the whole extraction, not just
      // "an invoice was created".
      if (entry.invoiceId) {
        await recordAudit({
          payload,
          invoiceId: entry.invoiceId,
          actorId,
          action: 'created',
          context: {
            via: 'email',
            sender: entry.sender,
            subject: entry.subject,
            receivedAt: entry.receivedAt,
            attachmentName: entry.attachmentName,
            reading: entry.ocrStatus,
            confidenceThreshold: entry.confidenceThreshold,
            extraction: entry.extraction,
            appliedValues: entry.appliedValues,
          },
        })
      }
    },

    async quarantineMessage(entry) {
      await payload.create({
        collection: 'intake-quarantine' as never,
        data: { ...entry, released: false } as never,
      })
    },

    async isSuppressed(address) {
      const email = address.trim().toLowerCase()
      const domain = email.split('@')[1] ?? ''
      const res = await payload.find({ collection: 'email-suppression' as never, limit: 500, depth: 0 })
      const rows = res.docs as Array<{ value: string; kind: 'address' | 'domain' | 'group' }>

      for (const row of rows) {
        const value = (row.value ?? '').trim().toLowerCase()
        if (value === '') continue
        if (row.kind === 'address' && value === email) return true
        if (row.kind === 'domain' && domain !== '' && (domain === value || domain.endsWith(`.${value}`)))
          return true
      }

      // A group entry names a role, e.g. "Finance Team". Everyone holding that
      // role is suppressed, which is how one entry covers a whole team.
      const groups = rows.filter((r) => r.kind === 'group').map((r) => (r.value ?? '').trim().toLowerCase())
      if (groups.length === 0) return false
      const user = await payload.find({
        collection: 'users',
        where: { email: { equals: email } } as never,
        limit: 1,
        depth: 1,
      })
      const role = (user.docs[0] as { role?: { name?: string } } | undefined)?.role?.name ?? ''
      return role !== '' && groups.includes(role.toLowerCase())
    },

    async deliverReceipt(receipt: RenderedReceipt) {
      // The single seam an outgoing message leaves through. This application
      // has no mail transport, so the composed reply is recorded against the
      // intake record instead of being handed to one — an operator can see
      // exactly what would have gone out, and wiring a transport is a change
      // to this one function.
      await payload.update({
        collection: 'intake-events' as never,
        where: { messageId: { equals: receipt.messageId } } as never,
        data: {
          receipt: { to: receipt.to, kind: receipt.kind, subject: receipt.subject, html: receipt.html },
        } as never,
      })
    },
  }
}
