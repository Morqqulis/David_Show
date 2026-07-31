import 'server-only'
import { getPayload } from './payload'
import { defaultActorId } from '../actions/invoice/_helpers'
import { resolveDepartmentForGl, parseMask, validateGlCode, type GlMask, type SegmentMapRow } from './segments'
import { UserFacingError } from '../../lib/action-result'

/**
 * Which department owns a GL account, and whether the person in front of the
 * screen is allowed to code to it.
 *
 * Sits beside `stage-engine.ts` as a server-side engine: server actions import
 * from here, it never imports from them.
 */

/** Relationship fields come back either populated or as a bare id. */
export function idOf(value: unknown): string | number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'object') return (value as { id?: string | number }).id ?? null
  return value as string | number
}

export type GlMappingConfig = {
  /** `null` when no usable format is configured — restrictions are then off. */
  mask: GlMask | null
  /** Why the stored format could not be used, for the Settings screen. */
  maskError: string | null
  catchAllDepartmentId: string | number | null
  rows: SegmentMapRow[]
}

/**
 * The GL account format plus every sub-department range, in the shape the pure
 * engine in `lib/segments` expects.
 *
 * A missing format means "restrictions are not set up" and leaves coding open.
 * That is different from an unmapped sub-department, which is deliberately
 * fail-closed and routes to the catch-all department.
 */
export async function loadGlMappingConfig(): Promise<GlMappingConfig> {
  const payload = await getPayload()

  // Before these collections are registered there is nothing to enforce; the
  // coding screen must keep working rather than fail.
  const registry = payload.collections as unknown as Record<string, unknown>
  if (!registry['gl-format'] || !registry['department-segment-map']) {
    return { mask: null, maskError: null, catchAllDepartmentId: null, rows: [] }
  }

  const [formatRes, rowRes] = await Promise.all([
    payload.find({ collection: 'gl-format' as never, limit: 1, depth: 0 }),
    payload.find({ collection: 'department-segment-map' as never, limit: 1000, depth: 0 }),
  ])

  const format = formatRes.docs[0] as
    | {
        mask?: string
        segmentLabels?: Array<{ label: string }>
        departmentSegment?: number
        catchAllDepartment?: unknown
      }
    | undefined

  const rows: SegmentMapRow[] = (
    rowRes.docs as Array<{ department?: unknown; fromValue?: string; toValue?: string | null }>
  ).flatMap((doc) => {
    const departmentId = idOf(doc.department)
    const from = (doc.fromValue ?? '').trim()
    if (departmentId === null || !from) return []
    const to = (doc.toValue ?? '').trim()
    return [{ departmentId, from, to: to === '' ? null : to }]
  })

  const catchAllDepartmentId = idOf(format?.catchAllDepartment)
  if (!format?.mask) return { mask: null, maskError: null, catchAllDepartmentId, rows }

  try {
    const mask = parseMask(
      format.mask,
      (format.segmentLabels ?? []).map((s) => s.label),
      (format.departmentSegment ?? 1) - 1,
    )
    return { mask, maskError: null, catchAllDepartmentId, rows }
  } catch (err) {
    console.error('[gl-mapping] the saved GL account format cannot be used', {
      mask: format.mask,
      departmentSegment: format.departmentSegment,
      message: (err as Error).message,
    })
    return { mask: null, maskError: (err as Error).message, catchAllDepartmentId, rows }
  }
}

export type ActorContext = {
  userId: string | number | null
  departmentId: string | number | null
  departmentName: string | null
  bypass: boolean
}

/**
 * Who is coding. There is no auth layer yet, so this resolves through the same
 * `defaultActorId()` convention the rest of the invoice actions use.
 */
export async function loadActorContext(): Promise<ActorContext> {
  const payload = await getPayload()
  const actorId = await defaultActorId()
  if (!actorId) {
    console.error('[gl-mapping] no default actor user exists, treating the coder as unassigned')
    return { userId: null, departmentId: null, departmentName: null, bypass: false }
  }
  const user = (await payload.findByID({ collection: 'users', id: actorId as never, depth: 1 })) as {
    department?: { id: string | number; name?: string } | string | number | null
    role?: { bypassCodingRestrictions?: boolean } | string | number | null
  }
  const department = typeof user.department === 'object' ? user.department : null
  const role = typeof user.role === 'object' ? user.role : null
  return {
    userId: actorId,
    departmentId: idOf(user.department),
    departmentName: department?.name ?? null,
    bypass: Boolean(role?.bypassCodingRestrictions),
  }
}

/**
 * The authoritative check. The coding screen's dropdown is filtered for
 * usability only; this runs on save, so a caller that never saw the filtered
 * list is still refused. Throws with a message meant for the coder.
 */
