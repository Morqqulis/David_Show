import type { CollectionConfig } from 'payload'

export const Documents: CollectionConfig = {
  slug: 'documents',
  upload: {
    mimeTypes: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    staticDir: 'documents',
  },
  admin: { useAsTitle: 'filename', defaultColumns: ['filename', 'invoice', 'uploadedBy', 'createdAt'] },
  fields: [
    { name: 'invoice', type: 'relationship', relationTo: 'invoices' },
    { name: 'uploadedBy', type: 'relationship', relationTo: 'users' },
    { name: 'softDeleted', type: 'checkbox', defaultValue: false },
    { name: 'deletedReason', type: 'text' },
  ],
}
