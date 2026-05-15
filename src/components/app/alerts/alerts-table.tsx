'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'
import { DataTableColumnHeader } from '@/components/ui/data-table/column-header'
import { Badge } from '@/components/ui/badge'
import { Money } from '../money'
import { RetryArchiveButton } from '../retry-archive-button'
import { formatDate } from '@/backend/lib/formatting'

export type AlertRow = {
  id: string | number
  invoiceNumber: string
  vendor?: { name: string }
  grandTotal: number
  updatedAt: string
  flags?: { archiveAttempts?: number }
}

function buildColumns(): ColumnDef<AlertRow>[] {
  return [
    {
      accessorKey: 'invoiceNumber',
      meta: { label: 'Invoice' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Invoice" />,
      cell: ({ row }) => (
        <Link
          href={`/requests/${row.original.id}`}
          className="font-medium hover:text-primary hover:underline"
        >
          {row.original.invoiceNumber}
        </Link>
      ),
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
      meta: { label: 'Last attempt' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Last attempt" />,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{formatDate(row.original.updatedAt)}</span>
      ),
    },
    {
      id: 'attempts',
      accessorFn: (row) => row.flags?.archiveAttempts ?? 0,
      meta: { label: 'Attempts' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Attempts" />,
      cell: ({ row }) => <Badge variant="secondary">{row.original.flags?.archiveAttempts ?? 0}</Badge>,
    },
    {
      id: 'actions',
      enableSorting: false,
      enableHiding: false,
      size: 120,
      header: () => null,
      cell: ({ row }) => <RetryArchiveButton id={row.original.id} />,
    },
  ]
}

export function AlertsTable({ rows }: { rows: AlertRow[] }) {
  const columns = useMemo(() => buildColumns(), [])
  return (
    <DataTable<AlertRow>
      columns={columns}
      data={rows}
      getRowId={(row) => String(row.id)}
      initialSorting={[{ id: 'attempts', desc: true }]}
      emptyMessage="No archive failures. Everything's synced."
    />
  )
}
