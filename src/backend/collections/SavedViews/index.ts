import type { CollectionConfig } from 'payload'

/**
 * A personal arrangement of the All Requests table: which stage it opens on,
 * which columns are visible and in what order, the column filters and the sort.
 *
 * Ownership stays simple. A view always belongs to the person who created it.
 * An administrator may additionally publish a view to one or more roles; for
 * everyone in those roles the view is visible but read-only, which is what
 * stops an ERP-shaped column layout from living in one person's account.
 */
export const SavedViews: CollectionConfig = {
  slug: 'saved-views',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'owner', 'stage', 'isDefault'],
  },
  defaultSort: 'name',
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'owner',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: { description: 'The person the view belongs to. Never changes, including for published views.' },
    },
    {
      name: 'stage',
      type: 'text',
      required: true,
      defaultValue: 'all',
      admin: { description: "Stage systemId the view applies to, or 'all'." },
    },
    {
      name: 'columns',
      type: 'json',
      admin: { description: 'Visible column ids, in display order.' },
    },
    {
      name: 'columnOrder',
      type: 'json',
      admin: { description: 'Full column order including hidden columns.' },
    },
    {
      name: 'filters',
      type: 'json',
      admin: { description: 'ColumnFilterSpec[] — AND across columns, OR within a column.' },
    },
    {
      name: 'sort',
      type: 'json',
      admin: { description: '[{ id, desc }] in priority order.' },
    },
    {
      name: 'isDefault',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Opens automatically for the owner. At most one per owner.' },
    },
    {
      name: 'publishedToRoles',
      type: 'relationship',
      relationTo: 'roles',
      hasMany: true,
      admin: { description: 'Roles that may open this view read-only. Set by an administrator.' },
    },
  ],
}
