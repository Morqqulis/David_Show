import type { CollectionConfig } from 'payload'

export const AUDIT_ACTIONS = [
  'created',
  'updated',
  'assigned',
  'reassigned',
  'approved',
  'rejected',
  'coded',
  'batch_applied',
  'batch_wiped',
  'batch_closed',
  'exported',
  'archived',
  'archive_failed',
  'archive_retry',
  'verified',
  'unverified',
  'document_uploaded',
  'document_deleted',
  'comment_added',
  'soft_deleted',
  'restored',
  'flag_set',
  'flag_cleared',
] as const

export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export const AuditEvents: CollectionConfig = {
  slug: 'audit-events',
  admin: { useAsTitle: 'action', defaultColumns: ['createdAt', 'action', 'invoice', 'actor'] },
  defaultSort: '-createdAt',
  fields: [
    { name: 'invoice', type: 'relationship', relationTo: 'invoices', index: true },
    { name: 'actor', type: 'relationship', relationTo: 'users' },
    {
      name: 'action',
      type: 'select',
      required: true,
      options: AUDIT_ACTIONS as unknown as string[],
    },
    { name: 'context', type: 'json' },
  ],
}
