'use client'

import { useMemo } from 'react'
import { DataTable } from '@/components/ui/data-table'
import type { ColumnFilterSpec, InvoiceColumn, SavedViewSpec } from '@/backend/lib/invoice-filters'
import { buildInvoiceColumns, STRUCTURAL_COLUMN_IDS } from './columns'
import type { ColumnFilterOption } from './column-filter'
import { InvoiceTableToolbar } from './toolbar'
import { BulkActionsBar } from './bulk-actions-bar'
import { InlineDetail } from './inline-detail'
import type { InvoiceRow } from './types'

export type { InvoiceRow, InvoiceLineRow } from './types'

// NOTE: We deliberately do NOT hover-prefetch invoice detail here.
// Each prefetch is a server action POST that takes 2-3s and competes for the
// Vercel Postgres connection pool. Passing the cursor over 8 rows burned ~24s
// of server work and blocked page-to-page navigation. SSR on click already
// fetches the data; an extra hover prefetch is redundant in this architecture.

/**
 * The All Requests table.
 *
 * It owns no data state of its own. Which columns are visible, in what order,
 * with which filters and sort, all come from `spec`; every change is handed
 * straight back up so it can be written into the URL and answered by the
 * server. That is what keeps the rows on screen, the tab counts and the CSV
 * export in agreement.
 */
export function InvoiceTable({
  rows,
  columns,
  spec,
  filterOptions,
  onSpecChange,
  isPending,
}: {
  rows: InvoiceRow[]
  columns: InvoiceColumn[]
  spec: SavedViewSpec
  filterOptions: Record<string, ColumnFilterOption[]>
  onSpecChange: (next: SavedViewSpec) => void
  isPending: boolean
}) {
  const filtersById = useMemo(() => {
    const map: Record<string, ColumnFilterSpec> = {}
    for (const filter of spec.filters) map[filter.columnId] = filter
    return map
  }, [spec.filters])

  function setFilter(columnId: string, next: ColumnFilterSpec | null) {
    const rest = spec.filters.filter((f) => f.columnId !== columnId)
    onSpecChange({ ...spec, filters: next ? [...rest, next] : rest })
  }

  const tableColumns = useMemo(
    () =>
      buildInvoiceColumns(
        { columns, filters: filtersById, filterOptions, onFilterChange: setFilter },
        spec.columnOrder,
      ),
    // `setFilter` closes over the current spec, which is already a dependency
    // through `filtersById` and `spec.columnOrder`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns, filtersById, filterOptions, spec.columnOrder],
  )

  const visibility = useMemo(() => {
    const state: Record<string, boolean> = {}
    for (const column of columns) state[column.id] = spec.columns.includes(column.id)
    return state
  }, [columns, spec.columns])

  const order = useMemo(
    () => ['select', 'expand', ...spec.columnOrder, 'actions'],
    [spec.columnOrder],
  )

  return (
    <DataTable<InvoiceRow>
      columns={tableColumns}
      data={rows}
      getRowId={(row) => String(row.id)}
      manualSorting
      sorting={spec.sort}
      onSortingChange={(next) => onSpecChange({ ...spec, sort: next })}
      columnVisibility={visibility}
      onColumnVisibilityChange={(next) =>
        onSpecChange({
          ...spec,
          columns: spec.columnOrder.filter((id) => next[id] !== false),
        })
      }
      columnOrder={order}
      onColumnOrderChange={(next) => {
        const columnOrder = next.filter((id) => !STRUCTURAL_COLUMN_IDS.includes(id))
        onSpecChange({
          ...spec,
          columnOrder,
          columns: columnOrder.filter((id) => spec.columns.includes(id)),
        })
      }}
      renderSubComponent={(row) => <InlineDetail row={row.original} />}
      emptyMessage="No invoices match the current filters."
      className={isPending ? 'opacity-60 transition-opacity' : 'transition-opacity'}
      renderToolbar={(table) => (
        <div className="space-y-2">
          <InvoiceTableToolbar
            table={table}
            columns={columns}
            spec={spec}
            onSpecChange={onSpecChange}
          />
          <BulkActionsBar
            rows={table.getSelectedRowModel().rows.map((r) => r.original)}
            onClearSelection={() => table.resetRowSelection()}
          />
        </div>
      )}
    />
  )
}
