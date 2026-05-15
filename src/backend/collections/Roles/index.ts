import type { CollectionConfig } from 'payload'

export const Roles: CollectionConfig = {
  slug: 'roles',
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'confidential', 'bypassCodingRestrictions'] },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'description', type: 'textarea' },
    {
      name: 'permissions',
      type: 'array',
      labels: { singular: 'Permission', plural: 'Permissions' },
      fields: [
        {
          name: 'action',
          type: 'select',
          required: true,
          options: [
            'view',
            'edit',
            'assign',
            'code',
            'approve',
            'reject',
            'reassign',
            'post',
            'archive',
            'export',
            'delete',
            'configure',
            'verify',
          ],
        },
        {
          name: 'object',
          type: 'select',
          required: true,
          options: ['invoice', 'document', 'batch', 'settings', 'audit_log', 'role'],
        },
        { name: 'scope', type: 'select', required: true, options: ['own', 'department', 'all'] },
        { name: 'stages', type: 'relationship', relationTo: 'stages', hasMany: true },
      ],
    },
    { name: 'confidential', type: 'checkbox', defaultValue: false },
    { name: 'bypassCodingRestrictions', type: 'checkbox', defaultValue: false },
    { name: 'isSystem', type: 'checkbox', defaultValue: false, admin: { readOnly: true } },
  ],
}
