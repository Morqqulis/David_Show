import type { CollectionConfig } from 'payload'

/**
 * Which department owns which sub-department numbers.
 *
 * One flat table rather than a rule set per department: a department may hold
 * several rows that are nowhere near each other (Fire is 0400–0414, plus 0450,
 * plus 4001–4099), and a single-value row beats any range it sits inside
 * (sub-department 1645 is inside Facilities' 1600–1649 but belongs to
 * Clerking). Ranges keep the table small — the reference client's 544
 * sub-departments need about 24 rows.
 */
export const DepartmentSegmentMap: CollectionConfig = {
  slug: 'department-segment-map',
  labels: { singular: 'Sub-department Range', plural: 'Sub-department Ranges' },
  admin: {
    useAsTitle: 'fromValue',
    defaultColumns: ['fromValue', 'toValue', 'department', 'note'],
    description: 'Maintained from Settings → Coding Restrictions.',
  },
  defaultSort: 'fromValue',
  fields: [
    {
      name: 'department',
      type: 'relationship',
      relationTo: 'departments',
      required: true,
      admin: { description: 'Who codes and approves invoices against these sub-departments.' },
    },
    {
      name: 'fromValue',
      type: 'text',
      required: true,
      admin: { description: 'First sub-department number in the range, written exactly as it appears in the GL code (for example 0400).' },
    },
    {
      name: 'toValue',
      type: 'text',
      admin: {
        description:
          'Last sub-department number in the range. Leave blank when the row covers a single sub-department — a single value always beats a range that contains it.',
      },
    },
    {
      name: 'note',
      type: 'text',
      admin: { description: 'Optional reminder of what this covers, for example "Swim Program".' },
    },
  ],
}
