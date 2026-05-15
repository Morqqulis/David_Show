import type { PreviewDocument } from '../pdf-preview'
import type { StageId } from '@/backend/lib/stage-ids'

export type GL = { id: string | number; code: string; description: string }
export type Tax = { id: string | number; code: string; rate: number; recoverablePct: number }
export type Dim = { id: string | number; code: string; description: string }

export type CodingLine = {
  id: string | number | null
  glAccount?: { id: string | number; code: string; description: string } | null
  costCenter?: { id: string | number; code: string; description: string } | null
  project?: { id: string | number; code: string; description: string } | null
  fund?: { id: string | number; code: string; description: string } | null
  amount: number
  taxCode?: { id: string | number; code: string; rate?: number; recoverablePct?: number } | null
  taxAmount: number
  recoverable: number
  nonRecoverable: number
  description?: string | null
  _dirty?: boolean
  _localId?: string
}

export type CodingScreenInvoice = {
  id: string | number
  invoiceNumber: string
  vendor?: { name: string }
  subtotal: number
  totalTax: number
  grandTotal: number
  currentStage?: { systemId: StageId; label?: string }
}

export type CodingOptions = {
  gls: GL[]
  taxCodes: Tax[]
  costCenters: Dim[]
  projects: Dim[]
  funds: Dim[]
}

export type { PreviewDocument }
