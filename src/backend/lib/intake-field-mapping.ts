/**
 * Where each value the OCR reads is put in this municipality's field schema.
 *
 * A mapping table rather than a list of on/off switches: the field schema is
 * configured per client, so the extraction model has no way of knowing where a
 * value belongs. Each row names one app field, one source field the prebuilt
 * model produces, and whether the row is on.
 *
 * Prebuilt model fields only. Pointing the extraction at a client-specific
 * field the model has never seen would mean keyword-anchored extraction or a
 * trained custom model, and neither is in scope.
 */

export type OcrField = { value: string; confidence: number }
export type OcrResult = { fields: Record<string, OcrField>; pages: number }

/** The extraction service, behind an interface, so the pipeline tests offline. */
export interface InvoiceOcr {
  extract(file: { buffer: Buffer; contentType: string }): Promise<OcrResult>
}

export type OcrFieldMapping = {
  /** Key of the app field the value lands in. */
  appField: string
  /** Name of the prebuilt-model field the value is read from. */
  sourceField: string
  enabled: boolean
}

/** Below this, a field is left blank rather than filled with a bad guess. */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.8

/**
 * The fixed picker of source fields, header-level only.
 *
 * The model also returns line items. They are deliberately absent: coders enter
 * the GL account and amount for each line themselves, so an extracted line
 * would be overwritten every time.
 */
export const PREBUILT_INVOICE_SOURCE_FIELDS: ReadonlyArray<{ name: string; label: string }> = [
  { name: 'InvoiceId', label: 'Invoice number printed on the document' },
  { name: 'VendorName', label: 'Name of the company that issued the invoice' },
  { name: 'VendorAddress', label: 'Address of the company that issued the invoice' },
  { name: 'VendorTaxId', label: 'Tax registration number of the issuing company' },
  { name: 'CustomerName', label: 'Name the invoice is billed to' },
  { name: 'CustomerId', label: 'Customer account number on the invoice' },
  { name: 'InvoiceDate', label: 'Date printed on the invoice' },
  { name: 'DueDate', label: 'Date the invoice must be paid by' },
  { name: 'PurchaseOrder', label: 'Purchase order number quoted on the invoice' },
  { name: 'SubTotal', label: 'Amount before taxes' },
  { name: 'TotalTax', label: 'Total tax amount' },
  { name: 'InvoiceTotal', label: 'Invoice total including taxes' },
  { name: 'AmountDue', label: 'Amount still owing' },
  { name: 'PreviousUnpaidBalance', label: 'Balance carried over from earlier invoices' },
  { name: 'ServiceStartDate', label: 'First day of the period being billed' },
  { name: 'ServiceEndDate', label: 'Last day of the period being billed' },
  { name: 'PaymentTerm', label: 'Payment terms written on the invoice' },
]

/**
 * The invoice header fields that ship with the app. A client's own custom
 * header fields are added to this list at runtime from Settings → Fields.
 */
export const BUILT_IN_INVOICE_FIELDS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'invoiceNumber', label: 'Invoice #' },
  { key: 'vendorName', label: 'Vendor' },
  { key: 'invoiceDate', label: 'Invoice date' },
  { key: 'dueDate', label: 'Due date' },
  { key: 'poNumber', label: 'PO #' },
  { key: 'subtotal', label: 'Amount before taxes' },
  { key: 'totalTax', label: 'Total tax amount' },
  { key: 'grandTotal', label: 'Invoice total' },
]

/** What a fresh database uses until an admin edits the table. */
export const DEFAULT_FIELD_MAPPING: OcrFieldMapping[] = [
  { appField: 'invoiceNumber', sourceField: 'InvoiceId', enabled: true },
  { appField: 'vendorName', sourceField: 'VendorName', enabled: true },
  { appField: 'invoiceDate', sourceField: 'InvoiceDate', enabled: true },
  { appField: 'dueDate', sourceField: 'DueDate', enabled: true },
  { appField: 'poNumber', sourceField: 'PurchaseOrder', enabled: true },
  { appField: 'subtotal', sourceField: 'SubTotal', enabled: true },
  { appField: 'totalTax', sourceField: 'TotalTax', enabled: true },
  { appField: 'grandTotal', sourceField: 'InvoiceTotal', enabled: true },
]

export type MappedExtraction = {
  /** App field key to extracted text, for every field that cleared the bar. */
  values: Record<string, string>
  /** Confidence behind each filled value, for the audit record. */
  confidences: Record<string, number>
  /** App fields left blank because the reading was not confident enough. */
  belowThreshold: string[]
  /**
   * What was actually read for each of those fields, kept rather than thrown
   * away.
   *
   * The threshold exists so an unsure reading never becomes a stored fact, and
   * that stays true — none of this reaches the invoice's own fields. But
   * discarding the reading entirely was a second, unasked-for decision: it left
   * a clerk retyping a vendor name off a document the app had already read,
   * with no sign it had tried. Offered as a suggestion beside the empty field
   * instead, for a person to accept or overrule.
   */
  suggestions: Record<string, { value: string; confidence: number }>
  /** App fields left blank because the model returned nothing for them. */
  notFound: string[]
}

export function applyFieldMapping(
  ocr: OcrResult,
  mapping: OcrFieldMapping[],
  threshold: number,
): MappedExtraction {
  const result: MappedExtraction = {
    values: {},
    confidences: {},
    belowThreshold: [],
    suggestions: {},
    notFound: [],
  }

  for (const row of mapping) {
    if (!row.enabled) continue

    const source = ocr.fields[row.sourceField]
    const value = source?.value?.trim() ?? ''
    if (!source || value === '') {
      record(result.notFound, row.appField)
      continue
    }
    if (source.confidence < threshold) {
      record(result.belowThreshold, row.appField)
      // Keep the best of several unsure readings for the same field, so a
      // second mapping row cannot replace a good suggestion with a worse one.
      const held = result.suggestions[row.appField]
      if (!held || source.confidence > held.confidence) {
        result.suggestions[row.appField] = { value, confidence: source.confidence }
      }
      continue
    }

    result.values[row.appField] = value
    result.confidences[row.appField] = source.confidence
    // A later row that succeeds supersedes an earlier one that did not — and
    // takes the suggestion with it, since the field is no longer blank.
    remove(result.belowThreshold, row.appField)
    delete result.suggestions[row.appField]
    remove(result.notFound, row.appField)
  }

  return result
}

function record(list: string[], field: string) {
  if (!list.includes(field)) list.push(field)
}

function remove(list: string[], field: string) {
  const index = list.indexOf(field)
  if (index >= 0) list.splice(index, 1)
}
