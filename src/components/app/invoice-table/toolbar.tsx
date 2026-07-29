'use client'

import { useState } from 'react'
import type { Table } from '@tanstack/react-table'
import { ArrowUpDown, UserPlus, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTableViewOptions } from '@/components/ui/data-table/view-options'
import type { ColumnFilterSpec, InvoiceColumn, SavedViewSpec } from '@/backend/lib/invoice-filters'
import { useBulkReassignPermission } from '@/hooks/use-ap-queries'
import { BulkReassignDialog } from './bulk-reassign-dialog'
import type { InvoiceRow } from './types'

/**
 * In-table toolbar: a plain-language summary of what is currently narrowing
 * the list on the left, column controls on the right. The search box stays in
 * the sticky bar above the table — it searches invoice number, vendor and
 * batch at once, which is a different job from filtering one column.
 */
export function InvoiceTableToolbar({
  table,
  columns,
  spec,
  onSpecChange,
}: {
  table: Table<InvoiceRow>
  columns: InvoiceColumn[]
  spec: SavedViewSpec
  onSpecChange: (next: SavedViewSpec) => void
}) {
  // `table` is a stable reference but the state reads inside DataTableViewOptions
  // are reactive; React Compiler would otherwise skip re-running this component.
  'use no memo'
  const byId = new Map(columns.map((c) => [c.id, c]))
  const hasFilters = spec.filters.length > 0
  const hasSort = spec.sort.length > 0
  const [reassignOpen, setReassignOpen] = useState(false)
  const { data: permission } = useBulkReassignPermission()

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {spec.filters.map((filter) => {
          const column = byId.get(filter.columnId)
          if (!column) return null
          return (
            <Badge key={filter.columnId} variant="secondary" className="gap-1 font-normal">
              {describeFilter(column, filter)}
              <button
                onClick={() =>
                  onSpecChange({
                    ...spec,
                    filters: spec.filters.filter((f) => f.columnId !== filter.columnId),
                  })
                }
                aria-label={`Remove the ${column.label} filter`}
                className="rounded-full hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )
        })}
        {hasSort && !hasFilters ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowUpDown className="h-3 w-3" />
            Sorted by {byId.get(spec.sort[0].id)?.label ?? 'a column'}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {/*
          The primary way into bulk reassignment: start from the person who is
          away rather than from rows. Somebody covering for a colleague on leave
          knows the name, not which forty invoices are theirs.
        */}
        {permission?.allowed ? (
          <Button variant="outline" size="sm" onClick={() => setReassignOpen(true)} className="h-9">
            <UserPlus className="mr-1.5 h-3.5 w-3.5" />
            Reassign someone&rsquo;s work
          </Button>
        ) : null}
        {hasFilters || hasSort ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSpecChange({ ...spec, filters: [], sort: [] })}
            className="h-9"
          >
            Clear filters
            <X className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        ) : null}
        <DataTableViewOptions table={table} />
      </div>

      <BulkReassignDialog
        open={reassignOpen}
        onOpenChange={setReassignOpen}
        mode={{ kind: 'from-person' }}
      />
    </div>
  )
}

/** One filter, described the way a finance clerk would say it out loud. */
function describeFilter(column: InvoiceColumn, filter: ColumnFilterSpec): string {
  if (filter.from || filter.to) {
    if (filter.from && filter.to) return `${column.label}: ${filter.from} to ${filter.to}`
    if (filter.from) return `${column.label}: from ${filter.from}`
    return `${column.label}: up to ${filter.to}`
  }
  const values = filter.values ?? []
  if (values.length === 0) return column.label
  if (column.kind === 'text') return `${column.label} contains “${values[0]}”`
  if (values.length === 1) return `${column.label}: ${labelForValue(column, values[0])}`
  return `${column.label}: ${values.length} selected`
}

function labelForValue(column: InvoiceColumn, value: string): string {
  if (column.kind === 'boolean') return value === 'true' ? 'Yes' : 'No'
  return value
}
