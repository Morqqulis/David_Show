import type { Payload } from 'payload'

export async function seedEmailTemplates(payload: Payload) {
  const data = [
    {
      name: 'Coding Assignment',
      subject: 'Invoice {{InvoiceNumber}} ready for coding',
      bodyHtml:
        '<p>Hi {{Assignee}},</p><p>Invoice <strong>{{InvoiceNumber}}</strong> from {{Vendor}} for {{Amount}} is ready for coding.</p><p><a href="{{InvoiceURL}}">Open invoice →</a></p>',
      enabled: true,
    },
    {
      name: 'Approval Notification',
      subject: 'Invoice {{InvoiceNumber}} approved',
      bodyHtml:
        '<p>Invoice <strong>{{InvoiceNumber}}</strong> ({{Vendor}}, {{Amount}}) has been approved by {{Approver}}.</p><p><a href="{{InvoiceURL}}">Open invoice →</a></p>',
      enabled: true,
    },
    {
      name: 'Rejection Notice',
      subject: 'Invoice {{InvoiceNumber}} rejected',
      bodyHtml:
        '<p>Invoice <strong>{{InvoiceNumber}}</strong> was rejected by {{Rejecter}}.</p><p><strong>Reason:</strong> {{RejectReason}}</p><p><a href="{{InvoiceURL}}">Open invoice →</a></p>',
      enabled: true,
    },
    {
      name: 'Batch Applied — Treasurer Heads-up',
      subject: 'Batch {{BatchNumber}} ready for treasurer review',
      bodyHtml:
        '<p>Batch <strong>{{BatchNumber}}</strong> has been applied and invoices are entering treasurer review.</p>',
      enabled: true,
    },
    {
      name: 'Archive Failure',
      subject: '[Action required] Archive failed for {{InvoiceNumber}}',
      bodyHtml:
        '<p>The SharePoint archive operation failed for invoice <strong>{{InvoiceNumber}}</strong> after multiple retries. Please investigate.</p>',
      enabled: true,
    },
  ]
  return Promise.all(data.map((t) => payload.create({ collection: 'email-templates', data: t })))
}
