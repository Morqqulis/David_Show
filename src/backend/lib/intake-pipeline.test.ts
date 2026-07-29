import { beforeEach, describe, expect, test } from 'bun:test'
import { DEFAULT_ATTACHMENT_POLICY, type IntakeAttachment, type IntakeMessage } from './intake-attachments'
import { DEFAULT_DUPLICATE_RULE, type DuplicateCandidate } from './duplicate-detection'
import {
  DEFAULT_CONFIDENCE_THRESHOLD,
  DEFAULT_FIELD_MAPPING,
  type InvoiceOcr,
  type OcrResult,
} from './intake-field-mapping'
import { DEFAULT_AMOUNT_TOLERANCE } from './intake-amounts'
import {
  runIntake,
  type IntakeConfig,
  type IntakeInvoiceDraft,
  type IntakeStore,
  type RenderedReceipt,
} from './intake-pipeline'

const CONFIG: IntakeConfig = {
  enabled: true,
  senderPolicy: { mode: 'internal_only', internalDomains: ['aurora.ca'] },
  attachmentPolicy: DEFAULT_ATTACHMENT_POLICY,
  mapping: DEFAULT_FIELD_MAPPING,
  confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
  amountTolerance: DEFAULT_AMOUNT_TOLERANCE,
  duplicateRule: DEFAULT_DUPLICATE_RULE,
  customFieldKeys: ['priority'],
}

const GOOD_READING: OcrResult = {
  pages: 1,
  fields: {
    InvoiceId: { value: 'INV-77100', confidence: 0.97 },
    VendorName: { value: 'BlueRock Construction Inc.', confidence: 0.95 },
    InvoiceDate: { value: '2026-05-08', confidence: 0.93 },
    DueDate: { value: '2026-06-07', confidence: 0.55 },
    SubTotal: { value: '4,302.65', confidence: 0.94 },
    TotalTax: { value: '558.35', confidence: 0.92 },
    InvoiceTotal: { value: '4,861.00', confidence: 0.96 },
  },
}

function attachment(patch: Partial<IntakeAttachment> = {}): IntakeAttachment {
  return {
    id: patch.id ?? 'att-1',
    name: patch.name ?? 'invoice.pdf',
    contentType: patch.contentType ?? 'application/pdf',
    size: patch.size ?? 90_000,
    isInline: patch.isInline ?? false,
    contentId: patch.contentId ?? null,
    content: patch.content ?? (async () => Buffer.from('%PDF-1.4')),
  }
}

function message(patch: Partial<IntakeMessage> = {}): IntakeMessage {
  return {
    id: patch.id ?? 'msg-1',
    internetMessageId: patch.internetMessageId ?? '<abc@aurora.ca>',
    from: patch.from ?? 'marcus.patel@aurora.ca',
    subject: patch.subject ?? 'FW: BlueRock invoice',
    receivedAt: patch.receivedAt ?? '2026-07-29T14:02:00.000Z',
    bodyHtml: patch.bodyHtml ?? '<p>Please process.</p>',
    attachments: patch.attachments ?? [attachment()],
  }
}

/** A complete in-memory stand-in for every port the pipeline uses. */
class FakeStore implements IntakeStore {
  config: IntakeConfig = { ...CONFIG }
  vendors = [
    { id: 1, name: 'BlueRock Construction Inc.' },
    { id: 2, name: 'Northern Paving Ltd.' },
  ]
  duplicates: DuplicateCandidate[] = []
  suppressed = new Set<string>()
  processedKeys = new Set<string>()

  created: IntakeInvoiceDraft[] = []
  documents: Array<{ invoiceId: string | number; name: string; bytes: number }> = []
  events: Array<Record<string, unknown>> = []
  quarantined: Array<Record<string, unknown>> = []
  delivered: RenderedReceipt[] = []
  private sequence = 0

