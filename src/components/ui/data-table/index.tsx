'use client'

import {
  type ColumnDef,
  type ColumnFiltersState,
  type ExpandedState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type Row,
  type Table as RtTable,
} from '@tanstack/react-table'
import { Fragment, useMemo, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type DataTableProps<TData> = {
  columns: ColumnDef<TData, unknown>[]
  data: TData[]
  /** Stable row id selector — required for selection + expansion to survive re-renders. */
  getRowId?: (row: TData) => string
  /** Initial column visibility. */
  initialColumnVisibility?: VisibilityState
  /** Initial sorting. */
  initialSorting?: SortingState
  /** Optional sub-row renderer; when provided, expanded rows render this below them. */
  renderSubComponent?: (row: Row<TData>) => React.ReactNode
  /** Called when a row is hovered (use for prefetching detail data). */
  onRowMouseEnter?: (row: TData) => void
  /** Optional render-prop for toolbar above the table (search, view options, bulk actions). */
  renderToolbar?: (table: RtTable<TData>) => React.ReactNode
  /** Optional render-prop for content below the table (pagination, footer). */
  renderFooter?: (table: RtTable<TData>) => React.ReactNode
  /** Empty-state cell text. */
  emptyMessage?: string
  /** Outer className for the wrapper card. */
  className?: string
}

export function DataTable<TData>({
  columns,
  data,
  getRowId,
  initialColumnVisibility,
  initialSorting,
  renderSubComponent,
  onRowMouseEnter,
  renderToolbar,
  renderFooter,
  emptyMessage = 'No records.',
  className,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting ?? [])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    initialColumnVisibility ?? {},
  )
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [expanded, setExpanded] = useState<ExpandedState>({})

  const stableGetRowId = useMemo(() => getRowId, [getRowId])

  const table = useReactTable({
    data,
    columns,
    getRowId: stableGetRowId,
    state: { sorting, columnFilters, columnVisibility, rowSelection, expanded },
    enableRowSelection: true,
    enableExpanding: !!renderSubComponent,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => !!renderSubComponent,
  })

  const visibleColumnCount = table.getVisibleLeafColumns().length

  return (
    <div className={cn('rounded-lg border border-border bg-card', className)}>
      {renderToolbar ? <div className="border-b border-border p-3">{renderToolbar(table)}</div> : null}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/40 hover:bg-muted/40">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumnCount} className="h-32 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              // Inline row rendering — matches the canonical shadcn data-table
              // example. An earlier extraction into a `<RowGroup>` component
              // created a memoizable boundary: React Compiler (enabled in
              // next.config.ts) saw stable `row`+`isOpen` props and skipped
              // re-rendering on `rowSelection` changes, so per-row checkboxes
              // never reflected the live `row.getIsSelected()` value.
              table.getRowModel().rows.map((row) => (
                <Fragment key={row.id}>
                  <TableRow
                    data-state={row.getIsSelected() ? 'selected' : undefined}
                    onMouseEnter={onRowMouseEnter ? () => onRowMouseEnter(row.original) : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                  {row.getIsExpanded() && renderSubComponent ? (
                    <TableRow>
                      <TableCell colSpan={visibleColumnCount} className="bg-muted/20 px-6 py-4">
                        {renderSubComponent(row)}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {renderFooter ? <div className="border-t border-border p-3">{renderFooter(table)}</div> : null}
    </div>
  )
}
