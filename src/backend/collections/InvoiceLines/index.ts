import type { CollectionConfig } from 'payload'

export const InvoiceLines: CollectionConfig = {
  slug: 'invoice-lines',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['invoice', 'glAccount', 'amount', 'taxCode'],
  },
  defaultSort: 'order',
  fields: [
    { name: 'invoice', type: 'relationship', relationTo: 'invoices', required: true, index: true },
    { name: 'order', type: 'number', defaultValue: 0 },
    { name: 'glAccount', type: 'relationship', relationTo: 'gl-accounts' },
    { name: 'costCenter', type: 'relationship', relationTo: 'dimensions' },
    { name: 'project', type: 'relationship', relationTo: 'dimensions' },
    { name: 'fund', type: 'relationship', relationTo: 'dimensions' },
    { name: 'jobCode', type: 'relationship', relationTo: 'dimensions' },
    { name: 'amount', type: 'number', defaultValue: 0 },
    { name: 'taxCode', type: 'relationship', relationTo: 'tax-codes' },
    { name: 'taxAmount', type: 'number', defaultValue: 0 },
    { name: 'recoverable', type: 'number', defaultValue: 0 },
    { name: 'nonRecoverable', type: 'number', defaultValue: 0 },
    { name: 'description', type: 'text' },
    {
      name: 'customLineFields',
      type: 'json',
      admin: { description: 'Custom coding-line field values keyed by Field.fieldKey' },
    },
  ],
}
