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
