'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from '../../lib/payload'
import { getStageBySystemId, nextStageSystemId, recordAudit } from '../../lib/stage-engine'
import { STAGE_ORDER, isAtOrPastCoding, type StageId } from '../../lib/stage-ids'
import { guard, UserFacingError, type ActionResult } from '../../../lib/action-result'
import { resolveReasonText } from '../reason-actions'
import { fetchCodingGate } from './coding'
import { defaultActorId, evaluateAnyApprovalRule } from './_helpers'

export type ApproveOptions = {
  comment?: string
  /**
   * Set when the user has seen and confirmed a Warn-level sum-match message.
   * The server refuses a warned approval without it, so a warning can never be
   * swallowed by a client that forgets to show it.
   */
  acknowledgedWarning?: boolean
}

/**
 * The gate's refusal is the whole point of the feature, so it travels back as a
 * returned message rather than a thrown one — see lib/action-result.ts. A
 * broken invariant below still throws, because nobody on screen can act on it.
 */
export async function approveInvoice(
  invoiceId: string | number,
  options?: ApproveOptions,
): Promise<ActionResult<void>> {
  return guard(() => runApproval(invoiceId, options))
}

async function runApproval(invoiceId: string | number, options?: ApproveOptions) {
  const payload = await getPayload()
  const invoice = (await payload.findByID({ collection: 'invoices', id: invoiceId as never, depth: 2 })) as {
    currentStage?: { systemId: StageId }
  }
  const currentSysId = invoice.currentStage?.systemId
  if (!currentSysId) throw new Error('Invoice has no current stage')

  const nextSys = nextStageSystemId(currentSysId)
  if (!nextSys) throw new Error('Already at terminal stage')

  const comment = options?.comment
  const actorId = await defaultActorId()

  // Sum-match gate (Settings → Coding Table). Server-side is the authoritative
  // check — the coding screen and the Approve button only mirror it.
  //
  // It runs on every forward transition from To Be Coded onwards, not only on
  // the exit from To Be Coded, because later stages can edit fields and break
  // coding that was previously complete.
  //
  // The test is the STAGE, deliberately not "does this invoice have lines".
  // Keying it on line count left a hole: deleting every line at a later stage
  // took the count to zero, which read as "nothing to check" and let a wholly
  // uncoded invoice approve straight through. An invoice that has reached the
  // coding stage owes a complete coding from then on, whatever its table
  // currently holds.
  //
  // Reject and Cancel deliberately bypass all of this — an invoice that cannot
  // be coded correctly still has to be able to go backwards.
  const gate = await fetchCodingGate(invoiceId)
  if (isAtOrPastCoding(currentSysId)) {
    if (gate.verdict.behaviour === 'block') {
      console.error('[coding-gate] approval blocked — invoice is not fully coded', {
        invoiceId,
        fromStage: currentSysId,
        reasons: gate.verdict.reasons,
        linesSum: gate.verdict.linesSum,
        target: gate.verdict.target,
      })
      throw new UserFacingError(gate.verdict.message ?? 'Invoice needs to be fully coded.')
    }
    if (gate.verdict.behaviour === 'warn') {
      if (!options?.acknowledgedWarning) {
        console.error('[coding-gate] warned approval arrived without an acknowledgement', {
          invoiceId,
          fromStage: currentSysId,
          reasons: gate.verdict.reasons,
        })
        throw new UserFacingError(
          `${gate.verdict.message ?? 'Invoice needs to be fully coded.'} Confirm the warning on screen to continue.`,
        )
      }
      await recordAudit({
        payload,
        invoiceId,
        actorId,
        action: 'updated',
        context: {
          event: 'sum_match_warning_acknowledged',
          reasons: gate.verdict.reasons,
          linesSum: gate.verdict.linesSum,
          target: gate.verdict.target,
        },
      })
    }
  }

  // Conditional approvals auto-skip when no rule matches (Section 6.5).
  let targetSys: StageId = nextSys
  if (nextSys === 'conditional_approvals') {
    const rulesRes = await payload.find({
      collection: 'approval-rules',
      where: { enabled: { equals: true } } as never,
      limit: 100,
    })
    const hasMatching = await evaluateAnyApprovalRule(rulesRes.docs as never, invoiceId)
    if (!hasMatching) targetSys = 'ap_review'
  }

  const targetStage = await getStageBySystemId(payload, targetSys)
  if (!targetStage) throw new Error(`Target stage ${targetSys} not found`)

  await payload.update({
    collection: 'invoices',
    id: invoiceId as never,
    data: { currentStage: targetStage.id as never, approvals: [] as never } as never,
  })
  await recordAudit({
    payload,
    invoiceId,
    actorId,
    action: 'approved',
    context: { fromStage: currentSysId, toStage: targetSys, comment },
  })
  revalidatePath(`/requests/${invoiceId}`)
  revalidatePath('/requests')
  revalidatePath('/dashboard')
}

