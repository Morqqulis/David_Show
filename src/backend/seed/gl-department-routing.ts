import type { Payload } from 'payload'
import type { Id } from './types'

type Department = { id: Id; code: string; name: string }

/**
 * Sub-department ranges for the demo chart of accounts.
 *
 * Written to exercise the cases the model exists for: Fire holds three rows
 * that are nowhere near each other, 1350 is a single value carved out of Parks
 * & Rec's range and given to the Library, and 2100/2600 are left off the list
 * on purpose so the "not mapped yet" panel in Settings has something in it.
 */
const RANGES: Array<{ code: string; from: string; to?: string; note?: string }> = [
  { code: 'PW', from: '1100', to: '1199' },
  { code: 'PW', from: '3100', to: '3199', note: 'Capital projects' },
  { code: 'IT', from: '1200', to: '1249' },
  { code: 'PR', from: '1300', to: '1399' },
  { code: 'LIB', from: '1350', note: 'Museum Programs — run by the Library' },
  { code: 'LIB', from: '1400', to: '1449' },
  { code: 'FIRE', from: '1500', to: '1514' },
  { code: 'FIRE', from: '1550', note: 'Volunteer program' },
  { code: 'FIRE', from: '4001', to: '4099', note: 'Outlying stations' },
  { code: 'ADM', from: '1900', to: '1999' },
  { code: 'AP', from: '9100', note: 'Control accounts' },
]

/** Who signs off on invoices coded to each department's accounts. */
const REVIEWERS: Record<string, string> = {
  PW: 'jordan.lee@aurora.ca',
  IT: 'priya.kumar@aurora.ca',
  PR: 'tomas.garcia@aurora.ca',
  LIB: 'aisha.mohamed@aurora.ca',
  FIRE: 'liam.oconnor@aurora.ca',
  AP: 'sarah.chen@aurora.ca',
  ADM: 'hannah.wright@aurora.ca',
}

export async function seedGlDepartmentRouting(payload: Payload, departments: Department[]) {
  const byCode = (code: string) => departments.find((d) => d.code === code)

  // Finance / AP is the catch-all: anything unmapped lands with the people who
  // maintain the chart of accounts, rather than becoming open to everyone.
  const catchAll = byCode('AP')
  if (!catchAll) {
    console.error('[seed] no Finance / AP department to use as the catch-all, skipping GL routing')
    return
  }

  await payload.create({
    collection: 'gl-format' as never,
    data: {
      mask: 'XX-XXXX-XXXX-XXXX',
      segmentLabels: [
        { label: 'Fund' },
        { label: 'Function' },
        { label: 'Sub-department' },
        { label: 'Object' },
      ],
      departmentSegment: 3,
      catchAllDepartment: catchAll.id,
    } as never,
  })

  for (const range of RANGES) {
    const department = byCode(range.code)
    if (!department) {
      console.error('[seed] no department for a sub-department range, skipping it', {
        departmentCode: range.code,
        from: range.from,
      })
      continue
    }
    await payload.create({
      collection: 'department-segment-map' as never,
      data: {
        department: department.id,
        fromValue: range.from,
        toValue: range.to ?? null,
        note: range.note ?? null,
      } as never,
    })
  }

  // Reviewers are set here rather than in the departments seed because the
  // users they point at do not exist until later in the seed order.
  for (const [code, email] of Object.entries(REVIEWERS)) {
    const department = byCode(code)
    if (!department) continue
    const user = await payload.find({
      collection: 'users',
      where: { email: { equals: email } } as never,
      limit: 1,
      depth: 0,
    })
    const reviewer = user.docs[0] as { id: Id } | undefined
    if (!reviewer) {
      console.error('[seed] no user to act as a department reviewer', { departmentCode: code, email })
      continue
    }
    await payload.update({
      collection: 'departments',
      id: department.id as never,
      data: { reviewer: reviewer.id } as never,
    })
  }
}
