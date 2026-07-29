/**
 * Every rule that decides who may reassign an invoice, who may receive it, and
 * which invoices a bulk operation is allowed to touch.
 *
 * Deliberately dependency-free — no Payload, no React, no `server-only`. The
 * server actions shape database rows into these types and call in; the modal
 * calls the same functions in the browser so the "show everyone" toggle is
 * instant instead of a round-trip. One set of rules, two callers, no drift.
 *
 * NOTE ON SECURITY: this app has no authentication layer yet (see CLAUDE.md
 * §7.1). Nothing here is a security boundary — a determined caller can invoke
 * the server actions directly. It is a correctness model, built against roles
 * so that it is already right the day sessions land. Treat it as such.
 */

/** No single operation may move more than this many invoices. */
export const BULK_REASSIGN_CAP = 100

export type RolePermission = {
  action: string
  object: string
  scope: string
  /** systemIds of the stages this permission is limited to. Empty = every stage. */
  stageSystemIds: string[]
}

export type ReassignRole = {
  id: string | number
  name: string
  /** Cleared to see confidential invoices. */
  confidential: boolean
  /** May take an invoice over from somebody else. */
  allowSelfReassign: boolean
  permissions: RolePermission[]
}

export type ReassignPerson = {
  id: string | number
  name: string
  active: boolean
  role: ReassignRole | null
  departmentId: string | number | null
}

export type ApprovalRecord = {
  userId: string | number
  userName: string
  status: string
}

export type ReassignInvoice = {
  id: string | number
  invoiceNumber: string
  stageSystemId: string
  /** The admin-editable stage name, for messages a clerk reads. */
  stageLabel: string
  /** The per-stage Reassign switch in Settings → Workflow. */
  stageAllowsReassign: boolean
  confidential: boolean
  assignees: Array<{ id: string | number; name: string }>
  approvals: ApprovalRecord[]
}

/**
 * A single unit of ownership that can be moved. An `approval` slot is one
 * person's outstanding sign-off at a stage that collects several; an
 * `assignee` slot is plain ownership at a stage that collects none.
 */
export type OwnershipSlot =
  | { kind: 'approval'; index: number; userId: string | number; userName: string }
  | { kind: 'assignee'; userId: string | number; userName: string }

const sameId = (a: string | number | null | undefined, b: string | number | null | undefined) =>
  a !== null && a !== undefined && b !== null && b !== undefined && String(a) === String(b)

/**
 * Actions that constitute working on an invoice. `view` is excluded on
 * purpose: a person who can only read an invoice cannot move it forward, so
 * handing it to them strands it in a queue nobody is watching — the exact
 * failure the picker filter exists to prevent.
 */
const WORKING_ACTIONS = new Set(['edit', 'assign', 'code', 'approve', 'reject', 'verify'])

/** Holds the settings permission, which in this app is what an administrator is. */
export function isAdministrator(role: ReassignRole | null): boolean {
  return (role?.permissions ?? []).some(
    (p) => p.action === 'configure' && p.object === 'settings' && p.scope === 'all',
  )
}

/**
 * May move other people's work. Administrators qualify outright; so does any
 * role carrying `reassign` or `assign` over every invoice, which is how the
 * Finance Team roles are expressed in this data model. Derived from the
 * permission rows rather than matched on a role name, because role names are
 * client-editable text and would silently stop matching.
 */
export function canReassignOthers(role: ReassignRole | null): boolean {
  if (isAdministrator(role)) return true
  return (role?.permissions ?? []).some(
    (p) => (p.action === 'reassign' || p.action === 'assign') && p.object === 'invoice' && p.scope === 'all',
  )
}

/** Whether this role is one of those that act at the given stage. */
export function actsAtStage(role: ReassignRole | null, stageSystemId: string): boolean {
  return (role?.permissions ?? []).some(
    (p) =>
      p.object === 'invoice' &&
      WORKING_ACTIONS.has(p.action) &&
      (p.stageSystemIds.length === 0 || p.stageSystemIds.includes(stageSystemId)),
  )
}

/** Pending sign-offs first; ownership otherwise. Given approvals are never returned. */
export function listOwnershipSlots(invoice: ReassignInvoice): OwnershipSlot[] {
  const pending: OwnershipSlot[] = []
  invoice.approvals.forEach((a, index) => {
    if (a.status === 'pending') pending.push({ kind: 'approval', index, userId: a.userId, userName: a.userName })
  })
  if (pending.length > 0) return pending
  return invoice.assignees.map((u) => ({ kind: 'assignee' as const, userId: u.id, userName: u.name }))
}

/** The Reassign button on a single invoice: shown, or absent entirely. */
export function canOfferReassign(actor: ReassignPerson | null, invoice: ReassignInvoice): boolean {
  if (!actor || !invoice.stageAllowsReassign) return false
  if (invoice.confidential && !actor.role?.confidential) return false
  const holdsASlot = listOwnershipSlots(invoice).some((s) => sameId(s.userId, actor.id))
  return holdsASlot || canReassignOthers(actor.role)
}

/** Bulk reassign is for Administrators and the Finance Team only. */
export function canRunBulkReassign(actor: ReassignPerson | null): boolean {
  return canReassignOthers(actor?.role ?? null)
}

export type SelfReassignVerdict = { allowed: boolean; message?: string }

/** Taking an invoice over yourself — allowed, audited, and gated by role. */
export function selfReassignVerdict(
  actor: ReassignPerson | null,
  targetId: string | number,
): SelfReassignVerdict {
  if (!actor || !sameId(actor.id, targetId)) return { allowed: true }
  if (actor.role?.allowSelfReassign) return { allowed: true }
  return {
    allowed: false,
    message: 'Your role cannot take invoices over. Ask an administrator or the finance team to move it.',
  }
}

