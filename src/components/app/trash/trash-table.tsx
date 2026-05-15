'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'
import { DataTableColumnHeader } from '@/components/ui/data-table/column-header'
import { Money } from '../money'
import { RestoreButton } from '../restore-button'
import { formatDate } from '@/backend/lib/formatting'

export type TrashRow = {
  id: string | number
  invoiceNumber: string
  vendor?: { name: string }
  grandTotal: number
  deletedReason?: string
  updatedAt: string
}

function buildColumns(): ColumnDef<TrashRow>[] {
  return [
    {
      accessorKey: 'invoiceNumber',
      meta: { label: 'Invoice' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Invoice" />,
      cell: ({ row }) => <span className="font-medium">{row.original.invoiceNumber}</span>,
    },
    {
      id: 'vendor',
      accessorFn: (row) => row.vendor?.name ?? '',
      meta: { label: 'Vendor' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Vendor" />,
      cell: ({ row }) => row.original.vendor?.name ?? '—',
    },
    {
      accessorKey: 'grandTotal',
      meta: { label: 'Amount' },
      header: ({ column }) => (
        <div className="text-right">
          <DataTableColumnHeader column={column} title="Amount" />
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-right">
          <Money value={row.original.grandTotal} />
        </div>
      ),
    },
    {
      accessorKey: 'updatedAt',
      meta: { label: 'Deleted' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Deleted" />,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{formatDate(row.original.updatedAt)}</span>
      ),
    },
    {
      accessorKey: 'deletedReason',
      meta: { label: 'Reason' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Reason" />,
      cell: ({ row }) => <span className="text-xs">{row.original.deletedReason ?? '—'}</span>,
    },
    {
      id: 'actions',
      enableSorting: false,
      enableHiding: false,
      size: 120,
      header: () => null,
      cell: ({ row }) => <RestoreButton id={row.original.id} />,
    },
  ]
}

export function TrashTable({ rows }: { rows: TrashRow[] }) {
  const columns = useMemo(() => buildColumns(), [])
  return (
    <DataTable<TrashRow>
      columns={columns}
      data={rows}
      getRowId={(row) => String(row.id)}
      initialSorting={[{ id: 'updatedAt', desc: true }]}
      emptyMessage="Trash is empty."
    />
  )
}
