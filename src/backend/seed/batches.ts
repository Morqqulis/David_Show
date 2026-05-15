import type { Payload } from 'payload'
import type { Id } from './types'

export async function seedBatches(payload: Payload, users: Array<{ id: Id; email: string }>) {
  const marcus = users.find((u) => u.email === 'marcus.patel@aurora.ca')!.id
  const data = [
    { number: 'BATCH-2026-W19', createdBy: marcus, note: 'Weekly AP cycle' },
    { number: 'BATCH-2026-W20', createdBy: marcus, note: 'Weekly AP cycle' },
    { number: 'BATCH-2026-W21', createdBy: marcus, note: 'Weekly AP cycle — in progress' },
  ]
  return Promise.all(data.map((b) => payload.create({ collection: 'batches', data: b as never })))
}
