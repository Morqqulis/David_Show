'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from '../lib/payload'
import {
  DEFAULT_CODING_RULES,
  normalizeCodingRules,
  type CodingRules,
} from '../lib/coding-completeness'

/**
 * Settings → Coding Table persistence.
 *
 * `coding-rules` is a single-row settings collection (this project has no
 * Payload globals). Reads take the first row and fall back to the documented
 * defaults; writes create that row on first save and update it thereafter.
 */

export async function fetchCodingRules(): Promise<CodingRules> {
  const payload = await getPayload()
  try {
    const res = await payload.find({ collection: 'coding-rules' as never, limit: 1, depth: 0 })
    return normalizeCodingRules(res.docs[0] ?? null)
  } catch (err) {
    // A missing table (collection not yet migrated) must not take the coding
    // screen or an approval down — fall back to the specified defaults, which
    // are the safe, blocking ones.
    console.error('[coding-rules] read failed, falling back to defaults', { err })
    return DEFAULT_CODING_RULES
  }
}

export async function saveCodingRules(patch: Partial<CodingRules>): Promise<{ id: string | number }> {
  const payload = await getPayload()
  const res = await payload.find({ collection: 'coding-rules' as never, limit: 1, depth: 0 })
  const existing = res.docs[0] as { id: string | number } | undefined

  // Normalizing before the write keeps an out-of-range tolerance or an empty
  // message from reaching the database, where every later read would have to
  // repair it.
  const next = normalizeCodingRules({ ...normalizeCodingRules(existing ?? null), ...patch })

  if (existing) {
    await payload.update({
      collection: 'coding-rules' as never,
      id: existing.id as never,
      data: next as never,
    })
    revalidatePath('/settings/coding-table')
    return { id: existing.id }
  }

  // `coding-rules` is registered at integration, so the generated types do not
  // know the slug yet and Payload infers `never` for the created doc.
  const created = (await payload.create({
    collection: 'coding-rules' as never,
    data: next as never,
  })) as { id: string | number }
  revalidatePath('/settings/coding-table')
  return { id: created.id }
}
