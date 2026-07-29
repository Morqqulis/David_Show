import { describe, expect, test } from 'bun:test'
import {
  BUILTIN_INVOICE_COLUMNS,
  buildInvoiceSort,
  compileInvoiceFilters,
  resolveInvoiceColumns,
  sanitizeJsonFilterValue,
  type InvoiceColumn,
} from './invoice-filters'

const columns: InvoiceColumn[] = resolveInvoiceColumns([
  { fieldKey: 'priority', label: 'Priority', scope: 'header', type: 'choice', showAsColumn: true, options: [{ value: 'High' }, { value: 'Low' }] },
  { fieldKey: 'heritageNote', label: 'Heritage Note', scope: 'header', type: 'text', showAsColumn: true },
  { fieldKey: 'ignoredLineField', label: 'GL Account', scope: 'line', type: 'lookup', showAsColumn: true },
])

describe('compileInvoiceFilters', () => {
  test('an empty filter list produces no clauses', () => {
    expect(compileInvoiceFilters([], columns)).toEqual([])
    expect(compileInvoiceFilters(undefined, columns)).toEqual([])
  })

  test('a single text filter compiles to a contains match', () => {
    expect(compileInvoiceFilters([{ columnId: 'invoiceNumber', values: ['ACME-1'] }], columns)).toEqual([
      { or: [{ invoiceNumber: { like: 'ACME-1' } }] },
    ])
  })

  test('several values on one column are OR-ed together', () => {
    expect(
      compileInvoiceFilters([{ columnId: 'departments', values: ['PW', 'PARKS'] }], columns),
    ).toEqual([
      { or: [{ 'departments.code': { equals: 'PW' } }, { 'departments.code': { equals: 'PARKS' } }] },
    ])
  })

  test('two columns are AND-ed as separate clauses', () => {
    const clauses = compileInvoiceFilters(
      [
        { columnId: 'departments', values: ['PW'] },
        { columnId: 'vendor', values: ['Acme'] },
      ],
      columns,
    )
    expect(clauses).toEqual([
      { or: [{ 'departments.code': { equals: 'PW' } }] },
      { or: [{ 'vendor.name': { like: 'Acme' } }] },
    ])
  })

  test('a date range widens plain dates to cover both whole days', () => {
    expect(
      compileInvoiceFilters([{ columnId: 'invoiceDate', from: '2026-01-01', to: '2026-01-31' }], columns),
    ).toEqual([
      {
        and: [
          { invoiceDate: { greater_than_equal: '2026-01-01T00:00:00.000Z' } },
          { invoiceDate: { less_than_equal: '2026-01-31T23:59:59.999Z' } },
        ],
      },
    ])
  })

  test('a one-sided date range emits only the bound that was given', () => {
    expect(compileInvoiceFilters([{ columnId: 'dueDate', from: '2026-03-05' }], columns)).toEqual([
      { dueDate: { greater_than_equal: '2026-03-05T00:00:00.000Z' } },
    ])
  })

  test('a number range compiles to numeric bounds', () => {
    expect(compileInvoiceFilters([{ columnId: 'grandTotal', from: '100', to: '2500.5' }], columns)).toEqual([
      { and: [{ grandTotal: { greater_than_equal: 100 } }, { grandTotal: { less_than_equal: 2500.5 } }] },
    ])
  })

  test('an unknown column id is ignored rather than throwing', () => {
    expect(() => compileInvoiceFilters([{ columnId: 'deletedField', values: ['x'] }], columns)).not.toThrow()
    expect(compileInvoiceFilters([{ columnId: 'deletedField', values: ['x'] }], columns)).toEqual([])
  })

  test('an empty or blank value list yields no clause', () => {
    expect(compileInvoiceFilters([{ columnId: 'invoiceNumber', values: ['  ', ''] }], columns)).toEqual([])
    expect(compileInvoiceFilters([{ columnId: 'invoiceDate', from: '', to: '' }], columns)).toEqual([])
  })

  test('a boolean column matches on the parsed flag', () => {
    expect(compileInvoiceFilters([{ columnId: 'confidential', values: ['true'] }], columns)).toEqual([
      { or: [{ confidential: { equals: true } }] },
    ])
  })

  test('a custom field filters against its customFields path', () => {
    expect(compileInvoiceFilters([{ columnId: 'priority', values: ['High', 'Low'] }], columns)).toEqual([
      {
        or: [
          { 'customFields.priority': { equals: 'High' } },
          { 'customFields.priority': { equals: 'Low' } },
        ],
      },
    ])
  })

  test('custom-field values are stripped of characters the database rejects', () => {
    expect(compileInvoiceFilters([{ columnId: 'heritageNote', values: ["O'Brien, Ltd"] }], columns)).toEqual([
      { or: [{ 'customFields.heritageNote': { like: 'OBrien Ltd' } }] },
    ])
  })

  test('duplicate values within a column collapse to one condition', () => {
    expect(compileInvoiceFilters([{ columnId: 'departments', values: ['PW', 'PW'] }], columns)).toEqual([
      { or: [{ 'departments.code': { equals: 'PW' } }] },
    ])
  })

  test('numeric relationship ids are coerced for assignee filters', () => {
    expect(compileInvoiceFilters([{ columnId: 'assignees', values: ['12'] }], columns)).toEqual([
      { or: [{ assignees: { equals: 12 } }] },
    ])
  })
})

