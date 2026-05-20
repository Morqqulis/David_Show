import type { CollectionConfig } from 'payload'

export const Documents: CollectionConfig = {
  slug: 'documents',
  upload: {
    mimeTypes: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    staticDir: 'documents',
  },
  admin: { useAsTitle: 'filename', defaultColumns: ['filename', 'invoice', 'uploadedBy', 'createdAt'] },
  // Payload defaults deny `read` to anonymous, which breaks the PDF iframe
  // in the invoice viewer — the browser sometimes drops the session cookie
  // on framed same-origin requests (SameSite=Lax in newer Chromium builds).
  // Files themselves sit on UploadThing with `acl: 'public-read'` anyway, so
  // a Payload-level public read just unblocks the metadata + redirect to the
  // CDN URL. Mutations still require an authenticated user.
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    { name: 'invoice', type: 'relationship', relationTo: 'invoices' },
    { name: 'uploadedBy', type: 'relationship', relationTo: 'users' },
    { name: 'softDeleted', type: 'checkbox', defaultValue: false },
    { name: 'deletedReason', type: 'text' },
  ],
}
