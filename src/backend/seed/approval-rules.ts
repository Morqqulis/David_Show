import type { Payload } from 'payload'
import type { Id } from './types'

export async function seedApprovalRules(
  payload: Payload,
  roles: Array<{ id: Id; name: string }>,
  departments: Array<{ id: Id; code: string }>,
) {
  const conditional = roles.find((r) => r.name === 'Conditional Approver')!.id
  const apSup = roles.find((r) => r.name === 'AP Supervisor')!.id
  const itDept = departments.find((d) => d.code === 'IT')!.id

  const rules = [
    {
      name: 'Amount over $10,000',
      order: 1,
      enabled: true,
      conditions: { operator: 'and', conditions: [{ fieldKey: 'grandTotal', operator: 'greaterThan', value: 10000 }] },
      approvers: [{ type: 'role', role: apSup }],
      mode: 'parallel',
    },
    {
      name: 'IT spend over $5,000 → IT Head',
      order: 2,
      enabled: true,
      conditions: {
        operator: 'and',
        conditions: [
          { fieldKey: 'department', operator: 'equals', value: itDept },
          { fieldKey: 'grandTotal', operator: 'greaterThan', value: 5000 },
        ],
      },
      approvers: [{ type: 'department_head', department: itDept }],
      mode: 'parallel',
    },
    {
      name: 'Conditional Approver for $25k+',
      order: 3,
      enabled: true,
      conditions: { operator: 'and', conditions: [{ fieldKey: 'grandTotal', operator: 'greaterThanOrEqual', value: 25000 }] },
      approvers: [{ type: 'role', role: conditional }],
      mode: 'parallel',
    },
  ]
  return Promise.all(rules.map((r) => payload.create({ collection: 'approval-rules', data: r as never })))
}
