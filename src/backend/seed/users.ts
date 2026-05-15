import type { Payload } from 'payload'
import type { Id } from './types'

export async function seedUsers(
  payload: Payload,
  roles: Array<{ id: Id; name: string }>,
  departments: Array<{ id: Id; code: string }>,
) {
  const r = (n: string) => roles.find((x) => x.name === n)!.id
  const d = (c: string) => departments.find((x) => x.code === c)!.id

  const data: Array<{ name: string; email: string; role: Id; department: Id; password: string }> = [
    { name: 'David Ayele', email: 'david@aurora.ca', role: r('Admin'), department: d('ADM'), password: 'demo1234' },
    { name: 'Sarah Chen', email: 'sarah.chen@aurora.ca', role: r('AP Supervisor'), department: d('AP'), password: 'demo1234' },
    { name: 'Marcus Patel', email: 'marcus.patel@aurora.ca', role: r('AP Clerk'), department: d('AP'), password: 'demo1234' },
    { name: 'Lena Brooks', email: 'lena.brooks@aurora.ca', role: r('AP Clerk'), department: d('AP'), password: 'demo1234' },
    { name: 'Jordan Lee', email: 'jordan.lee@aurora.ca', role: r('Department Reviewer'), department: d('PW'), password: 'demo1234' },
    { name: 'Priya Kumar', email: 'priya.kumar@aurora.ca', role: r('Department Reviewer'), department: d('IT'), password: 'demo1234' },
    { name: 'Tomás Garcia', email: 'tomas.garcia@aurora.ca', role: r('Department Reviewer'), department: d('PR'), password: 'demo1234' },
    { name: 'Aisha Mohamed', email: 'aisha.mohamed@aurora.ca', role: r('Department Reviewer'), department: d('LIB'), password: 'demo1234' },
    { name: "Liam O'Connor", email: 'liam.oconnor@aurora.ca', role: r('Department Reviewer'), department: d('FIRE'), password: 'demo1234' },
    { name: 'Hannah Wright', email: 'hannah.wright@aurora.ca', role: r('Conditional Approver'), department: d('ADM'), password: 'demo1234' },
    { name: 'Robert Klein', email: 'robert.klein@aurora.ca', role: r('Treasurer'), department: d('ADM'), password: 'demo1234' },
  ]

  // Upsert by email — Payload won't delete the logged-in admin, so re-runs collide on email otherwise.
  const out: Array<{ id: Id; email: string }> = []
  for (const u of data) {
    const existing = await payload.find({
      collection: 'users',
      where: { email: { equals: u.email } } as never,
      limit: 1,
      depth: 0,
    })
    if (existing.docs[0]) {
      const patch = { name: u.name, role: u.role, department: u.department }
      const updated = await payload.update({
        collection: 'users',
        id: (existing.docs[0] as { id: Id }).id as never,
        data: patch as never,
      })
      out.push(updated as never)
    } else {
      const created = await payload.create({ collection: 'users', data: u as never })
      out.push(created as never)
    }
  }
  return out
}
