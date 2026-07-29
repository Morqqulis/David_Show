import type { CollectionConfig } from 'payload'

/**
 * The raw record of what arrived by email and what the reading produced.
 *
 * This is load-bearing for audit, not a debug log. The design deliberately does
 * not track field-level edits to values that came from a scan, so this row is
 * the *only* record of what the extraction originally said. Whatever a clerk
 * later corrects, `extraction` still holds the first reading, with the
 * confidence behind each value and the fields that were left blank.
 *
 * `messageKey` is the idempotency key. Microsoft Graph delivers a change
 * notification at least once and retries for up to four hours, so the same
 * message will arrive again; the unique index is what stops a retry from
 * creating a second set of invoices.
 */
export const IntakeEvents: CollectionConfig = {
  slug: 'intake-events',
  labels: { singular: 'Intake Record', plural: 'Intake Records' },
  admin: {
    useAsTitle: 'subject',
    defaultColumns: ['receivedAt', 'sender', 'subject', 'status'],
    description: 'What arrived by email, and what was read off it.',
  },
  defaultSort: '-receivedAt',
  fields: [
    {
      name: 'messageKey',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description: 'Identifies one message and one file within it, so a repeated delivery is not processed twice.',
      },
    },
    { name: 'messageId', type: 'text', required: true, index: true },
    { name: 'internetMessageId', type: 'text', index: true },
    { name: 'sender', type: 'text', index: true },
    { name: 'subject', type: 'text' },
    { name: 'receivedAt', type: 'date', required: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: [
        { label: 'Invoice created', value: 'created' },
        { label: 'Held for review', value: 'quarantined' },
        { label: 'Refused as a duplicate', value: 'blocked_duplicate' },
        { label: 'Already handled', value: 'skipped' },
        { label: 'Could not be processed', value: 'failed' },
      ],
    },
    { name: 'invoice', type: 'relationship', relationTo: 'invoices', index: true },
    { name: 'attachmentName', type: 'text' },
    {
      name: 'ocrStatus',
      type: 'select',
      options: [
        { label: 'Read successfully', value: 'extracted' },
        { label: 'Could not be read', value: 'failed' },
        { label: 'Not sent for reading', value: 'skipped' },
      ],
    },
    {
      name: 'extraction',
      type: 'json',
      admin: {
        readOnly: true,
        description: 'Exactly what the reading produced, before anyone edited it.',
      },
    },
    {
      name: 'appliedValues',
      type: 'json',
      admin: { readOnly: true, description: 'The values that were actually put on the invoice.' },
    },
    {
      name: 'confidenceThreshold',
      type: 'number',
      admin: { readOnly: true, description: 'The setting in force when this invoice was read.' },
    },
    {
      name: 'failureReason',
      type: 'text',
      admin: { description: 'Plain-language explanation of why this one did not go through.' },
    },
    {
      name: 'receipt',
      type: 'json',
      admin: {
        readOnly: true,
        description:
          'The confirmation reply composed for the sender. Empty when the sender is on the suppression list.',
      },
    },
  ],
}
