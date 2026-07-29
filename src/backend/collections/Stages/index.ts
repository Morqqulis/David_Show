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
      // DEAD FIELD. Status pills are now a single-hue ramp derived from the
      // brand colour by stage position (see components/app/stage-badge.tsx),
      // so a stored per-stage hue governs nothing. Kept only because removing
      // it drops a Postgres column, which is a destructive migration nobody
      // asked for; hidden so it cannot look like a working setting. Delete the
      // field and the column together at the next intentional migration.
      name: 'tone',
      type: 'select',
      defaultValue: 'slate',
      options: ['slate', 'blue', 'violet', 'amber', 'green', 'red'],
      admin: { hidden: true },
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
