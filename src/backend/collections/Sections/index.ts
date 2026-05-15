import type { CollectionConfig } from 'payload'

export const Sections: CollectionConfig = {
  slug: 'sections',
  admin: { useAsTitle: 'name', defaultColumns: ['order', 'name'] },
  defaultSort: 'order',
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'order', type: 'number', required: true, defaultValue: 0 },
  ],
}
