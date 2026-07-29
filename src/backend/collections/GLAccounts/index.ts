import type { CollectionConfig, Payload, TextFieldSingleValidation } from 'payload'
import { parseMask, validateGlCode, type GlMask } from '../../lib/segments'

/**
 * Read the tenant's GL account format, or `null` when none is configured.
 *
 * Kept local rather than shared with the server actions on purpose: this runs
 * inside the Payload config, which is loaded by the Payload CLI as well as by
 * Next.js, and must not pull a `'use server'` module into that graph.
 */
async function configuredMask(payload: Payload): Promise<GlMask | null> {
  // Before the format collection is registered there is nothing to validate
  // against — importing a GL master must not fail on a missing setting.
  const registered = (payload.collections as unknown as Record<string, unknown>)['gl-format']
  if (!registered) return null

  const res = await payload.find({ collection: 'gl-format' as never, limit: 1, depth: 0 })
  const doc = res.docs[0] as
    | { mask?: string; segmentLabels?: Array<{ label: string }>; departmentSegment?: number }
    | undefined
  if (!doc?.mask) return null

  try {
    return parseMask(
      doc.mask,
      (doc.segmentLabels ?? []).map((s) => s.label),
      (doc.departmentSegment ?? 1) - 1,
    )
  } catch (err) {
    // A format the admin saved in a broken state must not block the GL master.
    // The Coding Restrictions screen reports the same problem where it can be
    // fixed.
    console.error('[gl-accounts] stored GL account format is unusable, skipping length check', {
      mask: doc.mask,
      departmentSegment: doc.departmentSegment,
      message: (err as Error).message,
    })
    return null
  }
}

/**
 * Length check at write time: the mask is what makes a malformed GL account
 * rejectable rather than quietly accepted into the master.
 */
const validateCodeAgainstMask: TextFieldSingleValidation = async (value, { req }) => {
  if (typeof value !== 'string' || value.trim() === '') return true // `required` reports this
  const mask = await configuredMask(req.payload)
  if (!mask) return true
  const check = validateGlCode(value, mask)
  if (check.ok) return true
  console.error('[gl-accounts] rejected a code that does not match the configured format', {
    code: value,
    reason: check.reason,
  })
  return check.reason ?? 'This code does not match the GL account format.'
}

export const GLAccounts: CollectionConfig = {
  slug: 'gl-accounts',
  admin: { useAsTitle: 'code', defaultColumns: ['code', 'description', 'active'] },
  fields: [
    {
      name: 'code',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: 'Must match the GL account format set in Settings → Coding Restrictions.' },
      validate: validateCodeAgainstMask,
    },
    { name: 'description', type: 'text', required: true },
    { name: 'active', type: 'checkbox', defaultValue: true },
    {
      // DEAD FIELD, kept only to hold its table in place. A GL code is split
      // on demand by the mask in Settings → Coding Restrictions, so nothing
      // reads or writes these rows; they were never populated by any hook
      // either. Removing the field drops the `gl_accounts_segments` table,
      // which is a destructive migration and a separate, deliberate decision.
      // Delete the field and the table together when that decision is taken.
      name: 'segments',
      type: 'array',
      admin: { hidden: true },
      fields: [{ name: 'value', type: 'text' }],
    },
  ],
}
