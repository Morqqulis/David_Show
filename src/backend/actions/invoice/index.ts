// Barrel for all invoice-related server actions.
// Each file is `'use server'` so re-exporting here keeps imports tidy.
export { approveInvoice, rejectInvoice, verifyInvoice } from './transitions'
export {
  assignInvoice,
  fetchAssignContext,
  type AssignCandidate,
  type AssignContext,
} from './assign'
// Reassignment is not re-exported here. It is one engine covering both a single
// invoice and a batch, so it lives on its own at
// backend/actions/reassign-actions.ts rather than pretending to be a
// per-invoice action.
export { applyBatchNumber, closeBatch } from './batches'
export { saveLine, deleteLine, type CodingLineInput } from './coding'
export { updateInvoiceAmounts, type InvoiceAmounts } from './amounts'
export { postComment } from './comments'
export { setConfidential, setFlag, type InvoiceFlag } from './flags'
export { softDeleteInvoice, restoreInvoice, retryArchive } from './lifecycle'
