import type { CollectionConfig } from 'payload'

/**
 * Addresses and groups that never receive the "we got your invoice" reply.
 *
 * Admin-managed rather than a per-person preference, so nobody has to go and
 * find the setting themselves. The AP team goes in here: they forward invoices
 * all day and would otherwise be buried under confirmations of their own work.
 */
export const EmailSuppression: CollectionConfig = {
  slug: 'email-suppression',
  labels: { singular: 'Suppressed Recipient', plural: 'Suppressed Recipients' },
  admin: {
    useAsTitle: 'value',
    defaultColumns: ['value', 'kind', 'note'],
    description: 'People and groups who should not get an automatic reply when they email an invoice in.',
  },
  fields: [
    {
      name: 'value',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'An email address, a whole domain, or the name of a directory group.' },
    },
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'address',
      options: [
        { label: 'One email address', value: 'address' },
        { label: 'Everyone at a domain', value: 'domain' },
        { label: 'A directory group', value: 'group' },
      ],
    },
    { name: 'note', type: 'text', admin: { description: 'Why this one is on the list.' } },
    { name: 'addedBy', type: 'relationship', relationTo: 'users' },
  ],
}
