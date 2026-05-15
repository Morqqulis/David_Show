'use client'

import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { ChevronRight, ExternalLink, Lock } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { DataTableColumnHeader } from '@/components/ui/data-table/column-header'
import { StageBadge } from '../stage-badge'
import { Money } from '../money'
import { formatDate } from '@/backend/lib/formatting'
import { STAGE_ORDER } from '@/backend/lib/stage-ids'
import { FlagsRow } from './flags-row'
import type { InvoiceRow } from './types'

// Sort by stage position in the workflow (not alphabetical on label) so the
// natural order in the UI is intake → completed.
const STAGE_POSITION = new Map(STAGE_ORDER.map((s, i) => [s, i]))

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

function invoiceNumberColumn(): ColumnDef<InvoiceRow> {
  return {
    accessorKey: 'invoiceNumber',
    meta: { label: 'Invoice' },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Invoice" />,
    cell: ({ row }) => (
      <div>
        <Link
          href={`/requests/${row.original.id}`}
          className="font-medium text-foreground hover:text-primary hover:underline"
        >
          {row.original.invoiceNumber}
        </Link>
        <FlagsRow row={row.original} />
      </div>
    ),
  }
}

function vendorColumn(): ColumnDef<InvoiceRow> {
  return {
    id: 'vendor',
    accessorFn: (row) => row.vendor?.name ?? '',
    meta: { label: 'Vendor' },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Vendor" />,
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5">
        {row.original.confidential ? <Lock className="h-3.5 w-3.5 text-amber-600" /> : null}
        <span>{row.original.vendor?.name ?? '—'}</span>
      </div>
    ),
  }
}

function stageColumn(): ColumnDef<InvoiceRow> {
  return {
    id: 'currentStage',
    accessorFn: (row) =>
      row.currentStage ? STAGE_POSITION.get(row.currentStage.systemId) ?? 99 : 99,
    meta: { label: 'Stage' },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Stage" />,
    cell: ({ row }) =>
      row.original.currentStage ? <StageBadge stage={row.original.currentStage as never} size="sm" /> : null,
  }
}

function departmentColumn(): ColumnDef<InvoiceRow> {
  return {
    id: 'departments',
    accessorFn: (row) => row.departments?.map((d) => d.code).join(', ') ?? '',
    meta: { label: 'Department' },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Department" />,
    cell: ({ row }) => row.original.departments?.map((d) => d.code).join(', ') ?? '—',
  }
}

function assigneeColumn(): ColumnDef<InvoiceRow> {
  return {
    id: 'assignees',
    accessorFn: (row) => row.assignees?.map((a) => a.name).join(', ') ?? '',
    meta: { label: 'Assignee' },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Assignee" />,
    cell: ({ row }) =>
      row.original.assignees && row.original.assignees.length > 0
        ? row.original.assignees.map((a) => a.name).join(', ')
        : '—',
  }
}

function batchColumn(): ColumnDef<InvoiceRow> {
  return {
    id: 'batch',
    accessorFn: (row) => row.batch?.number ?? '',
    meta: { label: 'Batch' },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Batch" />,
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.batch?.number ?? '—'}</span>,
  }
}

function invoiceDateColumn(): ColumnDef<InvoiceRow> {
  return {
    accessorKey: 'invoiceDate',
    meta: { label: 'Date' },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">{formatDate(row.original.invoiceDate)}</span>
    ),
  }
}

function dueDateColumn(): ColumnDef<InvoiceRow> {
  return {
    accessorKey: 'dueDate',
    meta: { label: 'Due' },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Due" />,
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">{formatDate(row.original.dueDate)}</span>
    ),
  }
}

function grandTotalColumn(): ColumnDef<InvoiceRow> {
  return {
    accessorKey: 'grandTotal',
    meta: { label: 'Amount' },
    header: ({ column }) => (
      <div className="text-right">
        <DataTableColumnHeader column={column} title="Amount" />
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-right font-medium">
        <Money value={row.original.grandTotal} />
      </div>
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

export function buildInvoiceColumns({ showStageColumn }: { showStageColumn: boolean }): ColumnDef<InvoiceRow>[] {
  return [
    selectColumn(),
    expandColumn(),
    invoiceNumberColumn(),
    vendorColumn(),
    ...(showStageColumn ? [stageColumn()] : []),
    departmentColumn(),
    assigneeColumn(),
    batchColumn(),
    invoiceDateColumn(),
    dueDateColumn(),
    grandTotalColumn(),
    actionsColumn(),
  ]
}
