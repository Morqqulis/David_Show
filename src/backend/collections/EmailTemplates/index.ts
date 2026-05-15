import type { CollectionConfig } from 'payload'

export const EmailTemplates: CollectionConfig = {
  slug: 'email-templates',
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'subject', 'enabled'] },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'subject', type: 'text', required: true },
    { name: 'bodyHtml', type: 'textarea', required: true },
    { name: 'enabled', type: 'checkbox', defaultValue: true },
    { name: 'description', type: 'textarea' },
  ],
}
