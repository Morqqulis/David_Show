'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from '../lib/payload'
import { recordAudit } from '../lib/stage-engine'
import { DEFAULT_EMAIL_WRAPPER, renderEmail, type EmailWrapper } from '../lib/email-render'
import {
  canOfferReassign,
  canRunBulkReassign,
  planBulkReassign,
  type ReassignInvoice,
  type ReassignPerson,
  type RolePermission,
} from '../lib/reassign-eligibility'
import { defaultActorId } from './invoice/_helpers'
import { resolveReasonText } from './reason-actions'
import { guard, UserFacingError, type ActionResult } from '../../lib/action-result'

/**
 * Reassignment: moving one person's outstanding slot on an invoice to somebody
 * else, at whatever stage the invoice already sits in. The stage never changes
 * and approvals already given are never cleared.
 *
 * There is exactly one engine — `reassignInvoices`. The single-invoice modal is
 * a batch of one. Bulk from-person and bulk row-selection differ only in how
 * the invoice list is gathered before it gets here.
 *
 * Collections registered at integration (`action-reasons`) and Payload's
 * `as never` idiom: see the note in reason-actions.ts.
 */

const ID = (v: unknown): string | number =>
  v !== null && typeof v === 'object' ? ((v as { id: string | number }).id) : (v as string | number)

const NAME = (v: unknown): string =>
  v !== null && typeof v === 'object' ? ((v as { name?: string }).name ?? 'Unnamed') : 'Unnamed'

type RoleDoc = {
  id: string | number
  name: string
  confidential?: boolean | null
  allowSelfReassign?: boolean | null
  permissions?: Array<{ action: string; object: string; scope: string; stages?: unknown[] | null }> | null
}

type InvoiceDoc = {
  id: string | number
  invoiceNumber: string
  confidential?: boolean | null
  currentStage?: { id: string | number; systemId: string; label: string; allowReassign?: boolean | null } | null
  assignees?: unknown[] | null
  approvals?: Array<{ user?: unknown; stage?: unknown; status?: string | null; at?: string | null; comment?: string | null }> | null
  vendor?: { name?: string } | null
  grandTotal?: number | null
}

type UserDoc = {
  id: string | number
  name?: string
  active?: boolean | null
  role?: unknown
  department?: unknown
}

/**
 * Roles are read at depth 1 so each permission's stage list comes back as stage
 * documents. Reaching the same thing through the users query would need depth 3
 * and drag every stage row in once per user.
 */
async function loadRoleMap(): Promise<Map<string, RoleDoc>> {
  const payload = await getPayload()
  const res = await payload.find({ collection: 'roles', limit: 100, depth: 1 })
  const roles = new Map<string, RoleDoc>()
  for (const r of res.docs as unknown as RoleDoc[]) roles.set(String(r.id), r)
  return roles
}

function toPerson(u: UserDoc, roles: Map<string, RoleDoc>): ReassignPerson {
  const roleDoc = u.role ? roles.get(String(ID(u.role))) : undefined
  return {
    id: u.id,
    name: u.name ?? 'Unnamed',
    active: u.active !== false,
    departmentId: u.department ? ID(u.department) : null,
    role: roleDoc
      ? {
          id: roleDoc.id,
          name: roleDoc.name,
          confidential: roleDoc.confidential === true,
          allowSelfReassign: roleDoc.allowSelfReassign === true,
          permissions: (roleDoc.permissions ?? []).map<RolePermission>((p) => ({
            action: p.action,
            object: p.object,
            scope: p.scope,
            stageSystemIds: (p.stages ?? []).map((s) => String((s as { systemId?: string }).systemId ?? '')),
          })),
        }
      : null,
  }
}

async function loadPeople(): Promise<ReassignPerson[]> {
  const payload = await getPayload()
  const [roles, usersRes] = await Promise.all([
    loadRoleMap(),
    payload.find({ collection: 'users', limit: 500, depth: 0 }),
  ])
  return (usersRes.docs as unknown as UserDoc[]).map((u) => toPerson(u, roles))
}

