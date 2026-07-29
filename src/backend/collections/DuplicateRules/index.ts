import type { CollectionConfig } from 'payload'
import { DEFAULT_DUPLICATE_RULE, DUPLICATE_KEY_FIELDS } from '../../lib/duplicate-detection'

/**
 * How the app decides two invoices are the same one, and what it does about it.
 *
 * Single row, read with `limit: 1`, falling back to DEFAULT_DUPLICATE_RULE.
 *
 * The three assumptions carried into the build — compare against every
 * non-cancelled invoice with no time limit, ignore case and spacing, apply to
 * typed-in invoices as well as emailed ones — are stored fields rather than
 * hidden constants, so an admin can see them and a client can correct them.
 */
export const DuplicateRules: CollectionConfig = {
  slug: 'duplicate-rules',
  labels: { singular: 'Duplicate Rule', plural: 'Duplicate Rules' },
  admin: {
    useAsTitle: 'action',
    defaultColumns: ['action', 'appliesToManualEntry'],
    description: 'What counts as the same invoice arriving twice, and what happens then.',
  },
  fields: [
    {
      name: 'keyFields',
      type: 'array',
      required: true,
      admin: { description: 'Fields that together identify an invoice. Default is vendor plus invoice number.' },
      fields: [
        {
          name: 'field',
          type: 'select',
          required: true,
          options: DUPLICATE_KEY_FIELDS.map((f) => ({ label: f.label, value: f.key })),
        },
      ],
    },
    {
      name: 'action',
      type: 'select',
      required: true,
      defaultValue: DEFAULT_DUPLICATE_RULE.action,
      options: [
        { label: 'Flag it in the queue and carry on', value: 'flag' },
        { label: 'Refuse to create the invoice', value: 'block' },
        { label: 'Create it and say nothing', value: 'allow' },
      ],
    },
    {
      name: 'ignoreCancelled',
      type: 'checkbox',
      defaultValue: DEFAULT_DUPLICATE_RULE.ignoreCancelled,
      admin: { description: 'Do not compare against invoices that were cancelled.' },
    },
    {
      name: 'caseInsensitive',
      type: 'checkbox',
      defaultValue: DEFAULT_DUPLICATE_RULE.caseInsensitive,
      admin: { description: 'Treat differences in capitals and spacing as the same text.' },
    },
    {
      name: 'appliesToManualEntry',
      type: 'checkbox',
      defaultValue: DEFAULT_DUPLICATE_RULE.appliesToManualEntry,
      admin: { description: 'Also check invoices somebody types in, not only emailed ones.' },
    },
    {
      name: 'windowDays',
      type: 'number',
      min: 1,
      admin: { description: 'Only compare against invoices from the last N days. Leave blank to compare against all of them.' },
    },
  ],
}
