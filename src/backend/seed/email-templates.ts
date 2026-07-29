import type { Payload } from 'payload'

export type EmailTemplateSeed = {
  name: string
  subject: string
  bodyHtml: string
  description: string
  enabled: boolean
}

/**
 * Exported rather than inlined so a test can assert that every `{{Token}}`
 * these bodies use actually exists in the token registry — a template shipping
 * with an unknown token would print the braces to a vendor.
 *
 * Names are load-bearing: `seedEmailTriggers` looks templates up by name.
 */
export const EMAIL_TEMPLATE_SEEDS: readonly EmailTemplateSeed[] = [
  {
    name: 'Coding Assignment',
    subject: 'Invoice {{InvoiceNumber}} ready for coding',
    bodyHtml:
      '<p>Hi {{Assignee}},</p><p>Invoice <strong>{{InvoiceNumber}}</strong> from {{Vendor}} for {{Amount}} is ready for coding.</p><p><a href="{{InvoiceURL}}">Open invoice →</a></p>',
    description: 'Goes to whoever the invoice was just assigned to.',
    enabled: true,
  },
  {
    name: 'Approval Notification',
    subject: 'Invoice {{InvoiceNumber}} approved',
    bodyHtml:
      '<p>Invoice <strong>{{InvoiceNumber}}</strong> ({{Vendor}}, {{Amount}}) has been approved by {{Approver}}.</p><p><a href="{{InvoiceURL}}">Open invoice →</a></p>',
    description: 'Confirms an approval to the team that needs to know.',
    enabled: true,
  },
  {
    name: 'Rejection Notice',
    subject: 'Invoice {{InvoiceNumber}} rejected',
    bodyHtml:
      '<p>Invoice <strong>{{InvoiceNumber}}</strong> was rejected by {{Rejecter}}.</p><p><strong>Reason:</strong> {{RejectReason}}</p><p><a href="{{InvoiceURL}}">Open invoice →</a></p>',
    description: 'Tells the submitter what needs fixing before they resubmit.',
    enabled: true,
  },
  {
    name: 'Batch Applied — Treasurer Heads-up',
    subject: 'Batch {{BatchNumber}} ready for treasurer review',
    bodyHtml:
      '<p>Batch <strong>{{BatchNumber}}</strong> has been applied and invoices are entering treasurer review.</p>',
    description: 'Warns the treasurer that a batch is on its way.',
    enabled: true,
  },
  {
    name: 'Archive Failure',
    subject: '[Action required] Archive failed for {{InvoiceNumber}}',
    bodyHtml:
      '<p>The SharePoint archive operation failed for invoice <strong>{{InvoiceNumber}}</strong> after multiple retries. Please investigate.</p>',
    description: 'Alerts administrators that a document never reached the archive.',
    enabled: true,
  },
  // The two reassignment notices. Their NAMES are load-bearing: the reassign
  // action looks a template up by name, so renaming one here silently stops
  // the notification without breaking anything that would be noticed.
  {
    name: 'Invoice Reassigned to You',
    subject: 'Invoice {{InvoiceNumber}} has been passed to you',
    bodyHtml:
      '<p>Hi {{Assignee}},</p>' +
      '<p>Invoice <strong>{{InvoiceNumber}}</strong> is now waiting on you. It is at the {{Stage}} stage and nothing about it has changed apart from who it is with.</p>' +
      '<p><strong>Reason given:</strong> {{Reason}}</p>' +
      '<p><a href="{{InvoiceURL}}">Open invoice</a></p>',
    description: 'Goes to the person an invoice has just been handed to.',
    enabled: true,
  },
  // The three receipts for an invoice that arrived by email. Their names are
  // load-bearing in the same way as the reassignment pair — the intake pipeline
  // looks each one up by name and falls back to a built-in default if it is
  // missing, so a rename degrades quietly rather than loudly.
  {
    name: 'Invoice Received',
    subject: 'We received your invoice — {{InvoiceList}}',
    bodyHtml:
      '<p>Hi {{Submitter}},</p>' +
      '<p>Thank you. Your email reached the accounts payable mailbox at {{Municipality}} and the following was created: <strong>{{InvoiceList}}</strong>.</p>' +
      '<p>It is now waiting to be assigned to someone. You do not need to do anything else.</p>' +
      '<p><a href="{{InvoiceURL}}">Open it in {{AppName}}</a></p>',
    description:
      'Replies to whoever emailed an invoice in, confirming it arrived and giving them the invoice number.',
    enabled: true,
  },
  {
    name: 'Invoice Received — No Attachment',
    subject: 'We received your email — {{InvoiceList}}',
    bodyHtml:
      '<p>Hi {{Submitter}},</p>' +
      '<p>Thank you. Your email reached the accounts payable mailbox at {{Municipality}} and <strong>{{InvoiceList}}</strong> was created.</p>' +
      '<p>There was <strong>no attachment</strong> on your message, so there is no invoice document on the record yet. Please reply to this message with the invoice file attached — there is no need to send everything again.</p>' +
      '<p><a href="{{InvoiceURL}}">Open it in {{AppName}}</a></p>',
    description: 'Same receipt, for an email that arrived with no invoice document on it.',
    enabled: true,
  },
  {
    name: 'Invoice Not Accepted',
    subject: 'Your email to accounts payable is waiting for review',
    bodyHtml:
      '<p>Hi {{Submitter}},</p>' +
      '<p>Your email reached the accounts payable mailbox at {{Municipality}}, but it was not turned into an invoice automatically. {{HeldReason}}</p>' +
      '<p>Someone in Accounts Payable will look at it. You do not need to send it again.</p>',
    description: 'Tells a sender their email was held for review rather than turned into an invoice.',
    enabled: true,
  },
  {
    name: 'Invoices Reassigned to You',
    subject: '{{InvoiceCount}} invoices have been passed to you',
    bodyHtml:
      '<p>Hi {{Assignee}},</p>' +
      '<p><strong>{{InvoiceCount}}</strong> invoices are now waiting on you. None of them have moved stage — only who they are with has changed.</p>' +
      '<p><strong>Invoices:</strong> {{InvoiceList}}</p>' +
      '<p><strong>Reason given:</strong> {{Reason}}</p>' +
      '<p><a href="{{InvoiceURL}}">Open your queue</a></p>',
    description:
      'One message covering a whole batch of reassigned invoices, rather than one email per invoice.',
    enabled: true,
  },
]

export async function seedEmailTemplates(payload: Payload) {
  return Promise.all(
    EMAIL_TEMPLATE_SEEDS.map((t) => payload.create({ collection: 'email-templates', data: { ...t } })),
  )
}