function toReassignInvoice(doc: InvoiceDoc): ReassignInvoice {
  return {
    id: doc.id,
    invoiceNumber: doc.invoiceNumber,
    stageSystemId: doc.currentStage?.systemId ?? '',
    stageLabel: doc.currentStage?.label ?? 'this stage',
    // An invoice whose stage row is missing is treated as locked rather than
    // open — failing towards "no button" cannot strand anything.
    stageAllowsReassign: doc.currentStage?.allowReassign === true,
    confidential: doc.confidential === true,
    assignees: (doc.assignees ?? []).map((u) => ({ id: ID(u), name: NAME(u) })),
    approvals: (doc.approvals ?? []).map((a) => ({
      userId: ID(a.user),
      userName: NAME(a.user),
      status: a.status ?? 'pending',
    })),
  }
}

async function loadActor(people: ReassignPerson[]): Promise<ReassignPerson | null> {
  const actorId = await defaultActorId()
  if (!actorId) return null
  return people.find((p) => String(p.id) === String(actorId)) ?? null
}

export type ReassignContext = {
  actor: ReassignPerson | null
  invoice: ReassignInvoice
  people: ReassignPerson[]
}

/** Everything the single-invoice modal needs; the rules themselves run client-side. */
export async function fetchReassignContext(invoiceId: string | number): Promise<ReassignContext> {
  const payload = await getPayload()
  const doc = (await payload.findByID({
    collection: 'invoices',
    id: invoiceId as never,
    depth: 2,
  })) as unknown as InvoiceDoc
  const people = await loadPeople()
  return { actor: await loadActor(people), invoice: toReassignInvoice(doc), people }
}

/**
 * Whether the Reassign button appears on this invoice at all. Kept separate
 * from `fetchReassignContext` on purpose: the invoice screen asks this on every
 * open, and it must not pay for the whole staff directory to answer it. The
 * modal loads the directory when it is actually opened.
 */
export async function fetchReassignAvailability(
  invoiceId: string | number,
): Promise<{ canReassign: boolean }> {
  const payload = await getPayload()
  const actorId = await defaultActorId()
  if (!actorId) return { canReassign: false }
  const [roles, actorRes, doc] = await Promise.all([
    loadRoleMap(),
    payload.find({ collection: 'users', where: { id: { equals: actorId } } as never, limit: 1, depth: 0 }),
    payload.findByID({ collection: 'invoices', id: invoiceId as never, depth: 2 }),
  ])
  const actorDoc = actorRes.docs[0] as unknown as UserDoc | undefined
  if (!actorDoc) return { canReassign: false }
  return {
    canReassign: canOfferReassign(toPerson(actorDoc, roles), toReassignInvoice(doc as unknown as InvoiceDoc)),
  }
}

/**
 * Whether the current person may run a bulk reassignment at all — Administrator
 * and Finance Team only. Asked by the All Requests toolbar on every render, so
 * like `fetchReassignAvailability` it stays away from the staff directory.
 */
export async function fetchBulkReassignPermission(): Promise<{ allowed: boolean }> {
  const payload = await getPayload()
  const actorId = await defaultActorId()
  if (!actorId) return { allowed: false }
  const [roles, actorRes] = await Promise.all([
    loadRoleMap(),
    payload.find({ collection: 'users', where: { id: { equals: actorId } } as never, limit: 1, depth: 0 }),
  ])
  const actorDoc = actorRes.docs[0] as unknown as UserDoc | undefined
  return { allowed: actorDoc ? canRunBulkReassign(toPerson(actorDoc, roles)) : false }
}

export type BulkReassignContext = {
  actor: ReassignPerson | null
  people: ReassignPerson[]
  stages: Array<{ systemId: string; label: string; allowReassign: boolean }>
  departments: Array<{ id: string | number; name: string }>
}

/** Directory and filter options for both bulk entry points. */
export async function fetchBulkReassignContext(): Promise<BulkReassignContext> {
  const payload = await getPayload()
  const [people, stagesRes, deptRes] = await Promise.all([
    loadPeople(),
    payload.find({ collection: 'stages', limit: 50, sort: 'order', depth: 0 }),
    payload.find({ collection: 'departments', limit: 200, sort: 'name', depth: 0 }),
  ])
  return {
    actor: await loadActor(people),
    people,
    stages: (stagesRes.docs as unknown as Array<{ systemId: string; label: string; allowReassign?: boolean }>).map(
      (s) => ({ systemId: s.systemId, label: s.label, allowReassign: s.allowReassign === true }),
    ),
    departments: (deptRes.docs as unknown as Array<{ id: string | number; name: string }>).map((d) => ({
      id: d.id,
      name: d.name,
    })),
  }
}

