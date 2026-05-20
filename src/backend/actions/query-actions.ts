'use server'

import {
  getInvoiceWithLines,
  getStageCounts,
  getAlertsCount,
  getStageDefinitions,
  type StageDefinition,
} from '../lib/queries'
import { getPayload } from '../lib/payload'
import type { StageId } from '../lib/stage-ids'

export type QueueCountsPayload = {
  counts: Record<StageId | 'all', number>
  alerts: number
  stages: StageDefinition[]
}

export async function fetchQueueCounts(): Promise<QueueCountsPayload> {
  const [counts, alerts, stages] = await Promise.all([
    getStageCounts(),
    getAlertsCount(),
    getStageDefinitions(),
  ])
  return { counts, alerts, stages }
}

export type LookupRow = { id: string | number; code?: string; description?: string; label?: string }

export type LookupsPayload = {
  glAccounts: Array<{ id: string | number; code: string; description: string }>
  taxCodes: Array<{ id: string | number; code: string; label: string; rate: number; recoverablePct: number }>
  costCenters: Array<{ id: string | number; code: string; description: string }>
  projects: Array<{ id: string | number; code: string; description: string }>
  funds: Array<{ id: string | number; code: string; description: string }>
  vendors: Array<{ id: string | number; vendorNumber: string; name: string }>
}

export async function fetchLookups(): Promise<LookupsPayload> {
  const payload = await getPayload()
  const [gls, taxCodes, costCenters, projects, funds, vendors] = await Promise.all([
    payload.find({ collection: 'gl-accounts', limit: 500, depth: 0, sort: 'code' }),
    payload.find({ collection: 'tax-codes', limit: 100, depth: 0, sort: 'code' }),
    payload.find({ collection: 'dimensions', where: { kind: { equals: 'cost_center' } } as never, limit: 500, depth: 0, sort: 'code' }),
    payload.find({ collection: 'dimensions', where: { kind: { equals: 'project' } } as never, limit: 500, depth: 0, sort: 'code' }),
    payload.find({ collection: 'dimensions', where: { kind: { equals: 'fund' } } as never, limit: 500, depth: 0, sort: 'code' }),
    payload.find({ collection: 'vendors', limit: 500, depth: 0, sort: 'name' }),
  ])
  return {
    glAccounts: gls.docs as never,
    taxCodes: taxCodes.docs as never,
    costCenters: costCenters.docs as never,
    projects: projects.docs as never,
    funds: funds.docs as never,
    vendors: vendors.docs as never,
  }
}

export async function fetchInvoice(id: string | number) {
  const data = await getInvoiceWithLines(id)
  if (!data || !data.invoice) return null
  return data
}
