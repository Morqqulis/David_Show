import { describe, expect, test } from 'bun:test'
import {
  BULK_REASSIGN_CAP,
  actsAtStage,
  canOfferReassign,
  canReassignOthers,
  canRunBulkReassign,
  groupByCurrentOwner,
  isAdministrator,
  listOwnershipSlots,
  listPickerPeople,
  planBulkReassign,
  selfReassignVerdict,
  type ReassignInvoice,
  type ReassignPerson,
  type ReassignRole,
  type RolePermission,
} from './reassign-eligibility'

// ── Fixtures ────────────────────────────────────────────────────────────────
// Built explicitly rather than derived from each other, so a change to one
// role's shape cannot quietly move another test's preconditions.

const perm = (
  action: string,
  object = 'invoice',
  scope = 'all',
  stageSystemIds: string[] = [],
): RolePermission => ({ action, object, scope, stageSystemIds })

const role = (patch: Partial<ReassignRole> & { id: string; name: string }): ReassignRole => ({
  confidential: false,
  allowSelfReassign: false,
  permissions: [],
  ...patch,
})

const ADMIN = role({
  id: 'r-admin',
  name: 'Admin',
  confidential: true,
  allowSelfReassign: true,
  permissions: [perm('configure', 'settings'), perm('edit'), perm('approve')],
})

const FINANCE = role({
  id: 'r-finance',
  name: 'AP Clerk',
  confidential: false,
  allowSelfReassign: true,
  permissions: [perm('assign'), perm('edit'), perm('approve')],
})

const REVIEWER = role({
  id: 'r-reviewer',
  name: 'Department Reviewer',
  confidential: false,
  allowSelfReassign: false,
  permissions: [perm('approve', 'invoice', 'department', ['ap_review'])],
})

const CODER = role({
  id: 'r-coder',
  name: 'Department Coder',
  confidential: false,
  allowSelfReassign: false,
  permissions: [perm('code', 'invoice', 'department', ['to_be_coded'])],
})

const CONFIDENTIAL_REVIEWER = role({
  id: 'r-treasurer',
  name: 'Treasurer',
  confidential: true,
  allowSelfReassign: false,
  permissions: [perm('approve', 'invoice', 'all', ['ap_review'])],
})

const person = (id: string, name: string, r: ReassignRole | null): ReassignPerson => ({
  id,
  name,
  active: true,
  role: r,
  departmentId: null,
})

const admin = person('u-admin', 'Dana Admin', ADMIN)
const finance = person('u-fin', 'Frankie Finance', FINANCE)
const reviewerA = person('u-rev-a', 'Rita Reviewer', REVIEWER)
const reviewerB = person('u-rev-b', 'Rowan Reviewer', REVIEWER)
const coder = person('u-coder', 'Casey Coder', CODER)
const treasurer = person('u-treas', 'Tess Treasurer', CONFIDENTIAL_REVIEWER)

const invoice = (patch: Partial<ReassignInvoice> = {}): ReassignInvoice => ({
  id: 'i-1',
  invoiceNumber: 'INV-1001',
  stageSystemId: 'ap_review',
  stageLabel: 'AP Review',
  stageAllowsReassign: true,
  confidential: false,
  assignees: [{ id: reviewerA.id, name: reviewerA.name }],
  approvals: [],
  ...patch,
})

// ── Role capability derivation ──────────────────────────────────────────────