/** One person's open work, for the from-person entry point. */
export async function fetchOpenWorkFor(
  userId: string | number,
  filters?: { stageSystemId?: string; departmentId?: string | number },
): Promise<ReassignInvoice[]> {
  const payload = await getPayload()
  const where: Record<string, unknown> = {
    softDeleted: { not_equals: true },
    or: [{ assignees: { in: [userId] } }, { 'approvals.user': { equals: userId } }],
  }
  if (filters?.stageSystemId) where['currentStage.systemId'] = { equals: filters.stageSystemId }
  if (filters?.departmentId) where.departments = { in: [filters.departmentId] }

  const res = await payload.find({
    collection: 'invoices',
    where: where as never,
    // One over the cap, so the modal can say "more than 100" rather than
    // silently presenting a truncated list as if it were everything.
    limit: 101,
    depth: 2,
    sort: '-updatedAt',
  })
  return (res.docs as unknown as InvoiceDoc[]).map(toReassignInvoice)
}

/** The rows ticked on All Requests, re-read from the database rather than trusted. */
export async function fetchInvoicesForReassign(
  invoiceIds: Array<string | number>,
): Promise<ReassignInvoice[]> {
  if (invoiceIds.length === 0) return []
  const payload = await getPayload()
  const res = await payload.find({
    collection: 'invoices',
    where: { id: { in: invoiceIds } } as never,
    limit: 101,
    depth: 2,
  })
  return (res.docs as unknown as InvoiceDoc[]).map(toReassignInvoice)
}

export type ReassignCommand = {
  invoiceIds: Array<string | number>
  /** Whose slot moves. Null means each invoice's only slot. */
  fromUserId: string | number | null
  toUserId: string | number
  reasonId: string | number | null
  otherText?: string
}

export type ReassignOutcome = {
  moved: Array<{ invoiceId: string | number; invoiceNumber: string }>
  skipped: Array<{ invoiceId: string | number; invoiceNumber: string; reason: string }>
  /** Null when no template is configured for this notification. */
  notification: { recipient: string; subject: string; templateName: string } | null
  notificationProblem: string | null
}

/**
 * The one ownership-transfer path. Reads the invoices back from the database,
 * decides the whole batch up front, then writes only the entries that passed.
 * A failure on one invoice is reported and the rest still commit — a clerk
 * moving forty invoices should not lose thirty-nine to one bad row.
 */
export async function reassignInvoices(cmd: ReassignCommand): Promise<ActionResult<ReassignOutcome>> {
  return guard(() => runReassignInvoices(cmd))
}

async function runReassignInvoices(cmd: ReassignCommand): Promise<ReassignOutcome> {
  const payload = await getPayload()
  const people = await loadPeople()
  const actor = await loadActor(people)
  const target = people.find((p) => String(p.id) === String(cmd.toUserId)) ?? null
  if (!target) {
    throw new UserFacingError('That person is no longer in the directory. Pick somebody else.')
  }

  const reasonText = await resolveReasonText('reassign', cmd.reasonId, cmd.otherText)
  const invoices = await fetchInvoicesForReassign(cmd.invoiceIds)
  const fromPerson = people.find((p) => String(p.id) === String(cmd.fromUserId))
  const plan = planBulkReassign({
    actor,
    target,
    fromUserId: cmd.fromUserId,
    fromUserName: fromPerson?.name,
    invoices,
  })

  const moved: ReassignOutcome['moved'] = []
  const skipped: ReassignOutcome['skipped'] = plan.skips.map((s) => ({
    invoiceId: s.invoiceId,
    invoiceNumber: s.invoiceNumber,
    reason: s.reason ?? 'This invoice could not be reassigned.',
  }))

  for (const entry of plan.moves) {
    const slot = entry.slot
    if (!slot) continue
    try {
      const doc = (await payload.findByID({
        collection: 'invoices',
        id: entry.invoiceId as never,
        depth: 2,
      })) as unknown as InvoiceDoc

      // Ownership only. currentStage is untouched and no approval is cleared.
      const assignees = (doc.assignees ?? []).map(ID)
      const nextAssignees = assignees.filter((id) => String(id) !== String(slot.userId))
      // The new holder always joins the assignee list, including when an
      // administrator picked somebody outside the stage's role. That assignment
      // is what confers the ability to act on this one invoice — without it the
      // override would strand the invoice.
      if (!nextAssignees.some((id) => String(id) === String(target.id))) nextAssignees.push(target.id)

      const data: Record<string, unknown> = { assignees: nextAssignees }
      if (slot.kind === 'approval') {
        data.approvals = (doc.approvals ?? []).map((a, index) => ({
          user: index === slot.index ? target.id : ID(a.user),
          stage: ID(a.stage),
          status: a.status ?? 'pending',
          at: a.at ?? null,
          comment: a.comment ?? null,
        }))
      }

      await payload.update({ collection: 'invoices', id: entry.invoiceId as never, data: data as never })
      await recordAudit({
        payload,
        invoiceId: entry.invoiceId,
        actorId: actor?.id,
        action: 'reassigned',
        context: {
          fromUser: slot.userId,
          fromUserName: slot.userName,
          toUser: target.id,
          toUserName: target.name,
          slot: slot.kind,
          stage: doc.currentStage?.systemId,
          reason: reasonText,
          bulk: cmd.invoiceIds.length > 1,
          selfReassign: String(target.id) === String(actor?.id ?? ''),
        },
      })
      moved.push({ invoiceId: entry.invoiceId, invoiceNumber: entry.invoiceNumber })
      revalidatePath(`/requests/${entry.invoiceId}`)
    } catch (err) {
      console.error('[reassign] could not move a slot', {
        invoiceId: entry.invoiceId,
        toUser: target.id,
        slot: slot.kind,
        err,
      })
      skipped.push({
        invoiceId: entry.invoiceId,
        invoiceNumber: entry.invoiceNumber,
        reason: 'Saving this one failed. Nothing was changed on it — try it again on its own.',
      })
    }
  }

  revalidatePath('/requests')
  const notification = await notifyNewAssignee(target, moved, reasonText)
  return { moved, skipped, ...notification }
}

