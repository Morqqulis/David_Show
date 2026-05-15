import type { CollectionConfig } from 'payload'

export const CodingRestrictions: CollectionConfig = {
  slug: 'coding-restrictions',
  admin: {
    useAsTitle: 'departmentLabel',
    defaultColumns: ['department', 'rulesCount'],
  },
  fields: [
    { name: 'department', type: 'relationship', relationTo: 'departments', required: true },
    {
      name: 'rules',
      type: 'array',
      fields: [
        { name: 'segmentIndex', type: 'number', required: true, admin: { description: '1-based segment number in the GL code' } },
        {
          name: 'operator',
          type: 'select',
          required: true,
          options: [
            { label: 'Equals', value: 'equals' },
            { label: 'Starts With', value: 'starts_with' },
            { label: 'In List', value: 'in' },
          ],
        },
        { name: 'value', type: 'text', admin: { condition: (_, s) => s?.operator !== 'in' } },
        {
          name: 'listValues',
          type: 'array',
          admin: { condition: (_, s) => s?.operator === 'in' },
          fields: [{ name: 'value', type: 'text', required: true }],
        },
      ],
    },
    {
      name: 'departmentLabel',
      type: 'text',
      admin: { hidden: true },
    },
  ],
}
