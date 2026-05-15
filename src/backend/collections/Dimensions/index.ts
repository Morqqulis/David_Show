import type { CollectionConfig } from 'payload'

export const Dimensions: CollectionConfig = {
  slug: 'dimensions',
  admin: { useAsTitle: 'label', defaultColumns: ['kind', 'code', 'description'] },
  fields: [
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: [
        { label: 'Cost Center', value: 'cost_center' },
        { label: 'Project', value: 'project' },
        { label: 'Fund', value: 'fund' },
        { label: 'Job Code', value: 'job_code' },
      ],
    },
    { name: 'code', type: 'text', required: true },
    { name: 'description', type: 'text', required: true },
    {
      name: 'label',
      type: 'text',
      admin: { hidden: true },
      hooks: {
        beforeChange: [({ siblingData }) => `${siblingData.code} — ${siblingData.description}`],
      },
    },
    { name: 'active', type: 'checkbox', defaultValue: true },
  ],
}
