'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from '../lib/payload'
import { loadActorContext, loadGlMappingConfig } from '../lib/gl-department-routing'
import { parseMask, resolveDepartmentForGl } from '../lib/segments'

const SETTINGS_PATH = '/settings/coding-restrictions'

export type CodableGlAccount = {
  id: string | number
  code: string
  description: string
  /** The department that owns this GL, so the coder can see where it routes. */
  owningDepartmentName: string | null
}

export type CodableGlPayload = {
  /** True when the coder's role carries Bypass Coding Restrictions. */
  bypass: boolean
  /** True when the list has been narrowed to the coder's own department. */
  restricted: boolean
  /** True when nothing is codable — the coder's department owns no GL accounts. */
  blocked: boolean
  /** Plain-language explanation to show under the GL picker, if any. */
  message: string | null
  glAccounts: CodableGlAccount[]
}

/**
 * The GL accounts this coder may pick, for the coding screen's dropdown.
 *
 * Coding access follows the coder's own department membership, never the
 * invoice's Department field. This is the usability half of the enforcement —
 * `assertLineCodingAllowed` in `lib/gl-department-routing` is the authority.
 */
export async function fetchCodableGlAccounts(): Promise<CodableGlPayload> {
  const payload = await getPayload()
  const [config, actor, glRes, deptRes] = await Promise.all([
    loadGlMappingConfig(),
    loadActorContext(),
    payload.find({ collection: 'gl-accounts', limit: 1000, depth: 0, sort: 'code' }),
    payload.find({ collection: 'departments', limit: 200, depth: 0 }),
  ])

  const departmentNames = new Map(
    (deptRes.docs as Array<{ id: string | number; name: string }>).map((d) => [String(d.id), d.name]),
  )
  const accounts = glRes.docs as Array<{ id: string | number; code: string; description: string }>

  if (!config.mask) {
    return {
      bypass: actor.bypass,
      restricted: false,
      blocked: false,
      message: null,
      glAccounts: accounts.map((a) => ({ ...a, owningDepartmentName: null })),
    }
  }

  const mask = config.mask
  const catchAll = config.catchAllDepartmentId ?? ''
  const withOwner = accounts.map((a) => {
    const owner = resolveDepartmentForGl(a.code, mask, config.rows, catchAll)
    return {
      id: a.id,
      code: a.code,
      description: a.description,
      owningDepartmentId: owner.departmentId,
      owningDepartmentName: departmentNames.get(String(owner.departmentId)) ?? null,
    }
  })

  if (actor.bypass) {
    return {
      bypass: true,
      restricted: false,
      blocked: false,
      message: 'Your role can code to any GL account.',
      glAccounts: withOwner,
    }
  }

  const blocked = (message: string): CodableGlPayload => ({
    bypass: false,
    restricted: true,
    blocked: true,
    message,
    glAccounts: [],
  })
  if (actor.departmentId === null) {
    return blocked(
      'You are not a member of any department, so no GL accounts are available. Ask an administrator to set your department.',
    )
  }
  const mine = withOwner.filter((a) => String(a.owningDepartmentId) === String(actor.departmentId))
  if (mine.length === 0) {
    return blocked(
      `No GL accounts are mapped to ${actor.departmentName ?? 'your department'}. Ask an administrator to add a sub-department range for it.`,
    )
  }
  return { bypass: false, restricted: true, blocked: false, message: null, glAccounts: mine }
}

export async function saveGlFormat(patch: {
  mask: string
  labels: string[]
  departmentSegment: number
  catchAllDepartment: string | number
}): Promise<{ id: string | number }> {
  // Reject an unusable format here rather than storing it and discovering the
  // problem the next time somebody codes an invoice.
  parseMask(patch.mask, patch.labels, patch.departmentSegment - 1)

  const payload = await getPayload()
  const data = {
    mask: patch.mask.trim(),
    segmentLabels: patch.labels.map((label) => ({ label })),
    departmentSegment: patch.departmentSegment,
    catchAllDepartment: patch.catchAllDepartment,
  }
  const existing = await payload.find({ collection: 'gl-format' as never, limit: 1, depth: 0 })
  const current = existing.docs[0] as { id: string | number } | undefined
  if (current) {
    await payload.update({
      collection: 'gl-format' as never,
      id: current.id as never,
      data: data as never,
    })
    revalidatePath(SETTINGS_PATH)
    return { id: current.id }
  }
  const created = (await payload.create({
    collection: 'gl-format' as never,
    data: data as never,
  })) as { id: string | number }
  revalidatePath(SETTINGS_PATH)
  return { id: created.id }
}

export async function upsertSegmentMapRow(
  id: string | number | null,
  patch: Record<string, unknown>,
): Promise<{ id: string | number }> {
  const payload = await getPayload()
  if (id) {
    await payload.update({
      collection: 'department-segment-map' as never,
      id: id as never,
      data: patch as never,
    })
    revalidatePath(SETTINGS_PATH)
    return { id }
  }
  const created = (await payload.create({
    collection: 'department-segment-map' as never,
    data: patch as never,
  })) as { id: string | number }
  revalidatePath(SETTINGS_PATH)
  return { id: created.id }
}

export async function deleteSegmentMapRow(id: string | number): Promise<void> {
  const payload = await getPayload()
  await payload.delete({ collection: 'department-segment-map' as never, id: id as never })
  revalidatePath(SETTINGS_PATH)
}
