import { describe, expect, test } from 'bun:test'
import {
  BUILT_IN_INVOICE_FIELDS,
  DEFAULT_CONFIDENCE_THRESHOLD,
  DEFAULT_FIELD_MAPPING,
  PREBUILT_INVOICE_SOURCE_FIELDS,
  applyFieldMapping,
  type OcrResult,
} from './intake-field-mapping'

function ocr(fields: Record<string, { value: string; confidence: number }>): OcrResult {
  return { fields, pages: 1 }
}

const SAMPLE = ocr({
  InvoiceId: { value: 'INV-77100', confidence: 0.97 },
  VendorName: { value: 'BlueRock Construction Inc.', confidence: 0.93 },
  InvoiceDate: { value: '2026-05-08', confidence: 0.88 },
  DueDate: { value: '2026-06-07', confidence: 0.55 },
  SubTotal: { value: '4302.65', confidence: 0.91 },
  TotalTax: { value: '558.35', confidence: 0.9 },
  InvoiceTotal: { value: '4861.00', confidence: 0.96 },
  PurchaseOrder: { value: '', confidence: 0.99 },
})

describe('applyFieldMapping', () => {
  test('fills mapped fields that clear the threshold', () => {
    const result = applyFieldMapping(SAMPLE, DEFAULT_FIELD_MAPPING, DEFAULT_CONFIDENCE_THRESHOLD)
    expect(result.values.invoiceNumber).toBe('INV-77100')
    expect(result.values.vendorName).toBe('BlueRock Construction Inc.')
    expect(result.values.subtotal).toBe('4302.65')
    expect(result.confidences.invoiceNumber).toBe(0.97)
  })

  test('a field below the threshold is left blank rather than guessed', () => {
    const result = applyFieldMapping(SAMPLE, DEFAULT_FIELD_MAPPING, DEFAULT_CONFIDENCE_THRESHOLD)
    expect(result.values.dueDate).toBeUndefined()
    expect(result.belowThreshold).toContain('dueDate')
  })

  test('the threshold is inclusive at its own value', () => {
    const borderline = ocr({ InvoiceId: { value: 'INV-1', confidence: 0.8 } })
    const mapping = [{ appField: 'invoiceNumber', sourceField: 'InvoiceId', enabled: true }]
    expect(applyFieldMapping(borderline, mapping, 0.8).values.invoiceNumber).toBe('INV-1')
    expect(applyFieldMapping(borderline, mapping, 0.81).values.invoiceNumber).toBeUndefined()
  })

  test('raising the threshold blanks more fields', () => {
    const strict = applyFieldMapping(SAMPLE, DEFAULT_FIELD_MAPPING, 0.95)
    expect(strict.values.invoiceNumber).toBe('INV-77100')
    expect(strict.values.vendorName).toBeUndefined()
    expect(strict.belowThreshold).toContain('vendorName')
  })

  test('a low-confidence reading is kept as a suggestion, not thrown away', () => {
    const strict = applyFieldMapping(SAMPLE, DEFAULT_FIELD_MAPPING, 0.95)
    // The field itself stays empty — that is the whole point of the threshold.
    expect(strict.values.vendorName).toBeUndefined()
    // But what was read survives, so a person can confirm it instead of
    // retyping it off a document the app has already read.
    expect(strict.suggestions.vendorName?.value).toBe('BlueRock Construction Inc.')
    expect(strict.suggestions.vendorName?.confidence).toBeLessThan(0.95)
  })

  test('a field that clears the bar carries no suggestion', () => {
    const result = applyFieldMapping(SAMPLE, DEFAULT_FIELD_MAPPING, DEFAULT_CONFIDENCE_THRESHOLD)
    expect(result.values.invoiceNumber).toBe('INV-77100')
    expect(result.suggestions.invoiceNumber).toBeUndefined()
  })

  test('a later confident row clears the suggestion an earlier unsure one left', () => {
    const reading = ocr({
      Weak: { value: 'guessed', confidence: 0.2 },
      Strong: { value: 'certain', confidence: 0.99 },
    })
    const mapping = [
      { appField: 'poNumber', sourceField: 'Weak', enabled: true },
      { appField: 'poNumber', sourceField: 'Strong', enabled: true },
    ]
    const result = applyFieldMapping(reading, mapping, 0.8)
    expect(result.values.poNumber).toBe('certain')
    expect(result.suggestions.poNumber).toBeUndefined()
    expect(result.belowThreshold).toHaveLength(0)
  })

  test('the best of several unsure readings is the one offered', () => {
    const reading = ocr({
      Worse: { value: 'blurry', confidence: 0.2 },
      Better: { value: 'legible', confidence: 0.6 },
    })
    const mapping = [
      { appField: 'poNumber', sourceField: 'Worse', enabled: true },
      { appField: 'poNumber', sourceField: 'Better', enabled: true },
    ]
    const result = applyFieldMapping(reading, mapping, 0.8)
    expect(result.suggestions.poNumber?.value).toBe('legible')
  })

  test('a disabled row is ignored entirely', () => {
    const mapping = [{ appField: 'invoiceNumber', sourceField: 'InvoiceId', enabled: false }]
    const result = applyFieldMapping(SAMPLE, mapping, DEFAULT_CONFIDENCE_THRESHOLD)
    expect(result.values.invoiceNumber).toBeUndefined()
    expect(result.belowThreshold).toHaveLength(0)
    expect(result.notFound).toHaveLength(0)
  })

  test('a source field the model did not return is reported as not found, not as low confidence', () => {
    const mapping = [{ appField: 'poNumber', sourceField: 'CustomerId', enabled: true }]
    const result = applyFieldMapping(SAMPLE, mapping, DEFAULT_CONFIDENCE_THRESHOLD)
    expect(result.notFound).toEqual(['poNumber'])
    expect(result.belowThreshold).toHaveLength(0)
  })

  test('an empty extracted value is treated as nothing found', () => {
    const mapping = [{ appField: 'poNumber', sourceField: 'PurchaseOrder', enabled: true }]
    const result = applyFieldMapping(SAMPLE, mapping, DEFAULT_CONFIDENCE_THRESHOLD)
    expect(result.values.poNumber).toBeUndefined()
    expect(result.notFound).toEqual(['poNumber'])
  })

  test('whitespace around an extracted value is trimmed', () => {
    const padded = ocr({ InvoiceId: { value: '  INV-9  ', confidence: 0.99 } })
    const mapping = [{ appField: 'invoiceNumber', sourceField: 'InvoiceId', enabled: true }]
    expect(applyFieldMapping(padded, mapping, 0.8).values.invoiceNumber).toBe('INV-9')
  })

  test('a failed extraction with no fields at all yields nothing and throws nothing', () => {
    const result = applyFieldMapping(ocr({}), DEFAULT_FIELD_MAPPING, DEFAULT_CONFIDENCE_THRESHOLD)
    expect(Object.keys(result.values)).toHaveLength(0)
    expect(result.notFound.length).toBe(DEFAULT_FIELD_MAPPING.filter((m) => m.enabled).length)
  })

  test('the last enabled row wins when two rows target the same app field', () => {
    const mapping = [
      { appField: 'invoiceNumber', sourceField: 'CustomerId', enabled: true },
      { appField: 'invoiceNumber', sourceField: 'InvoiceId', enabled: true },
    ]
    expect(applyFieldMapping(SAMPLE, mapping, 0.8).values.invoiceNumber).toBe('INV-77100')
  })
})

describe('the pickers offered in Settings', () => {
  test('every default mapping points at a source field the picker offers', () => {
    const offered = new Set(PREBUILT_INVOICE_SOURCE_FIELDS.map((f) => f.name))
    for (const row of DEFAULT_FIELD_MAPPING) expect(offered.has(row.sourceField)).toBe(true)
  })

  test('every default mapping points at an app field that exists', () => {
    const known = new Set(BUILT_IN_INVOICE_FIELDS.map((f) => f.key))
    for (const row of DEFAULT_FIELD_MAPPING) expect(known.has(row.appField)).toBe(true)
  })

  test('every offered source field is described in plain language', () => {
    for (const field of PREBUILT_INVOICE_SOURCE_FIELDS) {
      expect(field.label.length).toBeGreaterThan(2)
      expect(field.label).not.toBe(field.name)
    }
  })

  test('no line-item field is offered, because coders enter GL and amount themselves', () => {
    expect(PREBUILT_INVOICE_SOURCE_FIELDS.some((f) => f.name === 'Items')).toBe(false)
  })

  test('the default threshold is the 80% the client asked for', () => {
    expect(DEFAULT_CONFIDENCE_THRESHOLD).toBe(0.8)
  })
})
