'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'
import { DataTableColumnHeader } from '@/components/ui/data-table/column-header'
import { Badge } from '@/components/ui/badge'
import { initials } from '@/backend/lib/formatting'

export type UserRow = {
  id: string | number
  name?: string
  email?: string
  role?: { name?: string }
  department?: { name?: string }
  active?: boolean
}

function buildColumns(): ColumnDef<UserRow>[] {
  return [
    {
      id: 'avatar',
      enableSorting: false,
      enableHiding: false,
      size: 40,
      header: () => null,
      cell: ({ row }) => (
        <div className="grid h-7 w-7 place-items-center rounded-full bg-muted text-[10px] font-semibold uppercase">
          {initials(row.original.name)}
        </div>
      ),
    },
    {
      accessorKey: 'name',
      meta: { label: 'Name' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'email',
      meta: { label: 'Email' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.email}</span>,
    },
    {
      id: 'role',
      accessorFn: (row) => row.role?.name ?? '',
      meta: { label: 'Role' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
      cell: ({ row }) => <Badge variant="outline">{row.original.role?.name ?? '—'}</Badge>,
    },
    {
      id: 'department',
      accessorFn: (row) => row.department?.name ?? '',
      meta: { label: 'Department' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Department" />,
      cell: ({ row }) => row.original.department?.name ?? '—',
    },
    {
      id: 'status',
      accessorFn: (row) => (row.active === false ? 'inactive' : 'active'),
      meta: { label: 'Status' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) =>
        row.original.active === false ? <Badge variant="secondary">inactive</Badge> : <Badge>active</Badge>,
    },
  ]
}

export function UsersTable({ rows }: { rows: UserRow[] }) {
  const columns = useMemo(() => buildColumns(), [])
  return (
    <DataTable<UserRow>
      columns={columns}
      data={rows}
      getRowId={(row) => String(row.id)}
      initialSorting={[{ id: 'name', desc: false }]}
      emptyMessage="No users."
    />
  )
}
