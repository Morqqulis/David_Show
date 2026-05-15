import type { CollectionConfig } from 'payload'

export const Batches: CollectionConfig = {
  slug: 'batches',
  admin: { useAsTitle: 'number', defaultColumns: ['number', 'createdAt', 'closedAt'] },
  fields: [
    { name: 'number', type: 'text', required: true },
    { name: 'createdBy', type: 'relationship', relationTo: 'users' },
    { name: 'closedAt', type: 'date' },
    { name: 'closedBy', type: 'relationship', relationTo: 'users' },
    { name: 'note', type: 'text' },
  ],
}