const SINGLE_TEMPLATE = 'Invoice Reassigned to You'
const BULK_TEMPLATE = 'Invoices Reassigned to You'

/**
 * Renders the notification to the new assignee and hands it to the email seam.
 *
 * There is no transport in this application yet: `renderEmail` is the boundary,
 * and what it produces is recorded and returned so the screen can tell the user
 * what was sent. When a sender is built it takes the same rendered object.
 * The previous assignee is deliberately not written to.
 */
async function notifyNewAssignee(
  target: ReassignPerson,
  moved: ReassignOutcome['moved'],
  reasonText: string | null,
): Promise<Pick<ReassignOutcome, 'notification' | 'notificationProblem'>> {
  if (moved.length === 0) return { notification: null, notificationProblem: null }
  const payload = await getPayload()
  // One consolidated message for a batch, never one per invoice.
  const wanted = moved.length === 1 ? SINGLE_TEMPLATE : BULK_TEMPLATE

  try {
    const [tplRes, settingsRes] = await Promise.all([
      payload.find({
        collection: 'email-templates',
        where: { name: { equals: wanted }, enabled: { equals: true } } as never,
        limit: 1,
      }),
      payload.find({ collection: 'email-settings' as never, limit: 1 }),
    ])
    const tpl = tplRes.docs[0] as unknown as { name: string; subject: string; bodyHtml: string } | undefined
    if (!tpl) {
      console.error('[reassign] no enabled email template for this notification', { template: wanted })
      return {
        notification: null,
        notificationProblem: `The invoice moved, but no "${wanted}" email template is set up, so nobody was emailed.`,
      }
    }
    const wrapper = (settingsRes.docs[0] as unknown as EmailWrapper | undefined) ?? DEFAULT_EMAIL_WRAPPER
    const rendered = renderEmail({
      subject: tpl.subject,
      bodyHtml: tpl.bodyHtml,
      wrapper,
      values: {
        '{{Assignee}}': target.name,
        '{{InvoiceNumber}}': moved[0].invoiceNumber,
        '{{InvoiceList}}': moved.map((m) => m.invoiceNumber).join(', '),
        '{{InvoiceCount}}': String(moved.length),
        '{{Reason}}': reasonText ?? 'No reason was given.',
        '{{Municipality}}': 'City of Aurora',
        '{{AppName}}': 'AuroraAP',
      },
    })
    return {
      notification: { recipient: target.name, subject: rendered.subject, templateName: tpl.name },
      notificationProblem: null,
    }
  } catch (err) {
    // A notification failure must never undo a reassignment that already saved.
    console.error('[reassign] notification could not be prepared', { toUser: target.id, template: wanted, err })
    return {
      notification: null,
      notificationProblem: 'The invoice moved, but the notification email could not be prepared.',
    }
  }
}
