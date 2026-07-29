import type { CollectionConfig } from 'payload'

/**
 * The client's GL account format — one row for the whole tenant.
 *
 * It answers three questions the rest of the coding-restriction feature asks:
 * what a valid GL code looks like, which part of it names the sub-department,
 * and where sub-departments nobody has mapped yet should go.
 */
export const GlFormat: CollectionConfig = {
  slug: 'gl-format',
  labels: { singular: 'GL Account Format', plural: 'GL Account Format' },
  admin: {
    useAsTitle: 'mask',
    defaultColumns: ['mask', 'departmentSegment', 'catchAllDepartment'],
    description: 'One row only. Edit it from Settings → Coding Restrictions.',
  },
  hooks: {
    beforeValidate: [
      // A second row would silently compete with the first, since every reader
      // takes the earliest one. Refuse the create instead.
      async ({ data, operation, req }) => {
        if (operation === 'create') {
          const existing = await req.payload.count({ collection: 'gl-format' as never })
          if (existing.totalDocs > 0) {
            throw new Error(
              'A GL account format already exists. Edit the existing one instead of adding another.',
            )
          }
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'mask',
      type: 'text',
      required: true,
      defaultValue: 'XX-XXX-XXXX-XXXXX',
      admin: {
        description:
          'One X for each character of the code, with the separator between the parts. Parts may be different lengths, for example XX-XXX-XXXX-XXXXX.',
      },
    },
    {
      name: 'segmentLabels',
      type: 'array',
      labels: { singular: 'Part name', plural: 'Part names' },
      admin: { description: 'What each part of the code is called, left to right.' },
      fields: [{ name: 'label', type: 'text', required: true }],
    },
    {
      name: 'departmentSegment',
      type: 'number',
      required: true,
      defaultValue: 3,
      min: 1,
      admin: {
        description:
          'Which part of the code names the sub-department, counting from the left. The first part is 1.',
      },
    },
    {
      name: 'catchAllDepartment',
      type: 'relationship',
      relationTo: 'departments',
      required: true,
      admin: {
        description:
          'Where sub-departments that no range covers are sent. New capital-project codes land here so Finance can see them and map them.',
      },
    },
  ],
}
