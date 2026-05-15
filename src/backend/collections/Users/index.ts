import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'email', 'role', 'department'] },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'email', type: 'email' },
    { name: 'role', type: 'relationship', relationTo: 'roles' },
    { name: 'department', type: 'relationship', relationTo: 'departments' },
    { name: 'avatar', type: 'text' },
    { name: 'active', type: 'checkbox', defaultValue: true },
  ],
}
