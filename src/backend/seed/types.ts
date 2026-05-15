import type { StageId } from '../lib/stage-ids'

export type Id = string | number

export type SeededDoc<T = unknown> = T & { id: Id }

export type SeedCtx = {
  stages: Array<{ id: Id; systemId: string }>
  vendors: Array<{ id: Id; vendorNumber: string; name: string }>
  glAccounts: Array<{ id: Id; code: string }>
  taxCodes: Array<{ id: Id; code: string; rate: number; recoverablePct: number }>
  dimensions: Array<{ id: Id; kind: string; code: string }>
  users: Array<{ id: Id; email: string }>
  departments: Array<{ id: Id; code: string; name: string }>
  batches: Array<{ id: Id; number: string }>
}

export type InvoiceSeed = {
  invoiceNumber: string
  vendorIdx: number
  invoiceDate: string
  dueDate: string
  poNumber?: string
  stage: StageId
  departmentCodes: string[]
  assigneeEmails: string[]
  confidential?: boolean
  flags?: Partial<{
    noAttachment: boolean
    ocrFailed: boolean
    vendorSetupRequired: boolean
    possibleDuplicate: boolean
    archiveFailed: boolean
  }>
  priority?: 'Low' | 'Normal' | 'High' | 'Urgent'
  ocrConfidence?: number
  createdVia?: 'email' | 'manual'
  batchNumber?: string
  verified?: boolean
  lines: Array<{
    glCode: string
    costCenterCode?: string
    projectCode?: string
    fundCode?: string
    amount: number
    taxCode: string
    description?: string
  }>
  comments?: Array<{ authorEmail: string; body: string }>
}
