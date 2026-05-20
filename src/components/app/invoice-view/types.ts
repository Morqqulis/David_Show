import type { PreviewDocument } from '../pdf-preview'
import type { StageId } from '@/backend/lib/stage-ids'

export type InvoiceViewInvoice = {
  id: string | number
  invoiceNumber: string
  poNumber?: string
  invoiceDate?: string
  dueDate?: string
  fiscalYear?: string
  subtotal: number
  totalTax: number
  grandTotal: number
  confidential?: boolean
  verified?: boolean
  currentStage?: { systemId: StageId; label?: string }
  vendor?: {
    id: string | number
    name: string
    vendorNumber?: string
    city?: string
    province?: string
  }
  departments?: Array<{ id: string | number; code: string; name: string }>
  assignees?: Array<{ id: string | number; name?: string; email?: string }>
  batch?: { id: string | number; number: string }
  customFields?: Record<string, unknown>
  flags?: Record<string, unknown>
}

export type InvoiceViewLine = {
  id: string | number
  glAccount?: { code: string; description: string }
  costCenter?: { code: string; description: string }
  amount: number
  taxCode?: { code: string }
  taxAmount: number
  recoverable: number
  nonRecoverable: number
  description?: string
}

export type InvoiceViewComment = {
  id: string | number
  body: string
  createdAt: string
  author?: { name?: string }
}

export type InvoiceViewAuditEvent = {
  id: string | number
  action: string
  createdAt: string
  actor?: { name?: string }
  context?: Record<string, unknown>
}

export type InvoiceViewDocument = PreviewDocument & {
  uploadedBy?: { name?: string }
  createdAt?: string
}

export type InvoiceViewData = {
  invoice: InvoiceViewInvoice
  lines: InvoiceViewLine[]
  comments: InvoiceViewComment[]
  audit: InvoiceViewAuditEvent[]
  documents?: InvoiceViewDocument[]
  // 'coding' is intentionally excluded — that tab is a separate page
  // (/coding), and the invoice page redirects ?tab=coding before this prop is
  // ever populated.
  defaultTab?: 'header' | 'files' | 'notes' | 'log'
}