export type PickerResult = {
  people: ReassignPerson[]
  /** Administrators may widen the picker past the role-at-stage filter. */
  overrideAvailable: boolean
  overrideActive: boolean
}

/**
 * Who the modal offers. The slot's current holder is left out — moving a slot
 * to the person already in it is a no-op dressed up as an action.
 */
export function listPickerPeople(input: {
  actor: ReassignPerson | null
  invoice: ReassignInvoice
  people: ReassignPerson[]
  /** The holder being replaced; omit when the caller has not chosen a slot yet. */
  slotUserId?: string | number | null
  showAll?: boolean
}): PickerResult {
  const { actor, invoice, people, slotUserId, showAll = false } = input
  const overrideAvailable = isAdministrator(actor?.role ?? null)
  const overrideActive = overrideAvailable && showAll

  const filtered = people.filter((p) => {
    if (!p.active) return false
    if (sameId(p.id, slotUserId)) return false
    // A picker is a place a name leaks. Confidential invoices only ever list
    // people whose role carries the Confidential flag.
    if (invoice.confidential && !p.role?.confidential) return false
    if (sameId(p.id, actor?.id) && !p.role?.allowSelfReassign) return false
    if (overrideActive) return true
    return actsAtStage(p.role, invoice.stageSystemId)
  })

  return { people: filtered, overrideAvailable, overrideActive }
}

export type BulkPlanEntry = {
  invoiceId: string | number
  invoiceNumber: string
  decision: 'move' | 'skip'
  slot?: OwnershipSlot
  /** Present only on a skip. One sentence, written for a finance clerk. */
  reason?: string
}

export type BulkPlan = {
  entries: BulkPlanEntry[]
  moves: BulkPlanEntry[]
  skips: BulkPlanEntry[]
  capExceeded: boolean
  cap: number
}

export type BulkSelectionGroup = {
  userId: string | number
  userName: string
  invoiceIds: Array<string | number>
}

/**
 * Row selection, arranged by whose slot each row is waiting on. An invoice with
 * two outstanding sign-offs appears under both names, which is what lets the
 * user say *whose* slot they meant instead of the operation guessing.
 */
export function groupByCurrentOwner(invoices: ReassignInvoice[]): BulkSelectionGroup[] {
  const groups = new Map<string, BulkSelectionGroup>()
  for (const invoice of invoices) {
    for (const slot of listOwnershipSlots(invoice)) {
      const key = String(slot.userId)
      const group = groups.get(key) ?? { userId: slot.userId, userName: slot.userName, invoiceIds: [] }
      group.invoiceIds.push(invoice.id)
      groups.set(key, group)
    }
  }
  return [...groups.values()].sort((a, b) => a.userName.localeCompare(b.userName))
}

/**
 * The whole decision for a batch, made before anything is written. Single
 * reassign is a batch of one and goes through here too, so there is exactly one
 * place that decides what a reassignment is allowed to do.
 */
export function planBulkReassign(input: {
  actor: ReassignPerson | null
  target: ReassignPerson | null
  /** Whose slot moves. Null means "each invoice's only slot". */
  fromUserId: string | number | null
  fromUserName?: string
  invoices: ReassignInvoice[]
}): BulkPlan {
  const { actor, target, fromUserId, invoices } = input
  const fromUserName = input.fromUserName ?? 'that person'
  const cap = BULK_REASSIGN_CAP

  if (invoices.length > cap) {
    const entries = invoices.map<BulkPlanEntry>((i) => ({
      invoiceId: i.id,
      invoiceNumber: i.invoiceNumber,
      decision: 'skip',
      reason: `Only ${cap} invoices can be reassigned at a time. ${invoices.length} were selected.`,
    }))
    return { entries, moves: [], skips: entries, capExceeded: true, cap }
  }

  const adminOverride = isAdministrator(actor?.role ?? null)
  const selfVerdict = target ? selfReassignVerdict(actor, target.id) : { allowed: true }

  const entries = invoices.map<BulkPlanEntry>((invoice) => {
    const skip = (reason: string): BulkPlanEntry => ({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      decision: 'skip',
      reason,
    })

    if (!target) return skip('No person was chosen to receive the invoice.')
    if (!selfVerdict.allowed) return skip(selfVerdict.message as string)
    if (!invoice.stageAllowsReassign) {
      return skip(`Reassigning is switched off for the ${invoice.stageLabel} stage.`)
    }
    if (invoice.confidential && !target.role?.confidential) {
      return skip(`${target.name} is not cleared to see confidential invoices.`)
    }

    const slots = listOwnershipSlots(invoice)
    const slot = fromUserId === null ? slots[0] : slots.find((s) => sameId(s.userId, fromUserId))
    if (!slot) {
      return skip(
        fromUserId === null
          ? 'Nobody is currently holding this invoice.'
          : `Nothing is waiting on ${fromUserName} for this invoice.`,
      )
    }
    if (fromUserId === null && slots.length > 1) {
      return skip('Several people are being waited on — reassign this one from the invoice itself.')
    }
    if (sameId(slot.userId, target.id)) return skip(`${target.name} already has this invoice.`)

    // The administrator override is what makes a cross-role handover possible;
    // the assignment itself is what confers the ability to act on this one
    // invoice, so an overridden pick is never stranded.
    if (!adminOverride && !actsAtStage(target.role, invoice.stageSystemId)) {
      return skip(`${target.name} does not work on invoices at the ${invoice.stageLabel} stage.`)
    }

    return { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, decision: 'move', slot }
  })

  return {
    entries,
    moves: entries.filter((e) => e.decision === 'move'),
    skips: entries.filter((e) => e.decision === 'skip'),
    capExceeded: false,
    cap,
  }
}
