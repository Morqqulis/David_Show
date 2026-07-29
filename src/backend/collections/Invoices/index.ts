import type { CollectionConfig } from 'payload'

export const Invoices: CollectionConfig = {
  slug: 'invoices',
  admin: {
    useAsTitle: 'invoiceNumber',
    defaultColumns: ['invoiceNumber', 'vendor', 'grandTotal', 'currentStage', 'invoiceDate'],
  },
  fields: [
    { name: 'invoiceNumber', type: 'text', required: true },
    { name: 'vendor', type: 'relationship', relationTo: 'vendors' },
    { name: 'invoiceDate', type: 'date' },
    { name: 'dueDate', type: 'date' },
    { name: 'fiscalYear', type: 'text' },
    { name: 'poNumber', type: 'text' },
    { name: 'subtotal', type: 'number', defaultValue: 0 },
    { name: 'totalTax', type: 'number', defaultValue: 0 },
    { name: 'grandTotal', type: 'number', defaultValue: 0 },

    {
      name: 'currentStage',
      type: 'relationship',
      relationTo: 'stages',
      required: true,
      index: true,
    },
    {
      name: 'departments',
      type: 'relationship',
      relationTo: 'departments',
      hasMany: true,
    },
    { name: 'assignees', type: 'relationship', relationTo: 'users', hasMany: true },
    {
      name: 'approvals',
      type: 'array',
      admin: { description: 'Per-recipient approval status at current stage' },
      fields: [
        { name: 'user', type: 'relationship', relationTo: 'users', required: true },
        { name: 'stage', type: 'relationship', relationTo: 'stages', required: true },
        { name: 'status', type: 'select', options: ['pending', 'approved', 'rejected'], defaultValue: 'pending' },
        { name: 'at', type: 'date' },
        { name: 'comment', type: 'text' },
      ],
    },
    { name: 'batch', type: 'relationship', relationTo: 'batches' },
    { name: 'verified', type: 'checkbox', defaultValue: false },
    { name: 'verifiedAt', type: 'date' },
    { name: 'verifiedBy', type: 'relationship', relationTo: 'users' },

    { name: 'confidential', type: 'checkbox', defaultValue: false },

    {
      name: 'flags',
      type: 'group',
      fields: [
        { name: 'noAttachment', type: 'checkbox', defaultValue: false },
        { name: 'ocrFailed', type: 'checkbox', defaultValue: false },
        { name: 'vendorSetupRequired', type: 'checkbox', defaultValue: false },
        { name: 'possibleDuplicate', type: 'checkbox', defaultValue: false },
        // Amount Before Taxes plus Total Tax does not equal the Invoice Total.
        // Lives here rather than with the other intake provenance so Finance
        // can pull every affected invoice out of All Requests with the flag
        // filter — a warning only visible once the invoice is already open is
        // a warning nobody goes looking for.
        { name: 'amountMismatch', type: 'checkbox', defaultValue: false },
        { name: 'archiveFailed', type: 'checkbox', defaultValue: false },
        { name: 'archiveAttempts', type: 'number', defaultValue: 0 },
      ],
    },

    {
      name: 'createdVia',
      type: 'select',
      defaultValue: 'manual',
      options: ['email', 'manual'],
    },
    {
      name: 'ocrConfidence',
      type: 'number',
      admin: { description: '0-1 vendor confidence score from OCR' },
    },

    {
      name: 'intake',
      type: 'group',
      admin: {
        description:
          'Where an emailed invoice came from. Empty on invoices somebody typed in.',
      },
      fields: [
        { name: 'sender', type: 'text', index: true },
        { name: 'subject', type: 'text' },
        { name: 'receivedAt', type: 'date' },
        {
          name: 'messageId',
          type: 'text',
          admin: { description: 'Mailbox reference for the original email, so it can be opened again.' },
        },
        {
          name: 'internetMessageId',
          type: 'text',
          index: true,
          admin: { description: 'The message id the sending mail system stamped on the email.' },
        },
        { name: 'attachmentName', type: 'text' },
      ],
    },
    {
      name: 'ocrFields',
      type: 'json',
      admin: {
        description:
          'Keys of the header fields whose values were read off the scan rather than typed by a person. Drives the "read from the invoice" marker in the header tab.',
      },
    },

    {
      name: 'customFields',
      type: 'json',
      admin: {
        description:
          'Header custom field values keyed by Field.fieldKey. Driven by Settings → Fields.',
      },
    },

    {
      name: 'documents',
      type: 'relationship',
      relationTo: 'documents',
      hasMany: true,
    },

    { name: 'softDeleted', type: 'checkbox', defaultValue: false },
    { name: 'deletedReason', type: 'text' },
    { name: 'archivedAt', type: 'date' },
  ],
}
