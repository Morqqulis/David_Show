import type { CollectionConfig } from 'payload'

export const GLAccounts: CollectionConfig = {
  slug: 'gl-accounts',
  admin: { useAsTitle: 'code', defaultColumns: ['code', 'description', 'active'] },
  fields: [
    { name: 'code', type: 'text', required: true, unique: true },
    { name: 'description', type: 'text', required: true },
    {
      name: 'segments',
      type: 'array',
      admin: { description: 'Split of the code by configured delimiter. Auto-populated.' },
      fields: [{ name: 'value', type: 'text' }],
    },
    { name: 'active', type: 'checkbox', defaultValue: true },
  ],
}
