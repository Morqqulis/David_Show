import type { CollectionConfig } from 'payload'

/** The three actions that ask a clerk "why?". Each keeps its own list. */
export const REASON_SCOPES = ['reassign', 'reject', 'cancel'] as const
export type ReasonScope = (typeof REASON_SCOPES)[number]

/**
 * Admin-managed reason lists, built once and shared by Reassign, Reject and
 * Cancel rather than three times over.
 *
 * A row is one of two things, told apart by `kind`:
 *   - `reason` — one option in the dropdown for its scope.
 *   - `policy` — the settings row for that scope. Exactly one per scope, and
 *     the only place `reasonRequired` means anything.
 *
 * Both shapes live here because they are the same admin concern edited on the
 * same screen; splitting them would mean two collections and two round-trips to
 * render one settings panel.
 *
 * `Other` is seeded per scope with `isOther` set. It is permanent: the delete
 * action refuses it, so a clerk always has somewhere to put a reason nobody
 * anticipated.
 */
export const ActionReasons: CollectionConfig = {
  slug: 'action-reasons',
  labels: { singular: 'Reason', plural: 'Reasons' },
  admin: {
    useAsTitle: 'label',
    defaultColumns: ['scope', 'kind', 'label', 'order', 'active'],
    description: 'Reason dropdowns shown when an invoice is reassigned, rejected or cancelled.',
  },
  defaultSort: 'order',
  fields: [
    {
      name: 'scope',
      type: 'select',
      required: true,
      index: true,
      options: REASON_SCOPES as unknown as string[],
      admin: { description: 'Which action this row belongs to.' },
    },
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'reason',
      options: [
        { label: 'Reason option', value: 'reason' },
        { label: 'Scope policy', value: 'policy' },
      ],
    },
    {
      name: 'label',
      type: 'text',
      admin: {
        condition: (_, sibling) => sibling?.kind !== 'policy',
        description: 'What the clerk reads in the dropdown. Required on a reason option.',
      },
    },
    { name: 'order', type: 'number', defaultValue: 0 },
    { name: 'active', type: 'checkbox', defaultValue: true },
    {
      name: 'isOther',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        readOnly: true,
        description: 'The built-in Other option. Reveals a free-text line and cannot be deleted.',
      },
    },
    {
      name: 'reasonRequired',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        condition: (_, sibling) => sibling?.kind === 'policy',
        description: 'Whether a reason must be given before this action can be completed.',
      },
    },
  ],
}