describe('role capabilities are derived from permission rows, not role names', () => {
  test('the settings permission is what makes an administrator', () => {
    expect(isAdministrator(ADMIN)).toBe(true)
    expect(isAdministrator(FINANCE)).toBe(false)
    expect(isAdministrator(null)).toBe(false)
  })

  test('administrators and org-wide assigners may move other people work', () => {
    expect(canReassignOthers(ADMIN)).toBe(true)
    expect(canReassignOthers(FINANCE)).toBe(true)
    expect(canReassignOthers(REVIEWER)).toBe(false)
    expect(canReassignOthers(CODER)).toBe(false)
  })

  test('bulk reassign is restricted to those same two classes of role', () => {
    expect(canRunBulkReassign(admin)).toBe(true)
    expect(canRunBulkReassign(finance)).toBe(true)
    expect(canRunBulkReassign(reviewerA)).toBe(false)
    expect(canRunBulkReassign(coder)).toBe(false)
  })

  test('a stage-scoped permission only acts at its own stage', () => {
    expect(actsAtStage(REVIEWER, 'ap_review')).toBe(true)
    expect(actsAtStage(REVIEWER, 'to_be_coded')).toBe(false)
    expect(actsAtStage(CODER, 'to_be_coded')).toBe(true)
    // An unscoped permission acts everywhere.
    expect(actsAtStage(FINANCE, 'treasurer_review')).toBe(true)
  })

  test('a read-only role is never treated as acting at a stage', () => {
    const viewer = role({ id: 'r-view', name: 'Auditor', permissions: [perm('view')] })
    expect(actsAtStage(viewer, 'ap_review')).toBe(false)
  })
})

// ── Required case: a stage with Reassign toggled off ────────────────────────

describe('a stage with the Reassign toggle off', () => {
  const locked = invoice({ stageAllowsReassign: false })

  test('hides the button for everyone, including administrators', () => {
    expect(canOfferReassign(admin, locked)).toBe(false)
    expect(canOfferReassign(finance, locked)).toBe(false)
    expect(canOfferReassign(reviewerA, locked)).toBe(false)
  })

  test('excludes the invoice from a bulk run and says why', () => {
    const plan = planBulkReassign({
      actor: admin,
      target: reviewerB,
      fromUserId: reviewerA.id,
      fromUserName: reviewerA.name,
      invoices: [locked],
    })
    expect(plan.moves).toHaveLength(0)
    expect(plan.skips).toHaveLength(1)
    expect(plan.skips[0].reason).toBe('Reassigning is switched off for the AP Review stage.')
  })

  test('the same invoice with the toggle on is offered and moved', () => {
    const open = invoice({ stageAllowsReassign: true })
    expect(canOfferReassign(reviewerA, open)).toBe(true)
    const plan = planBulkReassign({
      actor: admin,
      target: reviewerB,
      fromUserId: reviewerA.id,
      invoices: [open],
    })
    expect(plan.moves).toHaveLength(1)
  })
})

// ── Required case: confidential invoice, mixed picker ───────────────────────

describe('a confidential invoice', () => {
  const secret = invoice({ confidential: true, stageSystemId: 'ap_review' })
  const everyone = [reviewerA, reviewerB, treasurer, finance, coder]

  test('offers only people whose role carries the Confidential flag', () => {
    const result = listPickerPeople({ actor: admin, invoice: secret, people: everyone })
    expect(result.people.map((p) => p.name)).toEqual([treasurer.name])
  })

  test('the administrator show-all override still cannot reveal uncleared people', () => {
    const result = listPickerPeople({
      actor: admin,
      invoice: secret,
      people: everyone,
      showAll: true,
    })
    expect(result.overrideActive).toBe(true)
    expect(result.people.map((p) => p.name)).toEqual([treasurer.name])
  })

  test('the same picker on a non-confidential invoice lists the stage role holders', () => {
    const open = invoice({ confidential: false })
    const result = listPickerPeople({ actor: admin, invoice: open, people: everyone })
    expect(result.people.map((p) => p.name).sort()).toEqual(
      [reviewerA.name, reviewerB.name, treasurer.name, finance.name].sort(),
    )
  })

  test('an uncleared person is skipped on commit, not just hidden', () => {
    const plan = planBulkReassign({
      actor: admin,
      target: coder,
      fromUserId: reviewerA.id,
      invoices: [secret],
    })
    expect(plan.skips[0].reason).toBe('Casey Coder is not cleared to see confidential invoices.')
  })
})

// ── Required case: self-reassign without the role flag ──────────────────────

