import type { CollectionConfig } from 'payload'

export const InvoiceComments: CollectionConfig = {
  slug: 'invoice-comments',
  admin: { useAsTitle: 'preview', defaultColumns: ['invoice', 'author', 'createdAt'] },
  fields: [
    { name: 'invoice', type: 'relationship', relationTo: 'invoices', required: true, index: true },
    { name: 'author', type: 'relationship', relationTo: 'users', required: true },
    { name: 'body', type: 'textarea', required: true },
    { name: 'mentions', type: 'relationship', relationTo: 'users', hasMany: true },
    {
      name: 'preview',
      type: 'text',
      admin: { hidden: true },
      hooks: {
        beforeChange: [({ siblingData }) => (siblingData.body || '').slice(0, 80)],
      },
    },
  ],
}
