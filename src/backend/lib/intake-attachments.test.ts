import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_ATTACHMENT_POLICY,
  classifyAttachments,
  type IntakeAttachment,
  type IntakeMessage,
} from './intake-attachments'

function attachment(patch: Partial<IntakeAttachment>): IntakeAttachment {
  return {
    id: patch.id ?? 'att-1',
    name: patch.name ?? 'invoice.pdf',
    contentType: patch.contentType ?? 'application/pdf',
    size: patch.size ?? 82_000,
    isInline: patch.isInline ?? false,
    contentId: patch.contentId ?? null,
    content: patch.content ?? (async () => Buffer.from('')),
  }
}

function message(attachments: IntakeAttachment[], bodyHtml = '<p>Please process.</p>'): IntakeMessage {
  return {
    id: 'msg-1',
    internetMessageId: '<abc@aurora.ca>',
    from: 'marcus@aurora.ca',
    subject: 'FW: invoice',
    receivedAt: '2026-07-29T14:02:00Z',
    bodyHtml,
    attachments,
  }
}

describe('classifyAttachments — presentation images', () => {
  test('an inline logo is discarded', () => {
    const logo = attachment({
      id: 'logo',
      name: 'logo.png',
      contentType: 'image/png',
      size: 4_000,
      isInline: true,
      contentId: 'logo001@01D26CD8',
    })
    const result = classifyAttachments(message([logo]), DEFAULT_ATTACHMENT_POLICY)
    expect(result.discarded.map((a) => a.id)).toEqual(['logo'])
    expect(result.forOcr).toHaveLength(0)
  })

  test('an image the body references by cid is discarded even when isInline is false', () => {
    // Some clients omit the isInline flag but still reference the part from the
    // HTML body. The body reference is the real signal.
    const signature = attachment({
      id: 'sig',
      name: 'sig.png',
      contentType: 'image/png',
      size: 4_000,
      isInline: false,
      contentId: 'image001.jpg@01D26CD8.6C05F070',
    })
    const body = '<p>Regards</p><img src="cid:image001.jpg@01D26CD8.6C05F070">'
    const result = classifyAttachments(message([signature], body), DEFAULT_ATTACHMENT_POLICY)
    expect(result.discarded.map((a) => a.id)).toEqual(['sig'])
  })

  test('angle brackets around the content id do not defeat the body match', () => {
    const inlineImage = attachment({
      id: 'sig',
      contentType: 'image/png',
      contentId: '<image001@01D26CD8>',
      size: 3_000,
    })
    const body = '<img src="cid:image001@01D26CD8">'
    expect(classifyAttachments(message([inlineImage], body), DEFAULT_ATTACHMENT_POLICY).discarded).toHaveLength(1)
  })

  test('a small genuine scanned receipt of the same size is kept', () => {
    // The size test that would have caught the logo would also eat this.
    const receipt = attachment({
      id: 'receipt',
      name: 'receipt.jpg',
      contentType: 'image/jpeg',
      size: 4_000,
      isInline: false,
      contentId: null,
    })
    const result = classifyAttachments(message([receipt]), DEFAULT_ATTACHMENT_POLICY)
    expect(result.forOcr.map((a) => a.id)).toEqual(['receipt'])
    expect(result.discarded).toHaveLength(0)
  })

  test('an attachment with a content id the body never references is kept', () => {
    const orphan = attachment({ id: 'orphan', contentType: 'image/png', contentId: 'unused@host', size: 5_000 })
    const result = classifyAttachments(message([orphan], '<p>no images here</p>'), DEFAULT_ATTACHMENT_POLICY)
    expect(result.forOcr.map((a) => a.id)).toEqual(['orphan'])
  })
})

