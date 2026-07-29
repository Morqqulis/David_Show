'use client'

import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { ChevronRight, ExternalLink } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { DataTableColumnHeader } from '@/components/ui/data-table/column-header'
import type { ColumnFilterSpec, InvoiceColumn } from '@/backend/lib/invoice-filters'
import { CELL_RENDERERS, NUMERIC_COLUMN_IDS, renderCustomValue } from './cell-renderers'
import { ColumnFilterControl, type ColumnFilterOption } from './column-filter'
import type { InvoiceRow } from './types'

/** Structural columns the user never hides and the view spec never records. */
export const STRUCTURAL_COLUMN_IDS = ['select', 'expand', 'actions']

export type InvoiceColumnsConfig = {
  /** Every column the screen may show, already resolved from Settings → Fields. */
  columns: InvoiceColumn[]
  /** Current filter per column id. */
  filters: Record<string, ColumnFilterSpec>
  /** Choice lists for tick-list filters, keyed by column id. */
  filterOptions: Record<string, ColumnFilterOption[]>
  onFilterChange: (columnId: string, next: ColumnFilterSpec | null) => void
}

function selectColumn(): ColumnDef<InvoiceRow> {
  return {
    id: 'select',
    enableSorting: false,
    enableHiding: false,
    size: 32,
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
  }
}

function expandColumn(): ColumnDef<InvoiceRow> {
  return {
    id: 'expand',
    enableSorting: false,
    enableHiding: false,
    size: 32,
    header: () => null,
    cell: ({ row }) => (
      <button
        onClick={row.getToggleExpandedHandler()}
        className="grid h-6 w-6 place-items-center rounded hover:bg-muted"
        aria-label={row.getIsExpanded() ? 'Collapse' : 'Expand'}
      >
        <ChevronRight
          className={cn('h-3.5 w-3.5 transition-transform', row.getIsExpanded() && 'rotate-90')}
        />
      </button>
    ),
  }
}

function actionsColumn(): ColumnDef<InvoiceRow> {
  return {
    id: 'actions',
    enableSorting: false,
    enableHiding: false,
    size: 48,
    header: () => null,
    cell: ({ row }) => (
      <Link
        href={`/requests/${row.original.id}`}
        className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Open"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    ),
  }
}

function dataColumn(spec: InvoiceColumn, config: InvoiceColumnsConfig): ColumnDef<InvoiceRow> {
  const render = CELL_RENDERERS[spec.id]
  const numeric = NUMERIC_COLUMN_IDS.has(spec.id)
  return {
    id: spec.id,
    meta: { label: spec.label },
    // Sorting and filtering both happen in the database against the whole
    // result set, so the table itself must not re-order or re-filter the page
    // it was handed.
    enableSorting: !!spec.sortKey,
    enableHiding: true,
    header: ({ column }) => (
      <div className={cn('flex items-center gap-0.5', numeric && 'justify-end')}>
        <DataTableColumnHeader column={column} title={spec.label} />
        <ColumnFilterControl
          column={spec}
          value={config.filters[spec.id]}
          options={config.filterOptions[spec.id] ?? []}
          onChange={(next) => config.onFilterChange(spec.id, next)}
        />
      </div>
    ),
    cell: ({ row }) => (render ? render(row.original) : renderCustomValue(row.original, spec.id)),
  }
}

/**
 * Build the table's columns from the resolved column registry.
 *
 * Order follows `columnOrder` so a saved view restores the arrangement its
 * author left behind; the structural select/expand/actions columns always
 * bracket the data columns.
 */
export function buildInvoiceColumns(
  config: InvoiceColumnsConfig,
  columnOrder: string[],
): ColumnDef<InvoiceRow>[] {
  const byId = new Map(config.columns.map((c) => [c.id, c]))
  const ordered = columnOrder
    .map((id) => byId.get(id))
    .filter((c): c is InvoiceColumn => c !== undefined)
  return [
    selectColumn(),
    expandColumn(),
    ...ordered.map((spec) => dataColumn(spec, config)),
    actionsColumn(),
  ]
}
