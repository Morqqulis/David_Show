import type { CollectionConfig } from 'payload'

/**
 * RETIRED — superseded by `gl-format` + `department-segment-map`.
 *
 * This was the per-department rule builder ("Segment N equals / starts with /
 * is in list", OR'd together, one document per department). It has been
 * replaced by a single sub-department range table, which covers the same cases
 * with about 24 rows instead of one screen per department. Nothing reads or
 * writes this collection any more: the Coding Restrictions settings screen, the
 * seed script and the coding engine all moved across.
 *
 * It is left registered, with its fields untouched, only so that removing it is
 * a deliberate step with a schema migration attached rather than a silent table
 * drop. To finish the removal:
 *   1. delete this folder,
 *   2. remove the `CodingRestrictions` import and array entry from
 *      `src/backend/collections/index.ts`,
 *   3. remove `'coding-restrictions'` from `COLLECTIONS_TO_CLEAR` in
 *      `src/backend/seed/clear.ts`,
 *   4. re-run `payload generate:types` and push the schema.
 *
 * Hidden from the admin UI in the meantime so nobody authors rules that will
 * never be enforced.
 */
export const CodingRestrictions: CollectionConfig = {
  slug: 'coding-restrictions',
  admin: {
    useAsTitle: 'departmentLabel',
    defaultColumns: ['department', 'rulesCount'],
    hidden: true,
    description: 'Retired. Coding restrictions are configured under Settings → Coding Restrictions.',
  },
  fields: [
    { name: 'department', type: 'relationship', relationTo: 'departments', required: true },
    {
      name: 'rules',
      type: 'array',
      fields: [
        { name: 'segmentIndex', type: 'number', required: true, admin: { description: '1-based segment number in the GL code' } },
        {
          name: 'operator',
          type: 'select',
          required: true,
          options: [
            { label: 'Equals', value: 'equals' },
            { label: 'Starts With', value: 'starts_with' },
            { label: 'In List', value: 'in' },
          ],
        },
        { name: 'value', type: 'text', admin: { condition: (_, s) => s?.operator !== 'in' } },
        {
          name: 'listValues',
          type: 'array',
          admin: { condition: (_, s) => s?.operator === 'in' },
          fields: [{ name: 'value', type: 'text', required: true }],
        },
      ],
    },
    {
      name: 'departmentLabel',
      type: 'text',
      admin: { hidden: true },
    },
  ],
}