export async function assertLineCodingAllowed(
  glAccountId: string | number | null | undefined,
): Promise<void> {
  // A line may legitimately be saved before its GL account is chosen.
  if (glAccountId === null || glAccountId === undefined || glAccountId === '') return

  const payload = await getPayload()
  const [config, actor] = await Promise.all([loadGlMappingConfig(), loadActorContext()])
  if (!config.mask) return
  if (actor.bypass) return

  const gl = (await payload.findByID({
    collection: 'gl-accounts',
    id: glAccountId as never,
    depth: 0,
  })) as { code: string }

  const check = validateGlCode(gl.code, config.mask)
  if (!check.ok) {
    console.error('[gl-mapping] refused a line coded to a GL that does not fit the format', {
      glAccountId,
      code: gl.code,
      reason: check.reason,
    })
    throw new UserFacingError(
      `${gl.code} does not match the GL account format. ${check.reason ?? ''}`.trim(),
    )
  }

  if (actor.departmentId === null) {
    console.error('[gl-mapping] refused a line from a coder with no department', {
      userId: actor.userId,
      glAccountId,
    })
    throw new UserFacingError(
      'You are not a member of any department, so you cannot code invoice lines. Ask an administrator to set your department.',
    )
  }

  const owner = resolveDepartmentForGl(
    gl.code,
    config.mask,
    config.rows,
    config.catchAllDepartmentId ?? '',
  )
  if (String(owner.departmentId) !== String(actor.departmentId)) {
    console.error('[gl-mapping] refused a cross-department GL selection', {
      code: gl.code,
      matchedBy: owner.matchedBy,
      owningDepartmentId: owner.departmentId,
      actorDepartmentId: actor.departmentId,
    })
    throw new UserFacingError(
      `${gl.code} belongs to another department. Choose a GL account for ${actor.departmentName ?? 'your department'}.`,
    )
  }
}

/**
 * Coding a line to another department's GL pulls that department's reviewer
 * onto the invoice as a parallel approver.
 *
 * Only ever appends: approvals already recorded — including ones already given
 * — are carried through untouched.
 */
export async function syncCrossDepartmentApprovers(
  invoiceId: string | number,
): Promise<{ added: number }> {
  const payload = await getPayload()
  const config = await loadGlMappingConfig()
  if (!config.mask) return { added: 0 }
  const mask = config.mask

  const [invoice, lineRes] = await Promise.all([
    payload.findByID({ collection: 'invoices', id: invoiceId as never, depth: 1 }) as Promise<{
      departments?: unknown[]
      currentStage?: unknown
      approvals?: Array<{
        user?: unknown
        stage?: unknown
        status?: string | null
        at?: string | null
        comment?: string | null
      }>
    }>,
    payload.find({
      collection: 'invoice-lines',
      where: { invoice: { equals: invoiceId } } as never,
      limit: 200,
      depth: 1,
    }),
  ])

  const stageId = idOf(invoice.currentStage)
  if (stageId === null) {
    console.error('[gl-mapping] cannot add reviewers to an invoice with no current stage', { invoiceId })
    return { added: 0 }
  }

  const invoiceDepartmentIds = new Set((invoice.departments ?? []).map((d) => String(idOf(d))))
  const owningDepartmentIds = new Set<string>()
  for (const line of lineRes.docs as Array<{ glAccount?: unknown }>) {
    const gl = typeof line.glAccount === 'object' ? (line.glAccount as { code?: string }) : null
    if (!gl?.code) continue
    const owner = resolveDepartmentForGl(gl.code, mask, config.rows, config.catchAllDepartmentId ?? '')
    if (owner.departmentId !== '') owningDepartmentIds.add(String(owner.departmentId))
  }

  const existing = invoice.approvals ?? []
  const seenUserIds = new Set(existing.map((a) => String(idOf(a.user))))
  const additions: Array<{ user: string | number; stage: string | number; status: 'pending' }> = []

  for (const departmentId of owningDepartmentIds) {
    if (invoiceDepartmentIds.has(departmentId)) continue
    const department = (await payload.findByID({
      collection: 'departments',
      id: departmentId as never,
      depth: 0,
    })) as { name?: string; reviewer?: unknown; head?: unknown }
    const reviewerId = idOf(department.reviewer) ?? idOf(department.head)
    if (reviewerId === null) {
      console.error('[gl-mapping] a cross-department GL has no reviewer to notify', {
        invoiceId,
        departmentId,
        departmentName: department.name,
      })
      continue
    }
    if (seenUserIds.has(String(reviewerId))) continue
    seenUserIds.add(String(reviewerId))
    additions.push({ user: reviewerId, stage: stageId, status: 'pending' })
  }

  if (additions.length === 0) return { added: 0 }

  const preserved = existing.map((a) => ({
    user: idOf(a.user),
    stage: idOf(a.stage),
    status: a.status ?? 'pending',
    at: a.at ?? null,
    comment: a.comment ?? null,
  }))
  await payload.update({
    collection: 'invoices',
    id: invoiceId as never,
    data: { approvals: [...preserved, ...additions] } as never,
  })
  return { added: additions.length }
}
