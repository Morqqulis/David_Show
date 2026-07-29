import type { Payload } from 'payload'
import type { Id } from './types'

type FieldSeed = {
  fieldKey: string
  label: string
  scope: 'header' | 'line'
  section?: Id
  type: string
  width?: string
  isSystem: boolean
  removable?: boolean
  showAsColumn?: boolean
  mandatoryAtStages?: Id[]
  options?: Array<{ value: string }>
  lookupEntity?: string
  order: number
}

export async function seedFields(
  payload: Payload,
  sections: Array<{ id: Id; name: string }>,
  stages: Array<{ id: Id; systemId: string }>,
) {
  const sec = (n: string) => sections.find((s) => s.name === n)!.id
  const stg = (s: string) => stages.find((x) => x.systemId === s)!.id

  const seeds: FieldSeed[] = [
    { fieldKey: 'invoiceNumber', label: 'Invoice Number', scope: 'header', section: sec('Details'), type: 'text', width: 'half', isSystem: true, removable: false, showAsColumn: true, mandatoryAtStages: [stg('ap_review')], order: 1 },
    { fieldKey: 'vendor', label: 'Vendor', scope: 'header', section: sec('Details'), type: 'lookup', lookupEntity: 'vendors', width: 'half', isSystem: true, removable: false, showAsColumn: true, mandatoryAtStages: [stg('ap_review')], order: 2 },
    { fieldKey: 'invoiceDate', label: 'Invoice Date', scope: 'header', section: sec('Details'), type: 'date', width: 'third', isSystem: true, removable: false, showAsColumn: true, mandatoryAtStages: [stg('ap_review')], order: 3 },
    { fieldKey: 'dueDate', label: 'Due Date', scope: 'header', section: sec('Details'), type: 'date', width: 'third', isSystem: true, removable: false, order: 4 },
    { fieldKey: 'fiscalYear', label: 'Fiscal Year', scope: 'header', section: sec('Details'), type: 'text', width: 'third', isSystem: true, removable: false, order: 5 },
    { fieldKey: 'poNumber', label: 'PO Number', scope: 'header', section: sec('Details'), type: 'text', width: 'half', isSystem: true, removable: false, order: 6 },
    { fieldKey: 'subtotal', label: 'Subtotal', scope: 'header', section: sec('Amounts'), type: 'currency', width: 'third', isSystem: true, removable: false, showAsColumn: false, mandatoryAtStages: [stg('ap_review')], order: 7 },
    { fieldKey: 'totalTax', label: 'Total Tax', scope: 'header', section: sec('Amounts'), type: 'currency', width: 'third', isSystem: true, removable: false, order: 8 },
    { fieldKey: 'grandTotal', label: 'Grand Total', scope: 'header', section: sec('Amounts'), type: 'currency', width: 'third', isSystem: true, removable: false, showAsColumn: true, mandatoryAtStages: [stg('ap_review')], order: 9 },
    { fieldKey: 'confidential', label: 'Confidential', scope: 'header', section: sec('Workflow'), type: 'yesno', width: 'half', isSystem: false, removable: true, order: 10 },
    { fieldKey: 'projectCode', label: 'Project Code', scope: 'header', section: sec('Custom'), type: 'choice', width: 'half', isSystem: false, removable: true, options: [{ value: 'P-2026-001' }, { value: 'P-2026-007' }, { value: 'P-2026-015' }], order: 11 },
    { fieldKey: 'priority', label: 'Priority', scope: 'header', section: sec('Custom'), type: 'choice', width: 'half', isSystem: false, removable: true, options: [{ value: 'Low' }, { value: 'Normal' }, { value: 'High' }, { value: 'Urgent' }], showAsColumn: true, order: 12 },
    { fieldKey: 'glAccount', label: 'GL Account', scope: 'line', type: 'lookup', lookupEntity: 'gl-accounts', isSystem: true, removable: false, order: 1 },
    { fieldKey: 'costCenter', label: 'Cost Center', scope: 'line', type: 'lookup', lookupEntity: 'cost_center', isSystem: false, removable: true, order: 2 },
    { fieldKey: 'project', label: 'Project', scope: 'line', type: 'lookup', lookupEntity: 'project', isSystem: false, removable: true, order: 3 },
    { fieldKey: 'fund', label: 'Fund', scope: 'line', type: 'lookup', lookupEntity: 'fund', isSystem: false, removable: true, order: 4 },
    { fieldKey: 'amount', label: 'Amount', scope: 'line', type: 'currency', isSystem: true, removable: false, order: 5 },
    { fieldKey: 'taxCode', label: 'Tax Code', scope: 'line', type: 'lookup', lookupEntity: 'tax-codes', isSystem: true, removable: false, order: 6 },
  ]
  return Promise.all(seeds.map((f) => payload.create({ collection: 'fields', data: f as never })))
}
