import type { CollectionConfig } from 'payload'

/**
 * Settings → Coding Table. A single-row settings collection: this project has no
 * Payload globals, so the convention is one collection holding at most one
 * document, read with `limit: 1`. An absent row is a valid state and resolves to
 * `DEFAULT_CODING_RULES` in `src/backend/lib/coding-completeness.ts`, so a fresh
 * database enforces the specified defaults without needing to be seeded.
 */
export const CodingRules: CollectionConfig = {
  slug: 'coding-rules',
  admin: { useAsTitle: 'matchTarget', defaultColumns: ['matchTarget', 'onMismatch', 'tolerance'] },
  fields: [
    {
      name: 'matchTarget',
      type: 'select',
      required: true,
      defaultValue: 'subtotal',
      options: [
        { label: 'Amount Before Taxes', value: 'subtotal' },
        { label: 'Invoice Total', value: 'grandTotal' },
        { label: 'No sum matching', value: 'disabled' },
      ],
      admin: { description: 'Header amount the coding lines must add up to.' },
    },
    {
      name: 'onMismatch',
      type: 'select',
      required: true,
      defaultValue: 'block',
      options: [
        { label: 'Block the approval', value: 'block' },
        { label: 'Warn and let it through', value: 'warn' },
        { label: 'Do not check', value: 'disabled' },
      ],
      admin: { description: 'What happens when an invoice is not fully coded.' },
    },
    {
      name: 'message',
      type: 'text',
      required: true,
      defaultValue: 'Invoice needs to be fully coded.',
      admin: { description: 'Shown to the user when an approval is blocked or warned.' },
    },
    {
      name: 'tolerance',
      type: 'number',
      required: true,
      defaultValue: 0.01,
      min: 0,
      admin: { description: 'Rounding allowance in dollars, e.g. 0.01 for one cent.' },
    },
  ],
}
