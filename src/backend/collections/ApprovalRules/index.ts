import type { CollectionConfig } from 'payload'

export const ApprovalRules: CollectionConfig = {
  slug: 'approval-rules',
  admin: { useAsTitle: 'name', defaultColumns: ['order', 'name', 'enabled'] },
  defaultSort: 'order',
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'order', type: 'number', defaultValue: 0 },
    { name: 'enabled', type: 'checkbox', defaultValue: true },
    {
      name: 'conditions',
      type: 'json',
      admin: {
        description:
          'ConditionGroup { operator: "and"|"or", conditions: [{ fieldKey, operator, value }] }',
      },
    },
    {
      name: 'approvers',
      type: 'array',
      fields: [
        {
          name: 'type',
          type: 'select',
          required: true,
          options: [
            { label: 'Specific User', value: 'user' },
            { label: 'Role', value: 'role' },
            { label: 'Department Head', value: 'department_head' },
          ],
        },
        { name: 'user', type: 'relationship', relationTo: 'users' },
        { name: 'role', type: 'relationship', relationTo: 'roles' },
        { name: 'department', type: 'relationship', relationTo: 'departments' },
      ],
    },
    {
      name: 'mode',
      type: 'select',
      defaultValue: 'parallel',
      options: [
        { label: 'Parallel (all notified, any order)', value: 'parallel' },
        { label: 'Sequential', value: 'sequential' },
      ],
    },
  ],
}