describe('reassigning to yourself', () => {
  test('is refused for a role without the flag', () => {
    const verdict = selfReassignVerdict(reviewerA, reviewerA.id)
    expect(verdict.allowed).toBe(false)
    expect(verdict.message).toContain('cannot take invoices over')
  })

  test('is permitted for a role that carries the flag', () => {
    expect(selfReassignVerdict(finance, finance.id).allowed).toBe(true)
    expect(selfReassignVerdict(admin, admin.id).allowed).toBe(true)
  })

  test('is irrelevant when the target is somebody else', () => {
    expect(selfReassignVerdict(reviewerA, reviewerB.id).allowed).toBe(true)
  })

  test('keeps a flagless actor out of their own picker', () => {
    const open = invoice({ assignees: [{ id: reviewerB.id, name: reviewerB.name }] })
    const result = listPickerPeople({
      actor: reviewerA,
      invoice: open,
      people: [reviewerA, reviewerB, treasurer],
    })
    expect(result.people.map((p) => p.id)).not.toContain(reviewerA.id)
  })

  test('blocks the whole batch when the actor targets themselves without the flag', () => {
    const open = invoice({ assignees: [{ id: reviewerB.id, name: reviewerB.name }] })
    const plan = planBulkReassign({
      actor: reviewerA,
      target: reviewerA,
      fromUserId: reviewerB.id,
      invoices: [open],
    })
    expect(plan.moves).toHaveLength(0)
    expect(plan.skips[0].reason).toContain('cannot take invoices over')
  })
})

// ── Required case: two pending slots ────────────────────────────────────────

describe('an invoice with two outstanding sign-offs', () => {
  const twoPending = invoice({
    approvals: [
      { userId: reviewerA.id, userName: reviewerA.name, status: 'pending' },
      { userId: treasurer.id, userName: treasurer.name, status: 'pending' },
    ],
    assignees: [
      { id: reviewerA.id, name: reviewerA.name },
      { id: treasurer.id, name: treasurer.name },
    ],
  })

  test('reports both slots so the modal can make the user pick one', () => {
    const slots = listOwnershipSlots(twoPending)
    expect(slots).toHaveLength(2)
    expect(slots.every((s) => s.kind === 'approval')).toBe(true)
    expect(slots.map((s) => s.userId)).toEqual([reviewerA.id, treasurer.id])
  })

  test('moves only the named slot and leaves the other alone', () => {
    const plan = planBulkReassign({
      actor: admin,
      target: reviewerB,
      fromUserId: reviewerA.id,
      invoices: [twoPending],
    })
    expect(plan.moves).toHaveLength(1)
    expect(plan.moves[0].slot).toEqual({
      kind: 'approval',
      index: 0,
      userId: reviewerA.id,
      userName: reviewerA.name,
    })
  })

  test('refuses to guess when no slot was named', () => {
    const plan = planBulkReassign({ actor: admin, target: reviewerB, fromUserId: null, invoices: [twoPending] })
    expect(plan.moves).toHaveLength(0)
    expect(plan.skips[0].reason).toContain('Several people are being waited on')
  })
})

// ── Required case: one approval given, one pending ──────────────────────────

describe('an invoice with one approval already given', () => {
  const partlyApproved = invoice({
    approvals: [
      { userId: reviewerA.id, userName: reviewerA.name, status: 'approved' },
      { userId: treasurer.id, userName: treasurer.name, status: 'pending' },
    ],
    assignees: [
      { id: reviewerA.id, name: reviewerA.name },
      { id: treasurer.id, name: treasurer.name },
    ],
  })

  test('offers the pending slot only — the given approval is not a slot', () => {
    const slots = listOwnershipSlots(partlyApproved)
    expect(slots).toHaveLength(1)
    expect(slots[0].userId).toBe(treasurer.id)
  })

  test('refuses to move the person who already approved', () => {
    const plan = planBulkReassign({
      actor: admin,
      target: reviewerB,
      fromUserId: reviewerA.id,
      fromUserName: reviewerA.name,
      invoices: [partlyApproved],
    })
    expect(plan.moves).toHaveLength(0)
    expect(plan.skips[0].reason).toBe('Nothing is waiting on Rita Reviewer for this invoice.')
  })

  test('with exactly one slot left, an unnamed slot resolves to it', () => {
    const plan = planBulkReassign({
      actor: admin,
      target: reviewerB,
      fromUserId: null,
      invoices: [partlyApproved],
    })
    expect(plan.moves).toHaveLength(1)
    expect(plan.moves[0].slot?.userId).toBe(treasurer.id)
  })
})

