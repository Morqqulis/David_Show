/**
 * Deciding what an inbound email actually contains.
 *
 * One invoice record per genuine attachment. That fails in the safe direction:
 * a cover memo makes a junk record Finance cancels in seconds, whereas rolling
 * extra files up as "supporting documents" can bury a real second invoice that
 * then never gets coded or paid.
 *
 * The shapes below are the transport-neutral view of a message. The Graph
 * adapter produces them; the pipeline consumes them; the tests fake them. No
 * network type ever leaks past this file.
 */

export type IntakeAttachment = {
  id: string
  name: string
  contentType: string
  size: number
  /** The mail client marked this part as belonging to the message's own layout. */
  isInline: boolean
  /** MIME content id, if the part has one. Present on images the body references. */
  contentId: string | null
  /** Fetched lazily — a discarded logo must never cost a download. */
  content: () => Promise<Buffer>
}

export type IntakeMessage = {
  id: string
  internetMessageId: string
  from: string
  subject: string
  receivedAt: string
  bodyHtml: string
  attachments: IntakeAttachment[]
}

/** The mailbox, behind an interface, so the pipeline tests with no network. */
export interface MailboxSource {
  fetchMessage(messageId: string): Promise<IntakeMessage>
  markProcessed(messageId: string): Promise<void>
}

export type AttachmentPolicy = {
  /** MIME types sent to OCR. Everything else attaches without extraction. */
  extractableContentTypes: string[]
  /** Fallback for senders whose client reports `application/octet-stream`. */
  extractableExtensions: string[]
  /** Above this, the file still attaches but is not sent for extraction. */
  maxAttachmentBytes: number
}

export const DEFAULT_ATTACHMENT_POLICY: AttachmentPolicy = {
  extractableContentTypes: [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/tiff',
    'image/heic',
    'image/heif',
  ],
  extractableExtensions: ['pdf', 'jpg', 'jpeg', 'png', 'tif', 'tiff', 'heic', 'heif'],
  // Document Intelligence's own ceiling for a standard tier request. Larger
  // files are kept on the record so nothing is lost, just not extracted.
  maxAttachmentBytes: 50 * 1024 * 1024,
}

export type AttachmentClassification = {
  /** Genuine documents of an accepted type — each becomes an invoice with OCR. */
  forOcr: IntakeAttachment[]
  /** Genuine documents of some other type — each becomes an invoice, blank. */
  attachOnly: IntakeAttachment[]
  /** Part of the email's own presentation, or empty. Never becomes anything. */
  discarded: IntakeAttachment[]
}

/**
 * Sorts a message's attachments into the three buckets. Every attachment lands
 * in exactly one of them.
 *
 * Presentation images are identified by how the message uses them — the inline
 * flag, or a `cid:` reference from the HTML body — never by size. A size test
 * would throw away a small genuine scanned receipt, which is exactly the kind
 * of document a phone camera produces.
 */
export function classifyAttachments(
  message: IntakeMessage,
  policy: AttachmentPolicy,
): AttachmentClassification {
  const referenced = referencedContentIds(message.bodyHtml)
  const result: AttachmentClassification = { forOcr: [], attachOnly: [], discarded: [] }

  for (const attachment of message.attachments) {
    if (attachment.size <= 0) {
      result.discarded.push(attachment)
      continue
    }
    if (isPresentationPart(attachment, referenced)) {
      result.discarded.push(attachment)
      continue
    }
    if (attachment.size <= policy.maxAttachmentBytes && isExtractable(attachment, policy)) {
      result.forOcr.push(attachment)
    } else {
      result.attachOnly.push(attachment)
    }
  }

  return result
}

function isPresentationPart(attachment: IntakeAttachment, referenced: Set<string>): boolean {
  if (attachment.isInline) return true
  const contentId = normaliseContentId(attachment.contentId)
  return contentId !== null && referenced.has(contentId)
}

/** `<image001@01D2>` and `image001@01D2` are the same part. */
function normaliseContentId(raw: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim().replace(/^</, '').replace(/>$/, '').toLowerCase()
  return trimmed === '' ? null : trimmed
}

/** Every `cid:` target the HTML body points at, lower-cased for comparison. */
function referencedContentIds(bodyHtml: string): Set<string> {
  const ids = new Set<string>()
  if (!bodyHtml) return ids
  for (const match of bodyHtml.matchAll(/cid:([^"'\s>)]+)/gi)) {
    const id = normaliseContentId(match[1])
    if (id) ids.add(id)
  }
  return ids
}

function isExtractable(attachment: IntakeAttachment, policy: AttachmentPolicy): boolean {
  // `application/pdf; name="invoice.pdf"` — the parameters after the semicolon
  // are not part of the type.
  const contentType = attachment.contentType.split(';')[0].trim().toLowerCase()
  if (policy.extractableContentTypes.includes(contentType)) return true

  const dot = attachment.name.lastIndexOf('.')
  if (dot < 0) return false
  const extension = attachment.name.slice(dot + 1).toLowerCase()
  return policy.extractableExtensions.includes(extension)
}
