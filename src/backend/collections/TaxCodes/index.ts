import type { CollectionConfig } from 'payload'

export const TaxCodes: CollectionConfig = {
  slug: 'tax-codes',
  admin: { useAsTitle: 'code', defaultColumns: ['code', 'label', 'rate', 'recoverablePct'] },
  fields: [
    { name: 'code', type: 'text', required: true, unique: true },
    { name: 'label', type: 'text', required: true },
    { name: 'rate', type: 'number', required: true, admin: { description: 'Decimal, e.g. 0.13 for 13%' } },
    { name: 'recoverablePct', type: 'number', required: true, admin: { description: 'Decimal, 0-1' } },
    { name: 'recoverableGl', type: 'relationship', relationTo: 'gl-accounts' },
    { name: 'apControlGl', type: 'relationship', relationTo: 'gl-accounts' },
    { name: 'active', type: 'checkbox', defaultValue: true },
  ],
}