// ── Required case: a selection spanning three assignees ─────────────────────

describe('a bulk selection spanning three assignees', () => {
  const mine = invoice({ id: 'i-a', invoiceNumber: 'INV-A', assignees: [{ id: reviewerA.id, name: reviewerA.name }] })
  const yours = invoice({ id: 'i-b', invoiceNumber: 'INV-B', assignees: [{ id: treasurer.id, name: treasurer.name }] })
  const theirs = invoice({ id: 'i-c', invoiceNumber: 'INV-C', assignees: [{ id: finance.id, name: finance.name }] })

  test('groups the rows by whose slot is waiting, sorted by name', () => {
    const groups = groupByCurrentOwner([mine, yours, theirs])
    expect(groups).toHaveLength(3)
    expect(groups.map((g) => g.userName)).toEqual(['Frankie Finance', 'Rita Reviewer', 'Tess Treasurer'])
    expect(groups.map((g) => g.invoiceIds)).toEqual([['i-c'], ['i-a'], ['i-b']])
  })

  test('an invoice with two pending slots appears under both names', () => {
    const shared = invoice({
      id: 'i-d',
      invoiceNumber: 'INV-D',
      approvals: [
        { userId: reviewerA.id, userName: reviewerA.name, status: 'pending' },
        { userId: treasurer.id, userName: treasurer.name, status: 'pending' },
      ],
    })
    const groups = groupByCurrentOwner([shared])
    expect(groups.map((g) => g.userName)).toEqual(['Rita Reviewer', 'Tess Treasurer'])
    expect(groups.every((g) => g.invoiceIds.includes('i-d'))).toBe(true)
  })

  test('committing one group moves that group and skips the other two', () => {
    const plan = planBulkReassign({
      actor: admin,
      target: reviewerB,
      fromUserId: reviewerA.id,
      fromUserName: reviewerA.name,
      invoices: [mine, yours, theirs],
    })
    expect(plan.moves.map((m) => m.invoiceNumber)).toEqual(['INV-A'])
    expect(plan.skips.map((s) => s.invoiceNumber)).toEqual(['INV-B', 'INV-C'])
    for (const skip of plan.skips) {
      expect(skip.reason).toBe('Nothing is waiting on Rita Reviewer for this invoice.')
    }
  })

  test('partial failure still commits what works', () => {
    const locked = invoice({
      id: 'i-e',
      invoiceNumber: 'INV-E',
      stageAllowsReassign: false,
      assignees: [{ id: reviewerA.id, name: reviewerA.name }],
    })
    const plan = planBulkReassign({
      actor: admin,
      target: reviewerB,
      fromUserId: reviewerA.id,
      invoices: [mine, locked],
    })
    expect(plan.moves.map((m) => m.invoiceNumber)).toEqual(['INV-A'])
    expect(plan.skips.map((s) => s.invoiceNumber)).toEqual(['INV-E'])
    expect(plan.capExceeded).toBe(false)
  })
})

// ── Required case: over the 100 cap ─────────────────────────────────────────

describe('a bulk selection over the cap', () => {
  const many = (count: number) =>
    Array.from({ length: count }, (_, n) =>
      invoice({
        id: `i-${n}`,
        invoiceNumber: `INV-${n}`,
        assignees: [{ id: reviewerA.id, name: reviewerA.name }],
      }),
    )

  test('exactly at the cap is allowed', () => {
    const plan = planBulkReassign({
      actor: admin,
      target: reviewerB,
      fromUserId: reviewerA.id,
      invoices: many(BULK_REASSIGN_CAP),
    })
    expect(plan.capExceeded).toBe(false)
    expect(plan.moves).toHaveLength(BULK_REASSIGN_CAP)
  })

  test('one over the cap commits nothing and says so on every row', () => {
    const plan = planBulkReassign({
      actor: admin,
      target: reviewerB,
      fromUserId: reviewerA.id,
      invoices: many(BULK_REASSIGN_CAP + 1),
    })
    expect(plan.capExceeded).toBe(true)
    expect(plan.moves).toHaveLength(0)
    expect(plan.skips).toHaveLength(BULK_REASSIGN_CAP + 1)
    expect(plan.skips[0].reason).toBe(
      'Only 100 invoices can be reassigned at a time. 101 were selected.',
    )
  })
})

