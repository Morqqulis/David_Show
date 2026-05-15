import type { Payload } from 'payload'

export async function seedDimensions(payload: Payload) {
  const data: Array<{ kind: string; code: string; description: string }> = [
    { kind: 'cost_center', code: 'CC-PW01', description: 'Roads & Sidewalks' },
    { kind: 'cost_center', code: 'CC-PW02', description: 'Fleet Operations' },
    { kind: 'cost_center', code: 'CC-IT01', description: 'Helpdesk' },
    { kind: 'cost_center', code: 'CC-IT02', description: 'Infrastructure' },
    { kind: 'cost_center', code: 'CC-PR01', description: 'Town Park' },
    { kind: 'cost_center', code: 'CC-PR02', description: 'Recreation Centre' },
    { kind: 'cost_center', code: 'CC-LIB01', description: 'Main Library Branch' },
    { kind: 'cost_center', code: 'CC-FIRE01', description: 'Station 1' },
    { kind: 'cost_center', code: 'CC-ADM01', description: 'Town Hall' },
    { kind: 'project', code: 'P-2026-001', description: 'Hwy 404 Salt Storage Upgrade' },
    { kind: 'project', code: 'P-2026-007', description: 'Library Annex Renovation' },
    { kind: 'project', code: 'P-2026-015', description: 'M365 E5 Rollout' },
    { kind: 'fund', code: 'F-GEN', description: 'General Fund' },
    { kind: 'fund', code: 'F-CAP', description: 'Capital Reserve Fund' },
    { kind: 'fund', code: 'F-WTR', description: 'Water Reserve Fund' },
  ]
  return Promise.all(data.map((d) => payload.create({ collection: 'dimensions', data: d as never })))
}
