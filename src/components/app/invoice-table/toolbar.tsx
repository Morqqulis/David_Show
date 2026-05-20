'use client'

import type { Table } from '@tanstack/react-table'
import { ArrowUpDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTableViewOptions } from '@/components/ui/data-table/view-options'
import type { InvoiceRow } from './types'

/**
 * In-table toolbar: View options on the right; Reset appears only when a sort
 * is applied. We intentionally do NOT duplicate the search input here — the
 * sticky filter bar above the table owns server-side search across all pages,
 * which is more useful than client-side filter on the current 25-row page.
 */
export function InvoiceTableToolbar({ table }: { table: Table<InvoiceRow> }) {
  // Same React Compiler caveat as DataTableViewOptions — `table` is stable but
  // the state reads (`sorting`, `columnFilters`) are reactive.
  'use no memo'
  const isSorted = table.getState().sorting.length > 0
  const isFiltered = table.getState().columnFilters.length > 0
  const hasActiveState = isSorted || isFiltered

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="text-xs text-muted-foreground">
        {isSorted ? (
          <span className="inline-flex items-center gap-1">
            <ArrowUpDown className="h-3 w-3" />
            Custom sort applied
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {hasActiveState ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              table.resetSorting()
              table.resetColumnFilters()
            }}
            className="h-9"
          >
            Reset
            <X className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        ) : null}
        <DataTableViewOptions table={table} />
      </div>
    </div>
  )
}
