import type { CollectionConfig } from 'payload'
import { DEFAULT_EMAIL_WRAPPER } from '../../lib/email-render'

/**
 * The one wrapper every outgoing email is dressed in: who it comes from, plus
 * the HTML placed above and below every template body.
 *
 * Deliberately a single-row collection rather than a Payload global — it reads
 * and writes through exactly the same local-API calls as every other settings
 * entity in this app, so there is one pattern to learn instead of two. Readers
 * take the first row and fall back to DEFAULT_EMAIL_WRAPPER, which keeps a
 * fresh database previewing a complete email instead of a bare body.
 */
export const EmailSettings: CollectionConfig = {
  slug: 'email-settings',
  labels: { singular: 'Email Setting', plural: 'Email Settings' },
  admin: {
    useAsTitle: 'fromName',
    defaultColumns: ['fromName', 'fromEmail', 'replyTo'],
    description: 'Sender identity and the header/footer wrapped around every email body.',
  },
  fields: [
    {
      name: 'fromName',
      type: 'text',
      required: true,
      defaultValue: DEFAULT_EMAIL_WRAPPER.fromName,
      admin: { description: 'Display name recipients see in their inbox.' },
    },
    {
      name: 'fromEmail',
      type: 'email',
      required: true,
      defaultValue: DEFAULT_EMAIL_WRAPPER.fromEmail,
    },
    {
      name: 'replyTo',
      type: 'email',
      defaultValue: DEFAULT_EMAIL_WRAPPER.replyTo,
      admin: { description: 'Where replies go. Leave blank to use the From address.' },
    },
    {
      name: 'headerHtml',
      type: 'textarea',
      required: true,
      defaultValue: DEFAULT_EMAIL_WRAPPER.headerHtml,
      admin: { description: 'HTML placed above every template body. May contain placeholders from the token registry.' },
    },
    {
      name: 'footerHtml',
      type: 'textarea',
      required: true,
      defaultValue: DEFAULT_EMAIL_WRAPPER.footerHtml,
      admin: { description: 'HTML placed below every template body. May contain placeholders from the token registry.' },
    },
  ],
}
