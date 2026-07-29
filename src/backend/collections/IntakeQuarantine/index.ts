import type { CollectionConfig } from 'payload'

/**
 * Messages the sender policy turned away, kept for an admin to look at.
 *
 * Nothing that arrives in the mailbox is ever silently discarded. An admin can
 * release a held message, which runs it through the normal intake path exactly
 * as if it had been accepted in the first place.
 *
 * The message body is deliberately not stored — only who sent it, what it was
 * called, when it arrived and how many files it carried. Holding the contents
 * of mail the municipality decided not to accept would be a retention problem
 * with no benefit.
 */
export const IntakeQuarantine: CollectionConfig = {
  slug: 'intake-quarantine',
  labels: { singular: 'Held Message', plural: 'Held Messages' },
  admin: {
    useAsTitle: 'subject',
    defaultColumns: ['receivedAt', 'sender', 'subject', 'released'],
    description: 'Emails the mailbox turned away, waiting for someone to look at them.',
  },
  defaultSort: '-receivedAt',
  fields: [
    { name: 'sender', type: 'text', required: true, index: true },
    { name: 'subject', type: 'text' },
    { name: 'receivedAt', type: 'date', required: true },
    {
      name: 'reason',
      type: 'select',
      required: true,
      options: [
        { label: 'Sender is outside the municipality', value: 'external_sender' },
        { label: 'Sender address could not be read', value: 'unreadable_sender' },
        { label: 'No staff email domains set up yet', value: 'no_internal_domains_configured' },
      ],
    },
    {
      name: 'messageId',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'Mailbox reference for the original message, used to fetch it again on release.' },
    },
    { name: 'internetMessageId', type: 'text', index: true },
    { name: 'attachmentCount', type: 'number', defaultValue: 0 },
    { name: 'released', type: 'checkbox', defaultValue: false, index: true },
    { name: 'releasedAt', type: 'date' },
    { name: 'releasedBy', type: 'relationship', relationTo: 'users' },
    {
      name: 'releaseError',
      type: 'text',
      admin: { description: 'Why the last attempt to release this message did not work.' },
    },
  ],
}