/**
 * `reasonId` names a row in the admin-managed Reject reason list; `otherText`
 * carries the free-text line that the built-in Other option reveals. Whether a
 * reason is compulsory is a setting, enforced by `resolveReasonText` rather
 * than by the button being disabled.
 */
export async function rejectInvoice(
  invoiceId: string | number,
  toSystemId: StageId,
  reasonId: string | number | null,
  otherText?: string,
): Promise<ActionResult<void>> {
  return guard(() => runRejection(invoiceId, toSystemId, reasonId, otherText))
}

async function runRejection(
  invoiceId: string | number,
  toSystemId: StageId,
  reasonId: string | number | null,
  otherText?: string,
) {
  const reason = await resolveReasonText('reject', reasonId, otherText)
  const payload = await getPayload()
  const invoice = (await payload.findByID({ collection: 'invoices', id: invoiceId as never, depth: 2 })) as {
    currentStage?: { systemId: StageId }
  }
  const currentSysId = invoice.currentStage?.systemId
  const idx = STAGE_ORDER.indexOf(toSystemId)
  if (idx < 0) throw new Error('Invalid target stage')
  if (currentSysId && STAGE_ORDER.indexOf(currentSysId) <= idx) throw new Error('Reject target must be earlier')

  const targetStage = await getStageBySystemId(payload, toSystemId)
  if (!targetStage) throw new Error('Target stage not found')

  await payload.update({
    collection: 'invoices',
    id: invoiceId as never,
    data: { currentStage: targetStage.id as never, approvals: [] as never, batch: null as never } as never,
  })
  const actorId = await defaultActorId()
  await recordAudit({
    payload,
    invoiceId,
    actorId,
    action: 'rejected',
    context: { fromStage: currentSysId, toStage: toSystemId, reason },
  })
  revalidatePath(`/requests/${invoiceId}`)
  revalidatePath('/requests')
}

// `reassignInvoice` used to live here. It overwrote the whole assignee and
// department list — moving every outstanding sign-off at once, with no reason
// attached — and no screen ever called it. Reassignment is now one engine,
// `reassignInvoices` in backend/actions/reassign-actions.ts, which moves a
// single pending slot and which the single-invoice modal calls with a batch of
// one. There is no per-invoice variant to keep the two in step.

export async function verifyInvoice(invoiceId: string | number, verified: boolean) {
  const payload = await getPayload()
  const actorId = await defaultActorId()
  await payload.update({
    collection: 'invoices',
    id: invoiceId as never,
    data: {
      verified,
      verifiedAt: verified ? new Date().toISOString() : null,
      verifiedBy: verified ? (actorId as never) : null,
    } as never,
  })
  await recordAudit({ payload, invoiceId, actorId, action: verified ? 'verified' : 'unverified' })
  revalidatePath(`/requests/${invoiceId}`)
}