describe('resolveInvoiceColumns', () => {
  test('offers every built-in column plus each flagged custom field', () => {
    const ids = columns.map((c) => c.id)
    for (const builtin of BUILTIN_INVOICE_COLUMNS) expect(ids).toContain(builtin.id)
    expect(ids).toContain('priority')
    expect(ids).toContain('heritageNote')
  })

  test('ignores line-scope fields — they are not invoice columns', () => {
    expect(columns.map((c) => c.id)).not.toContain('ignoredLineField')
  })

  test('a custom field with the column toggle off is not offered', () => {
    const resolved = resolveInvoiceColumns([
      { fieldKey: 'notAColumn', label: 'Not A Column', scope: 'header', type: 'text', showAsColumn: false },
    ])
    expect(resolved.map((c) => c.id)).not.toContain('notAColumn')
  })

  test('an administrator label rename overrides the built-in caption', () => {
    const resolved = resolveInvoiceColumns([
      { fieldKey: 'grandTotal', label: 'Invoice Total', scope: 'header', type: 'currency', showAsColumn: true },
    ])
    expect(resolved.find((c) => c.id === 'grandTotal')?.label).toBe('Invoice Total')
  })

  test('custom date and number fields fall back to text matching', () => {
    const resolved = resolveInvoiceColumns([
      { fieldKey: 'approvedOn', label: 'Approved On', scope: 'header', type: 'date', showAsColumn: true },
    ])
    expect(resolved.find((c) => c.id === 'approvedOn')?.kind).toBe('text')
  })
})

describe('buildInvoiceSort', () => {
  test('falls back to newest-first when the view has no sort', () => {
    expect(buildInvoiceSort([], columns)).toEqual(['-updatedAt'])
  })

  test('maps column ids to their database sort keys', () => {
    expect(buildInvoiceSort([{ id: 'grandTotal', desc: true }, { id: 'invoiceNumber', desc: false }], columns)).toEqual([
      '-grandTotal',
      'invoiceNumber',
    ])
  })

  test('drops columns that cannot be ordered in SQL', () => {
    expect(buildInvoiceSort([{ id: 'priority', desc: false }], columns)).toEqual(['-updatedAt'])
  })
})

describe('sanitizeJsonFilterValue', () => {
  test('keeps the characters the database allows', () => {
    expect(sanitizeJsonFilterValue('AP-2026_01 name@city.ca')).toBe('AP-2026_01 name@city.ca')
  })
})
