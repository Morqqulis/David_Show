import type { CollectionConfig } from 'payload'

export const Departments: CollectionConfig = {
  slug: 'departments',
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'code', 'reviewer'] },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'code', type: 'text', required: true },
    { name: 'head', type: 'relationship', relationTo: 'users' },
    {
      name: 'reviewer',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description:
          "Who approves invoices coded to this department's GL accounts. Leave blank to use the department head.",
      },
    },
  ],
}
