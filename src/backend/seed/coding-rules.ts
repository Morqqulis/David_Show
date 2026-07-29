import type { Payload } from 'payload'
import { DEFAULT_CODING_RULES } from '../lib/coding-completeness'

/**
 * Settings → Coding Table holds a single row. The seed is written to be
 * idempotent — update the existing row rather than adding a second one — so a
 * re-seed cannot leave two settings rows behind, where the older one would win
 * the `limit: 1` read.
 */
export async function seedCodingRules(payload: Payload) {
  const existing = await payload.find({ collection: 'coding-rules' as never, limit: 1, depth: 0 })
  const current = existing.docs[0] as { id: string | number } | undefined
  if (current) {
    await payload.update({
      collection: 'coding-rules' as never,
      id: current.id as never,
      data: DEFAULT_CODING_RULES as never,
    })
    return current
  }
  return payload.create({ collection: 'coding-rules' as never, data: DEFAULT_CODING_RULES as never })
}
