import type { Payload } from 'payload'
import type { Id } from './types'

export async function seedCodingRestrictions(
  payload: Payload,
  departments: Array<{ id: Id; code: string; name: string }>,
) {
  const restrictions = [
    { department: departments.find((d) => d.code === 'PW')!, value: 'PW' },
    { department: departments.find((d) => d.code === 'IT')!, value: 'IT' },
    { department: departments.find((d) => d.code === 'PR')!, value: 'PR' },
    { department: departments.find((d) => d.code === 'LIB')!, value: 'LIB' },
    { department: departments.find((d) => d.code === 'FIRE')!, value: 'FIRE' },
  ]
  for (const r of restrictions) {
    await payload.create({
      collection: 'coding-restrictions',
      data: {
        department: r.department.id as never,
        departmentLabel: r.department.name,
        rules: [{ segmentIndex: 3, operator: 'equals', value: r.value }] as never,
      },
    })
  }
}