// ── Picker and button, ordinary cases ───────────────────────────────────────

describe('the single-invoice button and picker', () => {
  test('the current holder sees the button even without a reassign permission', () => {
    const open = invoice({ assignees: [{ id: reviewerA.id, name: reviewerA.name }] })
    expect(canOfferReassign(reviewerA, open)).toBe(true)
    expect(canOfferReassign(reviewerB, open)).toBe(false)
  })

  test('an uncleared person never sees a confidential invoice button', () => {
    const secret = invoice({ confidential: true, assignees: [{ id: reviewerA.id, name: reviewerA.name }] })
    expect(canOfferReassign(reviewerA, secret)).toBe(false)
    expect(canOfferReassign(treasurer, secret)).toBe(false)
    expect(canOfferReassign(admin, secret)).toBe(true)
  })

  test('the slot holder is left out of the picker', () => {
    const open = invoice()
    const result = listPickerPeople({
      actor: admin,
      invoice: open,
      people: [reviewerA, reviewerB],
      slotUserId: reviewerA.id,
    })
    expect(result.people.map((p) => p.id)).toEqual([reviewerB.id])
  })

  test('inactive people are never offered', () => {
    const retired: ReassignPerson = { ...reviewerB, active: false }
    const result = listPickerPeople({ actor: admin, invoice: invoice(), people: [retired] })
    expect(result.people).toHaveLength(0)
  })

  test('the override is offered to administrators only, and widens past the stage role', () => {
    const coding = invoice({ stageSystemId: 'to_be_coded', stageLabel: 'To Be Coded' })
    const narrow = listPickerPeople({ actor: admin, invoice: coding, people: [coder, reviewerB] })
    expect(narrow.overrideAvailable).toBe(true)
    expect(narrow.people.map((p) => p.id)).toEqual([coder.id])

    const wide = listPickerPeople({ actor: admin, invoice: coding, people: [coder, reviewerB], showAll: true })
    expect(wide.people.map((p) => p.id).sort()).toEqual([coder.id, reviewerB.id].sort())

    const forFinance = listPickerPeople({ actor: finance, invoice: coding, people: [coder, reviewerB], showAll: true })
    expect(forFinance.overrideAvailable).toBe(false)
    expect(forFinance.overrideActive).toBe(false)
    expect(forFinance.people.map((p) => p.id)).toEqual([coder.id])
  })

  test('an override pick is committed rather than skipped', () => {
    const coding = invoice({
      stageSystemId: 'to_be_coded',
      stageLabel: 'To Be Coded',
      assignees: [{ id: coder.id, name: coder.name }],
    })
    const byAdmin = planBulkReassign({ actor: admin, target: reviewerB, fromUserId: coder.id, invoices: [coding] })
    expect(byAdmin.moves).toHaveLength(1)

    const byFinance = planBulkReassign({ actor: finance, target: reviewerB, fromUserId: coder.id, invoices: [coding] })
    expect(byFinance.moves).toHaveLength(0)
    expect(byFinance.skips[0].reason).toBe(
      'Rowan Reviewer does not work on invoices at the To Be Coded stage.',
    )
  })

  test('moving a slot to the person already in it is refused', () => {
    const open = invoice({ assignees: [{ id: reviewerA.id, name: reviewerA.name }] })
    const plan = planBulkReassign({ actor: admin, target: reviewerA, fromUserId: reviewerA.id, invoices: [open] })
    expect(plan.skips[0].reason).toBe('Rita Reviewer already has this invoice.')
  })
})