describe('classifyAttachments — extraction eligibility', () => {
  test('every accepted type reaches OCR', () => {
    const accepted = [
      attachment({ id: 'pdf', name: 'a.pdf', contentType: 'application/pdf' }),
      attachment({ id: 'jpg', name: 'b.jpg', contentType: 'image/jpeg' }),
      attachment({ id: 'png', name: 'c.png', contentType: 'image/png' }),
      attachment({ id: 'tiff', name: 'd.tiff', contentType: 'image/tiff' }),
      attachment({ id: 'heic', name: 'e.heic', contentType: 'image/heic' }),
    ]
    const result = classifyAttachments(message(accepted), DEFAULT_ATTACHMENT_POLICY)
    expect(result.forOcr.map((a) => a.id)).toEqual(['pdf', 'jpg', 'png', 'tiff', 'heic'])
    expect(result.attachOnly).toHaveLength(0)
  })

  test('a generic content type falls back to the file extension', () => {
    // Phones frequently send HEIC as application/octet-stream.
    const photo = attachment({ id: 'photo', name: 'IMG_0042.HEIC', contentType: 'application/octet-stream' })
    expect(classifyAttachments(message([photo]), DEFAULT_ATTACHMENT_POLICY).forOcr.map((a) => a.id)).toEqual([
      'photo',
    ])
  })

  test('a content type with a charset parameter still matches', () => {
    const pdf = attachment({ id: 'pdf', contentType: 'application/pdf; name="invoice.pdf"' })
    expect(classifyAttachments(message([pdf]), DEFAULT_ATTACHMENT_POLICY).forOcr).toHaveLength(1)
  })

  test('an unsupported type attaches to the record but never reaches OCR', () => {
    const spreadsheet = attachment({
      id: 'xlsx',
      name: 'backup.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const result = classifyAttachments(message([spreadsheet]), DEFAULT_ATTACHMENT_POLICY)
    expect(result.attachOnly.map((a) => a.id)).toEqual(['xlsx'])
    expect(result.forOcr).toHaveLength(0)
    expect(result.discarded).toHaveLength(0)
  })

  test('a zero-byte attachment is discarded rather than turned into an empty invoice', () => {
    const empty = attachment({ id: 'empty', size: 0 })
    expect(classifyAttachments(message([empty]), DEFAULT_ATTACHMENT_POLICY).discarded.map((a) => a.id)).toEqual([
      'empty',
    ])
  })

  test('a body-only message produces no attachments in any bucket', () => {
    const result = classifyAttachments(message([]), DEFAULT_ATTACHMENT_POLICY)
    expect(result.forOcr).toHaveLength(0)
    expect(result.attachOnly).toHaveLength(0)
    expect(result.discarded).toHaveLength(0)
  })

  test('every attachment lands in exactly one bucket', () => {
    const all = [
      attachment({ id: 'pdf' }),
      attachment({ id: 'xlsx', name: 'x.xlsx', contentType: 'application/octet-stream' }),
      attachment({ id: 'logo', contentType: 'image/png', isInline: true }),
      attachment({ id: 'empty', size: 0 }),
    ]
    const result = classifyAttachments(message(all), DEFAULT_ATTACHMENT_POLICY)
    const seen = [...result.forOcr, ...result.attachOnly, ...result.discarded].map((a) => a.id)
    expect(seen.slice().sort()).toEqual(['empty', 'logo', 'pdf', 'xlsx'])
  })
})

describe('classifyAttachments — configured policy', () => {
  test('a narrowed policy moves a type out of OCR without discarding it', () => {
    const png = attachment({ id: 'png', name: 'c.png', contentType: 'image/png' })
    const result = classifyAttachments(message([png]), {
      extractableContentTypes: ['application/pdf'],
      extractableExtensions: ['pdf'],
      maxAttachmentBytes: DEFAULT_ATTACHMENT_POLICY.maxAttachmentBytes,
    })
    expect(result.attachOnly.map((a) => a.id)).toEqual(['png'])
  })

  test('an attachment over the size cap is kept on the record but not sent to OCR', () => {
    const huge = attachment({ id: 'huge', size: DEFAULT_ATTACHMENT_POLICY.maxAttachmentBytes + 1 })
    const result = classifyAttachments(message([huge]), DEFAULT_ATTACHMENT_POLICY)
    expect(result.attachOnly.map((a) => a.id)).toEqual(['huge'])
  })
})
