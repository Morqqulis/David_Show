import type { CollectionConfig } from 'payload'

export const EMAIL_EVENTS = [
  'submission',
  'approval',
  'rejection',
  'reassignment',
  'conditional_routing',
  'treasurer_routing',
  'batch_applied',
  'archive_failed',
] as const

export const EmailTriggers: CollectionConfig = {
  slug: 'email-triggers',
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'event', 'stage', 'template', 'enabled'] },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'event', type: 'select', required: true, options: EMAIL_EVENTS as unknown as string[] },
    { name: 'stage', type: 'relationship', relationTo: 'stages' },
    { name: 'template', type: 'relationship', relationTo: 'email-templates', required: true },
    {
      name: 'recipients',
      type: 'array',
      fields: [
        {
          name: 'type',
          type: 'select',
          required: true,
          options: [
            { label: 'Dynamic role', value: 'dynamic' },
            { label: 'Group (role)', value: 'role' },
            { label: 'Specific person', value: 'user' },
            { label: 'Literal email', value: 'email' },
          ],
        },
        {
          name: 'dynamicKey',
          type: 'select',
          admin: { condition: (_, s) => s?.type === 'dynamic' },
          options: ['assignee', 'approver', 'rejecter', 'submitter', 'ap_supervisor'],
        },
        {
          name: 'role',
          type: 'relationship',
          relationTo: 'roles',
          admin: { condition: (_, s) => s?.type === 'role' },
        },
        {
          name: 'user',
          type: 'relationship',
          relationTo: 'users',
          admin: { condition: (_, s) => s?.type === 'user' },
        },
        {
          name: 'email',
          type: 'text',
          admin: { condition: (_, s) => s?.type === 'email' },
        },
      ],
    },
    {
      name: 'cc',
      type: 'array',
      fields: [
        {
          name: 'type',
          type: 'select',
          required: true,
          options: ['dynamic', 'role', 'user', 'email'],
        },
        { name: 'dynamicKey', type: 'text' },
        { name: 'role', type: 'relationship', relationTo: 'roles' },
        { name: 'user', type: 'relationship', relationTo: 'users' },
        { name: 'email', type: 'text' },
      ],
    },
    { name: 'enabled', type: 'checkbox', defaultValue: true },
  ],
}
