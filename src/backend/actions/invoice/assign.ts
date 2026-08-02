'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from '../../lib/payload'
import { getStageBySystemId, nextStageSystemId, recordAudit } from '../../lib/stage-engine'
import { actsAtStage } from '../../lib/reassign-eligibility'
import { guard, UserFacingError, type ActionResult } from '../../../lib/action-result'
import { fetchReassignContext } from '../reassign-actions'
import { defaultActorId } from './_helpers'

/**
 * Handing a newly arrived invoice to the person who will code it.
 *
 * To Be Assigned had no way to do this at all. The only forward action was
 * "Approve & advance", which pushed the invoice into the next queue owned by
 * nobody, and Reassign could not help: that engine *moves* an existing turn
 * from one person to another, and an invoice that has just arrived by email
 * has no turn to move — it refused every time with "Nobody is currently
 * holding this invoice."
 *
 * Assigning also advances. The stage exists for one purpose, to get the
 * invoice to somebody; an invoice that has been assigned but is still sitting
 * in To Be Assigned is neither unowned nor being worked on, and that state
 * would have to be explained to every clerk who met it. If a client ever wants
 * assign-without-advance, it is the `targetStage` line below.
 *
 * Reassignment remains the way to change hands afterwards, which is why this
 * takes no reason: a first assignment is routing, not a handover, and asking a
 * clerk to justify one on every invoice of the morning is friction for nothing.
 */

export type AssignCandidate = {
  id: string | number
  name: string
  roleName: string | null
}

export type AssignContext = {
  invoiceNumber: string
  /** Where the invoice goes once it is assigned, in the admin's own wording. */
  nextStageLabel: string
  /** True when the list was narrowed because the invoice is confidential. */
  confidentialFilterApplied: boolean
  candidates: AssignCandidate[]
}

export async function fetchAssignContext(invoiceId: string | number): Promise<AssignContext> {
  const context = await fetchReassignContext(invoiceId)
  const nextSys = nextStageSystemId(context.invoice.stageSystemId as never)
  const payload = await getPayload()
  const nextStage = nextSys ? await getStageBySystemId(payload, nextSys) : null

  // Filtered by the stage the invoice is going TO, not the one it is leaving.
  // The person picked here is the one who will do the next piece of work, and
  // a picker offering people who cannot act there strands the invoice in a
  // queue nobody watches.
  const candidates = context.people
    .filter((person) => person.active)
    .filter((person) => (nextSys ? actsAtStage(person.role, nextSys) : false))
    .filter((person) => !context.invoice.confidential || person.role?.confidential === true)
    .map((person) => ({ id: person.id, name: person.name, roleName: person.role?.name ?? null }))

  return {
    invoiceNumber: context.invoice.invoiceNumber,
    nextStageLabel: nextStage?.label ?? 'the next stage',
    confidentialFilterApplied: context.invoice.confidential,
    candidates,
  }
}

export async function assignInvoice(
  invoiceId: string | number,
  userId: string | number,
): Promise<ActionResult<void>> {
  return guard(() => runAssignInvoice(invoiceId, userId))
}

async function runAssignInvoice(invoiceId: string | number, userId: string | number): Promise<void> {
  const payload = await getPayload()
  const context = await fetchReassignContext(invoiceId)
  const currentSys = context.invoice.stageSystemId

  const target = context.people.find((p) => String(p.id) === String(userId)) ?? null
  if (!target) {
    throw new UserFacingError('That person is no longer in the directory. Pick somebody else.')
  }
  if (context.invoice.confidential && target.role?.confidential !== true) {
    throw new UserFacingError(`${target.name} is not cleared to see confidential invoices.`)
  }

  const nextSys = nextStageSystemId(currentSys as never)
  if (!nextSys) throw new Error(`No stage follows ${currentSys}`)

  // Re-checked here rather than trusted from the picker: a server action is a
  // public endpoint, and the same rule that shapes the list has to hold on the
  // way in.
  if (!actsAtStage(target.role, nextSys)) {
    throw new UserFacingError(
      `${target.name} does not work on invoices at the next stage. Pick somebody who does.`,
    )
  }

  const targetStage = await getStageBySystemId(payload, nextSys)
  if (!targetStage) throw new Error(`Target stage ${nextSys} not found`)

  await payload.update({
    collection: 'invoices',
    id: invoiceId as never,
    data: { assignees: [target.id] as never, currentStage: targetStage.id as never } as never,
  })

  await recordAudit({
    payload,
    invoiceId,
    actorId: await defaultActorId(),
    action: 'assigned',
    context: {
      assignedTo: target.id,
      assignedToName: target.name,
      fromStage: currentSys,
      toStage: nextSys,
    },
  })

  revalidatePath(`/requests/${invoiceId}`)
  revalidatePath('/requests')
  revalidatePath('/dashboard')
}
