import type { CollectionConfig } from 'payload'
import { DEFAULT_CONFIDENCE_THRESHOLD } from '../../lib/intake-field-mapping'
import { DEFAULT_SENDER_POLICY } from '../../lib/intake-sender-policy'

/**
 * The monitored AP mailbox and who is allowed to send to it.
 *
 * A single-row collection rather than a Payload global, matching every other
 * settings entity in this app: one pattern to learn, and readers take the first
 * row and fall back to documented defaults so a fresh database behaves sanely
 * instead of crashing.
 *
 * The mailbox address lives here, never in code — one shared mailbox per
 * client, in the client's own Microsoft 365 tenant.
 */
export const IntakeSettings: CollectionConfig = {
  slug: 'intake-settings',
  labels: { singular: 'Email Intake Setting', plural: 'Email Intake Settings' },
  admin: {
    useAsTitle: 'mailboxAddress',
    defaultColumns: ['mailboxAddress', 'senderPolicy', 'enabled'],
    description: 'The mailbox invoices are emailed to, and who may email it.',
  },
  fields: [
    {
      name: 'enabled',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'When off, nothing arriving in the mailbox is turned into an invoice.' },
    },
    {
      name: 'mailboxAddress',
      type: 'email',
      admin: { description: 'The shared mailbox invoices are forwarded to, e.g. ap@aurora.ca.' },
    },
    {
      name: 'senderPolicy',
      type: 'select',
      required: true,
      defaultValue: DEFAULT_SENDER_POLICY.mode,
      options: [
        { label: 'Staff only — accept invoices from our own email domains', value: 'internal_only' },
        { label: 'Public — accept invoices from anyone on the internet', value: 'public' },
      ],
    },
    {
      name: 'internalDomains',
      type: 'array',
      admin: {
        description:
          'Email domains counted as staff, e.g. aurora.ca. Subdomains of a listed domain also count.',
        condition: (_, sibling) => sibling?.senderPolicy === 'internal_only',
      },
      fields: [{ name: 'domain', type: 'text', required: true }],
    },
    {
      name: 'confidenceThreshold',
      type: 'number',
      required: true,
      min: 0,
      max: 1,
      defaultValue: DEFAULT_CONFIDENCE_THRESHOLD,
      admin: {
        description:
          'How sure the reading has to be before a value is filled in. Below this the field is left blank. 0.8 means 80%.',
      },
    },
    {
      name: 'amountTolerance',
      type: 'number',
      required: true,
      min: 0,
      defaultValue: 0.02,
      admin: {
        description:
          'How far the amounts on an invoice may disagree before it is flagged for review, in dollars.',
      },
    },
    // Written by the subscription actions, never typed by an admin. Kept here
    // rather than in memory so a redeploy does not lose track of a live
    // subscription and start a second one against the same mailbox.
    {
      name: 'subscriptionId',
      type: 'text',
      admin: { readOnly: true, description: 'Set automatically when the mailbox connection is started.' },
    },
    {
      name: 'subscriptionExpiresAt',
      type: 'date',
      admin: { readOnly: true, description: 'The mailbox connection is renewed automatically before this time.' },
    },
    {
      name: 'lastNotificationAt',
      type: 'date',
      admin: { readOnly: true, description: 'Last time the mailbox told us something had arrived.' },
    },
  ],
}
