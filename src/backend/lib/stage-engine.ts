import type { Payload } from 'payload'
import { updateTag } from 'next/cache'
import { STAGE_ORDER, type StageId } from './stage-ids'

export type StageTransitionInput = {
  payload: Payload
  invoiceId: string | number
  actorId: string | number
  toStageSystemId: StageId
  reason?: string
  context?: Record<string, unknown>
}

export async function getStageBySystemId(payload: Payload, systemId: StageId) {
  const res = await payload.find({
    collection: 'stages',
    where: { systemId: { equals: systemId } },
    limit: 1,
  })
  return res.docs[0]
}

export async function recordAudit(args: {
  payload: Payload
  invoiceId: string | number
  actorId?: string | number
  action: string
  context?: Record<string, unknown>
}) {
  await args.payload.create({
    collection: 'audit-events',
    data: {
      invoice: args.invoiceId as never,
      actor: (args.actorId ?? null) as never,
      action: args.action as never,
      context: (args.context ?? null) as never,
    },
  })
  // Every audit-emitting action is a state mutation for the invoices domain.
  // Drop the cached counts / lists / dashboard data so the next read sees fresh
  // values. `updateTag` is Next.js 16's Server-Action-scoped primitive that
  // also gives read-your-own-writes semantics for the actor.
  updateTag('invoices')
}

export async function moveToStage(input: StageTransitionInput) {
  const { payload, invoiceId, actorId, toStageSystemId } = input
  const toStage = await getStageBySystemId(payload, toStageSystemId)
  if (!toStage) throw new Error(`Stage ${toStageSystemId} not found`)
  const invoice = await payload.findByID({ collection: 'invoices', id: invoiceId as never })
  const fromStageId = (invoice as { currentStage?: { id?: string | number } | string | number })
    .currentStage
  await payload.update({
    collection: 'invoices',
    id: invoiceId as never,
    data: { currentStage: toStage.id as never, approvals: [] as never },
  })
  await recordAudit({
    payload,
    invoiceId,
    actorId,
    action: 'updated',
    context: { fromStage: fromStageId, toStage: toStage.systemId, reason: input.reason, ...input.context },
  })
}

export function nextStageSystemId(current: StageId): StageId | null {
  const idx = STAGE_ORDER.indexOf(current)
  if (idx < 0 || idx >= STAGE_ORDER.length - 1) return null
  return STAGE_ORDER[idx + 1]
}

export function prevStageSystemIds(current: StageId): StageId[] {
  const idx = STAGE_ORDER.indexOf(current)
  if (idx <= 0) return []
  return STAGE_ORDER.slice(0, idx)
}
