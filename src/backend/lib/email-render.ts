import { sanitizeEmailHtml } from './email-html-sanitize'
import { resolveTokens, resolveTokensPlain } from './email-tokens'

/**
 * Composition of a finished email: the global header, the template body, the
 * global footer, with tokens resolved and every part sanitised.
 *
 * `renderEmail` is the seam. The preview calls it with sample values; when a
 * sending pipeline is eventually built it calls the same function with real
 * invoice values and hands the result to a transport. Nothing else in the app
 * should ever concatenate an email by hand.
 */

/** The one wrapper every outgoing message is dressed in, plus who it comes from. */
export type EmailWrapper = {
  fromName: string
  fromEmail: string
  replyTo: string
  headerHtml: string
  footerHtml: string
}

/**
 * Used when the `email-settings` row has not been created yet, so a fresh
 * database still previews a complete, sensible email instead of a bare body.
 */
export const DEFAULT_EMAIL_WRAPPER: EmailWrapper = {
  fromName: 'City of Aurora — Accounts Payable',
  fromEmail: 'ap@aurora.ca',
  replyTo: 'ap@aurora.ca',
  headerHtml: '<div><p><strong>{{Municipality}}</strong> · Accounts Payable</p><hr></div>',
  footerHtml:
    '<div><hr><p>Sent automatically by {{AppName}} on behalf of {{Municipality}}. This mailbox is not monitored, so please do not reply to this message.</p></div>',
}

/**
 * Sanitises each part and joins them in reading order. Every string that
 * reaches `dangerouslySetInnerHTML` in this app comes out of here.
 */
export function composeEmailHtml(input: { header: string; body: string; footer: string }): string {
  return [input.header, input.body, input.footer].map(sanitizeEmailHtml).join('')
}

export type RenderedEmail = {
  /** Plain-text subject with tokens filled in. */
  subject: string
  /** `Name <address>` exactly as a recipient's inbox shows it. */
  fromLine: string
  /** Sanitised header + body + footer, safe to inject as HTML. */
  html: string
}

export function renderEmail(input: {
  subject: string
  bodyHtml: string
  wrapper: EmailWrapper
  values: Record<string, string>
}): RenderedEmail {
  const { subject, bodyHtml, wrapper, values } = input
  return {
    subject: resolveTokensPlain(subject, values),
    fromLine: `${wrapper.fromName} <${wrapper.fromEmail}>`,
    html: composeEmailHtml({
      header: resolveTokens(wrapper.headerHtml, values),
      body: resolveTokens(bodyHtml, values),
      footer: resolveTokens(wrapper.footerHtml, values),
    }),
  }
}
