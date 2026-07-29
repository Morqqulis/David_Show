'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from '../lib/payload'
import { sanitizeEmailHtml } from '../lib/email-html-sanitize'
import { DEFAULT_EMAIL_WRAPPER, type EmailWrapper } from '../lib/email-render'

/**
 * Server actions behind the Email screens.
 *
 * Two rules hold everywhere in this file:
 *  1. A server action is a public endpoint. Names and subjects are validated
 *     here, not only in the form.
 *  2. Markup is sanitised on the way IN as well as on the way out, so the
 *     database never holds a template we would refuse to render.
 *
 * `as never` on the `collection` argument follows the existing convention for
 * slugs Payload's generated types do not cover yet (`email-settings` is
 * registered at integration time, after which the casts on it can go).
 */

type UpsertResult = { id: string | number }

export type EmailTemplateInput = {
  name: string
  subject: string
  bodyHtml: string
  description: string
  enabled: boolean
}

function requireText(value: string, field: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${field} cannot be empty.`)
  if (trimmed.length > 200) throw new Error(`${field} is too long.`)
  return trimmed
}

export async function saveEmailTemplate(
  id: string | number | null,
  input: EmailTemplateInput,
): Promise<UpsertResult> {
  const data = {
    name: requireText(input.name, 'Template name'),
    subject: requireText(input.subject, 'Subject'),
    bodyHtml: sanitizeEmailHtml(input.bodyHtml),
    description: input.description.trim(),
    enabled: input.enabled,
  }

  try {
    const payload = await getPayload()
    if (id) {
      await payload.update({ collection: 'email-templates', id: id as never, data: data as never })
      revalidatePath('/email/templates')
      return { id }
    }
    const created = await payload.create({ collection: 'email-templates', data: data as never })
    revalidatePath('/email/templates')
    return { id: created.id }
  } catch (err) {
    console.error('[email-templates] save failed', { id, name: data.name, err })
    throw new Error('The template could not be saved.')
  }
}

export async function deleteEmailTemplateById(id: string | number): Promise<void> {
  try {
    const payload = await getPayload()
    await payload.delete({ collection: 'email-templates', id: id as never })
    revalidatePath('/email/templates')
  } catch (err) {
    console.error('[email-templates] delete failed', { id, err })
    throw new Error('The template could not be deleted.')
  }
}

/**
 * Reads the single email-settings row, falling back to the documented
 * defaults when it has not been created yet.
 */
export async function loadEmailWrapper(): Promise<EmailWrapper> {
  try {
    const payload = await getPayload()
    const res = await payload.find({
      collection: 'email-settings' as never,
      limit: 1,
      depth: 0,
    })
    const row = (res.docs as unknown as Array<Partial<EmailWrapper>>)[0]
    if (!row) return DEFAULT_EMAIL_WRAPPER
    return {
      fromName: row.fromName || DEFAULT_EMAIL_WRAPPER.fromName,
      fromEmail: row.fromEmail || DEFAULT_EMAIL_WRAPPER.fromEmail,
      replyTo: row.replyTo || DEFAULT_EMAIL_WRAPPER.replyTo,
      headerHtml: row.headerHtml ?? DEFAULT_EMAIL_WRAPPER.headerHtml,
      footerHtml: row.footerHtml ?? DEFAULT_EMAIL_WRAPPER.footerHtml,
    }
  } catch (err) {
    // A missing table on a database that has not been migrated yet is the
    // expected case here — the screen still has to render something usable.
    console.error('[email-settings] load failed, using defaults', { err })
    return DEFAULT_EMAIL_WRAPPER
  }
}

export async function saveEmailWrapper(input: EmailWrapper): Promise<UpsertResult> {
  const data = {
    fromName: requireText(input.fromName, 'Sender name'),
    fromEmail: requireEmail(input.fromEmail, 'From address'),
    replyTo: input.replyTo.trim() ? requireEmail(input.replyTo, 'Reply-to address') : '',
    headerHtml: sanitizeEmailHtml(input.headerHtml),
    footerHtml: sanitizeEmailHtml(input.footerHtml),
  }

  try {
    const payload = await getPayload()
    const existing = await payload.find({ collection: 'email-settings' as never, limit: 1, depth: 0 })
    const current = (existing.docs as unknown as Array<{ id: string | number }>)[0]
    if (current) {
      await payload.update({
        collection: 'email-settings' as never,
        id: current.id as never,
        data: data as never,
      })
      revalidateEmailScreens()
      return { id: current.id }
    }
    const created = (await payload.create({
      collection: 'email-settings',
      data: data as never,
    })) as { id: string | number }
    revalidateEmailScreens()
    return { id: created.id }
  } catch (err) {
    console.error('[email-settings] save failed', { fromEmail: data.fromEmail, err })
    throw new Error('The email settings could not be saved.')
  }
}

/** The wrapper shows up on both screens, so both have to drop their cache. */
function revalidateEmailScreens(): void {
  revalidatePath('/email/settings')
  revalidatePath('/email/templates')
}

function requireEmail(value: string, field: string): string {
  const trimmed = value.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) throw new Error(`${field} is not a valid email address.`)
  return trimmed
}