  async loadConfig() {
    return this.config
  }
  async listVendors() {
    return this.vendors
  }
  async listDuplicateCandidates() {
    return this.duplicates
  }
  async hasProcessed(key: string) {
    return this.processedKeys.has(key)
  }
  async nextIntakeReference() {
    this.sequence += 1
    return `EMAIL-20260729-${this.sequence}`
  }
  async createInvoice(draft: IntakeInvoiceDraft) {
    this.created.push(draft)
    return { id: this.created.length, invoiceNumber: draft.invoiceNumber }
  }
  async attachDocument(invoiceId: string | number, file: { name: string; contentType: string; buffer: Buffer }) {
    this.documents.push({ invoiceId, name: file.name, bytes: file.buffer.length })
  }
  async recordIntakeEvent(entry: Record<string, unknown>) {
    this.processedKeys.add(String(entry.messageKey))
    this.events.push(entry)
  }
  async quarantineMessage(entry: Record<string, unknown>) {
    this.quarantined.push(entry)
  }
  async isSuppressed(address: string) {
    return this.suppressed.has(address.toLowerCase())
  }
  async deliverReceipt(receipt: RenderedReceipt) {
    this.delivered.push(receipt)
  }
}

const okOcr: InvoiceOcr = { extract: async () => GOOD_READING }
const failingOcr: InvoiceOcr = {
  extract: async () => {
    throw new Error('page could not be rasterised')
  },
}

let store: FakeStore
beforeEach(() => {
  store = new FakeStore()
})

