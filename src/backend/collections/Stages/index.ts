import type { CollectionConfig } from 'payload'

export const Stages: CollectionConfig = {
  slug: 'stages',
  admin: { useAsTitle: 'label', defaultColumns: ['order', 'label', 'systemId', 'active'] },
  defaultSort: 'order',
  fields: [
    {
      name: 'systemId',
      type: 'select',
      required: true,
      unique: true,
      admin: { readOnly: true },
      options: [
        'to_be_assigned',
        'to_be_coded',
        'conditional_approvals',
        'ap_review',
        'ready_for_processing',
        'processed',
        'treasurer_review',
        'completed',
      ],
    },
    { name: 'label', type: 'text', required: true },
    { name: 'order', type: 'number', required: true },
    {
      name: 'tone',
      type: 'select',
      defaultValue: 'slate',
      options: ['slate', 'blue', 'violet', 'amber', 'green', 'red'],
    },
    { name: 'active', type: 'checkbox', defaultValue: true },
    { name: 'required', type: 'checkbox', defaultValue: false, admin: { readOnly: true } },
    { name: 'bulkAssign', type: 'checkbox', defaultValue: false },
    { name: 'batchAssign', type: 'checkbox', defaultValue: false },
    { name: 'verifyFlag', type: 'checkbox', defaultValue: false },
    { name: 'allowReject', type: 'checkbox', defaultValue: true },
    { name: 'allowReassign', type: 'checkbox', defaultValue: true },
    { name: 'fieldsEditableBy', type: 'relationship', relationTo: 'roles', hasMany: true },
  ],
}
