import type { CollectionConfig } from 'payload'

export const Fields: CollectionConfig = {
  slug: 'fields',
  admin: {
    useAsTitle: 'label',
    defaultColumns: ['fieldKey', 'label', 'scope', 'type', 'isSystem'],
  },
  defaultSort: 'order',
  fields: [
    {
      name: 'fieldKey',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: 'Stable id used in invoice.customFields and lines.customLineFields' },
    },
    { name: 'label', type: 'text', required: true },
    {
      name: 'scope',
      type: 'select',
      required: true,
      options: [
        { label: 'Header (one per invoice)', value: 'header' },
        { label: 'Coding Line (one per line)', value: 'line' },
      ],
    },
    {
      name: 'section',
      type: 'relationship',
      relationTo: 'sections',
      admin: { condition: (_, sibling) => sibling?.scope === 'header' },
    },
    { name: 'order', type: 'number', defaultValue: 0 },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Single Line Text', value: 'text' },
        { label: 'Multiple Lines of Text', value: 'textarea' },
        { label: 'Rich Text', value: 'richtext' },
        { label: 'Number', value: 'number' },
        { label: 'Currency', value: 'currency' },
        { label: 'Date', value: 'date' },
        { label: 'Choice (dropdown)', value: 'choice' },
        { label: 'Multi-select', value: 'multiselect' },
        { label: 'Yes / No', value: 'yesno' },
        { label: 'Lookup (ERP entity)', value: 'lookup' },
        { label: 'User Picker', value: 'user' },
        { label: 'Group Picker', value: 'group' },
        { label: 'File Attachment', value: 'file' },
      ],
    },
    {
      name: 'width',
      type: 'select',
      defaultValue: 'full',
      options: [
        { label: 'Full', value: 'full' },
        { label: '1/2', value: 'half' },
        { label: '1/3', value: 'third' },
        { label: '1/4', value: 'quarter' },
      ],
    },
    {
      name: 'options',
      type: 'array',
      admin: {
        condition: (_, sibling) =>
          sibling?.type === 'choice' || sibling?.type === 'multiselect',
      },
      fields: [{ name: 'value', type: 'text', required: true }],
    },
    {
      name: 'lookupEntity',
      type: 'select',
      admin: { condition: (_, sibling) => sibling?.type === 'lookup' },
      options: [
        { label: 'Vendors', value: 'vendors' },
        { label: 'GL Accounts', value: 'gl-accounts' },
        { label: 'Cost Centers', value: 'cost_center' },
        { label: 'Projects', value: 'project' },
        { label: 'Funds', value: 'fund' },
        { label: 'Job Codes', value: 'job_code' },
        { label: 'Tax Codes', value: 'tax-codes' },
      ],
    },
    {
      name: 'mandatoryAtStages',
      type: 'relationship',
      relationTo: 'stages',
      hasMany: true,
    },
    {
      name: 'showAsColumn',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'Offer this field as a column on All Requests. The CSV export follows whatever columns the user has on screen, so there is no separate export setting.',
      },
    },
    {
      // DEAD FIELD, kept only to hold its column in place. The fixed-shape ERP
      // export it used to define is gone — the CSV export now follows whatever
      // the user has on screen — so nothing reads this and no screen shows it,
      // which is what the change asked for. Dropping the column outright is a
      // destructive migration and a separate, deliberate decision; delete the
      // field and the column together when that decision is taken.
      name: 'exportable',
      type: 'checkbox',
      defaultValue: false,
      admin: { hidden: true },
    },
    { name: 'isSystem', type: 'checkbox', defaultValue: false, admin: { readOnly: true } },
    { name: 'removable', type: 'checkbox', defaultValue: true, admin: { readOnly: true } },
    { name: 'description', type: 'textarea' },
    { name: 'placeholder', type: 'text' },
  ],
}