describe('runIntake — one invoice per genuine attachment', () => {
  test('a single attachment becomes one invoice with the readings filled in', async () => {
    const outcome = await runIntake({ message: message(), ocr: okOcr, store })

    expect(outcome.status).toBe('processed')
    expect(store.created).toHaveLength(1)
    const draft = store.created[0]
    expect(draft.invoiceNumber).toBe('INV-77100')
    expect(draft.vendorId).toBe(1)
    expect(draft.invoiceDate).toBe('2026-05-08')
    expect(draft.subtotal).toBe(4302.65)
    expect(draft.totalTax).toBe(558.35)
    expect(draft.grandTotal).toBe(4861)
    expect(store.documents).toHaveLength(1)
  })

  test('two attachments become two separate invoices', async () => {
    const msg = message({
      attachments: [attachment({ id: 'a', name: 'one.pdf' }), attachment({ id: 'b', name: 'two.pdf' })],
    })
    await runIntake({ message: msg, ocr: okOcr, store })

    expect(store.created).toHaveLength(2)
    expect(store.documents.map((d) => d.name)).toEqual(['one.pdf', 'two.pdf'])
  })

  test('an inline logo does not become an invoice', async () => {
    const msg = message({
      bodyHtml: '<p>Hi</p><img src="cid:logo@aurora">',
      attachments: [
        attachment({ id: 'logo', name: 'logo.png', contentType: 'image/png', contentId: 'logo@aurora', size: 3_000 }),
        attachment({ id: 'real', name: 'invoice.pdf' }),
      ],
    })
    await runIntake({ message: msg, ocr: okOcr, store })

    expect(store.created).toHaveLength(1)
    expect(store.documents.map((d) => d.name)).toEqual(['invoice.pdf'])
  })

  test('an unsupported file type is attached but never sent for reading', async () => {
    let calls = 0
    const counting: InvoiceOcr = {
      extract: async () => {
        calls += 1
        return GOOD_READING
      },
    }
    const msg = message({
      attachments: [
        attachment({
          id: 'sheet',
          name: 'backup.xlsx',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
      ],
    })
    await runIntake({ message: msg, ocr: counting, store })

    expect(calls).toBe(0)
    expect(store.created).toHaveLength(1)
    expect(store.created[0].invoiceNumber).toBe('EMAIL-20260729-1')
    expect(store.documents).toHaveLength(1)
    expect(store.events[0].ocrStatus).toBe('skipped')
  })
})

describe('runIntake — a body-only email', () => {
  test('still creates one invoice, blank, marked as having no attachment', async () => {
    const outcome = await runIntake({ message: message({ attachments: [] }), ocr: okOcr, store })

    expect(outcome.status).toBe('processed')
    expect(store.created).toHaveLength(1)
    expect(store.created[0].flags.noAttachment).toBe(true)
    expect(store.documents).toHaveLength(0)
  })

  test('never runs the reading over the email body', async () => {
    let calls = 0
    const counting: InvoiceOcr = {
      extract: async () => {
        calls += 1
        return GOOD_READING
      },
    }
    await runIntake({
      message: message({ attachments: [], bodyHtml: '<p>Invoice 12345 for $900</p>' }),
      ocr: counting,
      store,
    })
    expect(calls).toBe(0)
  })

  test('an email whose only attachment was a logo counts as body-only', async () => {
    const msg = message({
      bodyHtml: '<img src="cid:sig@aurora">',
      attachments: [attachment({ id: 'sig', contentType: 'image/png', contentId: 'sig@aurora', size: 2_000 })],
    })
    await runIntake({ message: msg, ocr: okOcr, store })
    expect(store.created).toHaveLength(1)
    expect(store.created[0].flags.noAttachment).toBe(true)
  })

  test('the reply says the invoice was created but no file was found', async () => {
    await runIntake({ message: message({ attachments: [] }), ocr: okOcr, store })
    expect(store.delivered).toHaveLength(1)
    expect(store.delivered[0].kind).toBe('created_no_attachment')
    expect(store.delivered[0].html.toLowerCase()).toContain('no attachment')
  })
})

describe('runIntake — when the reading goes wrong', () => {
  test('a scan that cannot be read still creates the invoice, marked as unread', async () => {
    const outcome = await runIntake({ message: message(), ocr: failingOcr, store })

    expect(outcome.status).toBe('processed')
    expect(store.created).toHaveLength(1)
    expect(store.created[0].flags.ocrFailed).toBe(true)
    expect(store.created[0].invoiceNumber).toBe('EMAIL-20260729-1')
    expect(store.documents).toHaveLength(1)
    expect(store.events[0].ocrStatus).toBe('failed')
  })

  test('a value below the confidence threshold is left blank', async () => {
    await runIntake({ message: message(), ocr: okOcr, store })
    // DueDate came back at 0.55 against a threshold of 0.8.
    expect(store.created[0].dueDate).toBeNull()
    expect(store.created[0].ocrFields).not.toContain('dueDate')
  })

  test('only the fields actually read off the scan are marked as extracted', async () => {
    await runIntake({ message: message(), ocr: okOcr, store })
    const marked = store.created[0].ocrFields.slice().sort()
    expect(marked).toEqual(['grandTotal', 'invoiceDate', 'invoiceNumber', 'subtotal', 'totalTax', 'vendorName'])
  })

  test('amounts that do not add up still create the invoice, and record the gap', async () => {
    const mismatched: InvoiceOcr = {
      extract: async () => ({
        pages: 1,
        fields: { ...GOOD_READING.fields, InvoiceTotal: { value: '9,999.00', confidence: 0.96 } },
      }),
    }
    await runIntake({ message: message(), ocr: mismatched, store })

    expect(store.created).toHaveLength(1)
    expect(store.created[0].intake.amountMismatch).toBe(true)
    expect(store.created[0].intake.amountDifference).toBeGreaterThan(0)
  })

  test('the raw reading is kept on the intake record even when a value was dropped', async () => {
    await runIntake({ message: message(), ocr: okOcr, store })
    const extraction = store.events[0].extraction as { fields: Record<string, unknown> }
    expect(extraction.fields.DueDate).toEqual({ value: '2026-06-07', confidence: 0.55 })
  })
})

describe('runIntake — vendor matching', () => {
  test('a confident single match fills the vendor in', async () => {
    await runIntake({ message: message(), ocr: okOcr, store })
    expect(store.created[0].vendorId).toBe(1)
  })

  test('two plausible candidates leave the vendor blank', async () => {
    store.vendors = [
      { id: 10, name: 'BlueRock Construction North' },
      { id: 11, name: 'BlueRock Construction South' },
    ]
    const ocrNamed: InvoiceOcr = {
      extract: async () => ({
        pages: 1,
        fields: { ...GOOD_READING.fields, VendorName: { value: 'BlueRock Construction', confidence: 0.99 } },
      }),
    }
    await runIntake({ message: message(), ocr: ocrNamed, store })

    expect(store.created[0].vendorId).toBeNull()
    expect(store.created[0].flags.vendorSetupRequired).toBe(false)
  })

  test('a vendor that is not in the master at all is marked as needing setting up', async () => {
    store.vendors = [{ id: 2, name: 'Northern Paving Ltd.' }]
    await runIntake({ message: message(), ocr: okOcr, store })

    expect(store.created[0].vendorId).toBeNull()
    expect(store.created[0].flags.vendorSetupRequired).toBe(true)
  })

  test('no department and no assignee are ever guessed', async () => {
    await runIntake({ message: message(), ocr: okOcr, store })
    expect(store.created[0]).not.toHaveProperty('departments')
    expect(store.created[0]).not.toHaveProperty('assignees')
  })
})

describe('runIntake — duplicates', () => {
  beforeEach(() => {
    store.duplicates = [
      {
        id: 99,
        invoiceNumber: 'INV-77100',
        fields: { invoiceNumber: 'INV-77100', vendorName: 'BlueRock Construction Inc.' },
      },
    ]
  })

  test('flag creates the invoice and raises the flag', async () => {
    store.config = { ...CONFIG, duplicateRule: { ...DEFAULT_DUPLICATE_RULE, action: 'flag' } }
    await runIntake({ message: message(), ocr: okOcr, store })

    expect(store.created).toHaveLength(1)
    expect(store.created[0].flags.possibleDuplicate).toBe(true)
  })

  test('block refuses to create the invoice and records why', async () => {
    store.config = { ...CONFIG, duplicateRule: { ...DEFAULT_DUPLICATE_RULE, action: 'block' } }
    const outcome = await runIntake({ message: message(), ocr: okOcr, store })

    expect(store.created).toHaveLength(0)
    expect(outcome.blocked).toHaveLength(1)
    expect(store.events[0].status).toBe('blocked_duplicate')
  })

  test('allow creates the invoice with nothing raised', async () => {
    store.config = { ...CONFIG, duplicateRule: { ...DEFAULT_DUPLICATE_RULE, action: 'allow' } }
    await runIntake({ message: message(), ocr: okOcr, store })

    expect(store.created).toHaveLength(1)
    expect(store.created[0].flags.possibleDuplicate).toBe(false)
  })
})

describe('runIntake — sender policy', () => {
  test('an outside sender is held for review and no invoice is created', async () => {
    const outcome = await runIntake({ message: message({ from: 'billing@vendor.com' }), ocr: okOcr, store })

    expect(outcome.status).toBe('quarantined')
    expect(store.created).toHaveLength(0)
    expect(store.quarantined).toHaveLength(1)
    expect(store.quarantined[0].reason).toBe('external_sender')
  })

  test('a held message gets the failure notice, and it explains itself plainly', async () => {
    await runIntake({ message: message({ from: 'billing@vendor.com' }), ocr: okOcr, store })

    expect(store.delivered).toHaveLength(1)
    expect(store.delivered[0].kind).toBe('quarantined')
    expect(store.delivered[0].html).not.toContain('external_sender')
  })

  test('a public mailbox accepts the same sender', async () => {
    store.config = { ...CONFIG, senderPolicy: { mode: 'public', internalDomains: [] } }
    const outcome = await runIntake({ message: message({ from: 'billing@vendor.com' }), ocr: okOcr, store })

    expect(outcome.status).toBe('processed')
    expect(store.created).toHaveLength(1)
  })

  test('a held message is still written down, so nothing is silently discarded', async () => {
    await runIntake({ message: message({ from: 'billing@vendor.com' }), ocr: okOcr, store })
    expect(store.events).toHaveLength(1)
    expect(store.events[0].status).toBe('quarantined')
  })
})

describe('runIntake — the confirmation reply', () => {
  test('carries the invoice number', async () => {
    await runIntake({ message: message(), ocr: okOcr, store })
    expect(store.delivered[0].kind).toBe('created')
    expect(store.delivered[0].html).toContain('INV-77100')
    expect(store.delivered[0].to).toBe('marcus.patel@aurora.ca')
  })

  test('is not sent to anyone on the suppression list', async () => {
    store.suppressed.add('marcus.patel@aurora.ca')
    await runIntake({ message: message(), ocr: okOcr, store })

    expect(store.created).toHaveLength(1)
    expect(store.delivered).toHaveLength(0)
  })

  test('one reply covers a message that produced several invoices', async () => {
    const msg = message({
      attachments: [attachment({ id: 'a', name: 'one.pdf' }), attachment({ id: 'b', name: 'two.pdf' })],
    })
    await runIntake({ message: msg, ocr: okOcr, store })
    expect(store.delivered).toHaveLength(1)
  })

  test('no reply goes out when nothing was created and nothing was held', async () => {
    store.config = { ...CONFIG, duplicateRule: { ...DEFAULT_DUPLICATE_RULE, action: 'block' } }
    store.duplicates = [
      { id: 99, invoiceNumber: 'INV-77100', fields: { invoiceNumber: 'INV-77100', vendorName: 'BlueRock Construction Inc.' } },
    ]
    await runIntake({ message: message(), ocr: okOcr, store })
    expect(store.delivered).toHaveLength(0)
  })
})

describe('runIntake — repeated deliveries and the off switch', () => {
  test('the same message arriving twice does not create a second invoice', async () => {
    await runIntake({ message: message(), ocr: okOcr, store })
    const outcome = await runIntake({ message: message(), ocr: okOcr, store })

    expect(outcome.status).toBe('skipped')
    expect(store.created).toHaveLength(1)
  })

  test('a second attachment added to an already handled message is still picked up', async () => {
    await runIntake({ message: message(), ocr: okOcr, store })
    const msg = message({
      attachments: [attachment({ id: 'att-1', name: 'invoice.pdf' }), attachment({ id: 'att-2', name: 'second.pdf' })],
    })
    await runIntake({ message: msg, ocr: okOcr, store })

    expect(store.created).toHaveLength(2)
    expect(store.documents.map((d) => d.name)).toEqual(['invoice.pdf', 'second.pdf'])
  })

  test('with intake switched off nothing is created, but the message is written down', async () => {
    store.config = { ...CONFIG, enabled: false }
    const outcome = await runIntake({ message: message(), ocr: okOcr, store })

    expect(outcome.status).toBe('disabled')
    expect(store.created).toHaveLength(0)
    expect(store.events).toHaveLength(1)
    expect(store.events[0].status).toBe('skipped')
  })
})

describe('runIntake — what lands on the invoice record', () => {
  test('sender, subject, arrival time and the original message reference are all stored', async () => {
    await runIntake({ message: message(), ocr: okOcr, store })
    expect(store.created[0].intake).toMatchObject({
      sender: 'marcus.patel@aurora.ca',
      subject: 'FW: BlueRock invoice',
      receivedAt: '2026-07-29T14:02:00.000Z',
      messageId: 'msg-1',
      internetMessageId: '<abc@aurora.ca>',
      attachmentName: 'invoice.pdf',
    })
  })

  test('the invoice is marked as having arrived by email', async () => {
    await runIntake({ message: message(), ocr: okOcr, store })
    expect(store.created[0].createdVia).toBe('email')
  })

  test('a mapped custom field lands in customFields rather than a column', async () => {
    store.config = {
      ...CONFIG,
      mapping: [...DEFAULT_FIELD_MAPPING, { appField: 'priority', sourceField: 'PaymentTerm', enabled: true }],
    }
    const withTerm: InvoiceOcr = {
      extract: async () => ({
        pages: 1,
        fields: { ...GOOD_READING.fields, PaymentTerm: { value: 'Net 30', confidence: 0.9 } },
      }),
    }
    await runIntake({ message: message(), ocr: withTerm, store })

    expect(store.created[0].customFields).toEqual({ priority: 'Net 30' })
    expect(store.created[0].ocrFields).toContain('priority')
  })
})
