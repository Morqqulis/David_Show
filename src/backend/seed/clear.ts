import type { Payload } from 'payload'

// Note: 'users' is intentionally excluded — Payload won't delete the currently
// authed admin, and seedUsers does an upsert by email so re-running is safe.
const COLLECTIONS_TO_CLEAR = [
  'audit-events',
  'invoice-comments',
  'invoice-lines',
  'documents',
  'invoices',
  'batches',
  'email-triggers',
  'email-templates',
  'coding-restrictions',
  'approval-rules',
  'fields',
  'sections',
  'stages',
  'tax-codes',
  'dimensions',
  'gl-accounts',
  'vendors',
  'roles',
  'departments',
] as const

export async function clearAll(payload: Payload) {
  for (const slug of COLLECTIONS_TO_CLEAR) {
    try {
      await payload.delete({ collection: slug as never, where: { id: { exists: true } } as never })
    } catch (e) {
      console.warn(`[seed] could not clear ${slug}:`, (e as Error).message)
    }
  }
}
