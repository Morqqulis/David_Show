import type { StageId } from '@/backend/lib/stage-ids'

export type InvoiceLineRow = {
  id: string | number
  glAccount?: { code: string; description: string }
  costCenter?: { code: string; description: string }
  amount: number
  taxCode?: { code: string }
  taxAmount: number
  description?: string
}

export type InvoiceRow = {
  id: string | number
  invoiceNumber: string
  vendor?: { id?: string | number; name?: string }
  invoiceDate?: string
  dueDate?: string
  poNumber?: string
  fiscalYear?: string
  subtotal?: number
  totalTax?: number
  grandTotal: number
  currentStage?: { systemId: StageId; label?: string }
  departments?: Array<{ id: string | number; code: string; name: string }>
  assignees?: Array<{ id: string | number; name?: string }>
  batch?: { id: string | number; number: string }
  confidential?: boolean
  flags?: {
    noAttachment?: boolean
    ocrFailed?: boolean
    possibleDuplicate?: boolean
    archiveFailed?: boolean
    vendorSetupRequired?: boolean
    amountMismatch?: boolean
  }
  customFields?: Record<string, unknown>
  lines?: InvoiceLineRow[]
}
