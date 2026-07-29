import type { Payload } from 'payload'
import type { Id } from './types'

export async function seedRoles(payload: Payload, stages: Array<{ id: Id; systemId: string }>) {
  const apReview = stages.find((s) => s.systemId === 'ap_review')!
  const data: Array<Parameters<Payload['create']>[0]['data']> = [
    {
      name: 'Admin',
      description: 'Full access — only role permitted to delete records and edit settings',
      confidential: true,
      bypassCodingRestrictions: true,
      // On for the finance-side roles, off everywhere else. Taking an invoice
      // off a colleague who is out of office is Finance's job; a department
      // coder helping themselves to one is not. Treasurer is deliberately left
      // at the default — the brief named Finance and Administrator only.
      allowSelfReassign: true,
      isSystem: true,
      permissions: [
        { action: 'view', object: 'invoice', scope: 'all' },
        { action: 'edit', object: 'invoice', scope: 'all' },
        { action: 'configure', object: 'settings', scope: 'all' },
        { action: 'delete', object: 'invoice', scope: 'all' },
      ],
    },
    {
      name: 'AP Clerk',
      description: 'View, edit, approve invoices across all stages',
      confidential: false,
      bypassCodingRestrictions: true,
      allowSelfReassign: true,
      isSystem: false,
      permissions: [
        { action: 'view', object: 'invoice', scope: 'all' },
        { action: 'edit', object: 'invoice', scope: 'all' },
        { action: 'approve', object: 'invoice', scope: 'all' },
        { action: 'assign', object: 'invoice', scope: 'all' },
        { action: 'export', object: 'invoice', scope: 'all' },
      ],
    },
    {
      name: 'AP Supervisor',
      description: 'AP Clerk + oversight + confidential access',
      confidential: true,
      bypassCodingRestrictions: true,
      allowSelfReassign: true,
      isSystem: false,
      permissions: [
        { action: 'view', object: 'invoice', scope: 'all' },
        { action: 'edit', object: 'invoice', scope: 'all' },
        { action: 'approve', object: 'invoice', scope: 'all' },
        { action: 'reject', object: 'invoice', scope: 'all' },
        { action: 'reassign', object: 'invoice', scope: 'all' },
      ],
    },
    {
      name: 'Department Reviewer',
      description: 'Code/approve invoices assigned to their department in Department Review',
      confidential: false,
      bypassCodingRestrictions: false,
      isSystem: false,
      permissions: [
        { action: 'view', object: 'invoice', scope: 'department', stages: [apReview.id] as never },
        { action: 'code', object: 'invoice', scope: 'department' },
        { action: 'approve', object: 'invoice', scope: 'department' },
      ],
    },
    {
      name: 'Conditional Approver',
      description: 'View + approve / reject invoices routed by rules',
      confidential: false,
      bypassCodingRestrictions: false,
      isSystem: false,
      permissions: [
        { action: 'view', object: 'invoice', scope: 'own' },
        { action: 'approve', object: 'invoice', scope: 'own' },
        { action: 'reject', object: 'invoice', scope: 'own' },
      ],
    },
    {
      name: 'Treasurer',
      description: 'View, verify, approve / reject across stages',
      confidential: true,
      bypassCodingRestrictions: true,
      isSystem: false,
      permissions: [
        { action: 'view', object: 'invoice', scope: 'all' },
        { action: 'verify', object: 'invoice', scope: 'all' },
        { action: 'reject', object: 'invoice', scope: 'all' },
        { action: 'approve', object: 'invoice', scope: 'all' },
      ],
    },
  ]
  return Promise.all(data.map((d) => payload.create({ collection: 'roles', data: d as never })))
}
