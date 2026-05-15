import type { Payload } from 'payload'

export async function seedSections(payload: Payload) {
  const data = [
    { name: 'Details', order: 1 },
    { name: 'Amounts', order: 2 },
    { name: 'Workflow', order: 3 },
    { name: 'Custom', order: 4 },
  ]
  return Promise.all(data.map((s) => payload.create({ collection: 'sections', data: s })))
}
