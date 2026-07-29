'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Lock } from 'lucide-react'
import { DataTable } from '@/components/ui/data-table'
import { DataTableColumnHeader } from '@/components/ui/data-table/column-header'
import { Badge } from '@/components/ui/badge'

export type RoleRow = {
  id: string | number
  name: string
  description?: string
  permissions?: Array<{ action: string; object: string; scope: string }>
  confidential?: boolean
  bypassCodingRestrictions?: boolean
  allowSelfReassign?: boolean
  isSystem?: boolean
}

function buildColumns(): ColumnDef<RoleRow>[] {
  return [
    {
      accessorKey: 'name',
      meta: { label: 'Role' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.original.name}</span>
          {row.original.isSystem ? <Lock className="h-3 w-3 text-muted-foreground" /> : null}
        </div>
      ),
    },
    {
      accessorKey: 'description',
      meta: { label: 'Description' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Description" />,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.description ?? '—'}</span>,
    },
    {
      id: 'permissions',
      accessorFn: (row) => row.permissions?.length ?? 0,
      meta: { label: 'Permissions' },
      header: ({ column }) => (
        <div className="text-right">
          <DataTableColumnHeader column={column} title="Permissions" />
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-right tabular-nums">{row.original.permissions?.length ?? 0}</div>
      ),
    },
    {
      accessorKey: 'confidential',
      meta: { label: 'Confidential' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Confidential" />,
      cell: ({ row }) =>
        row.original.confidential ? <Badge>yes</Badge> : <span className="text-muted-foreground">—</span>,
    },
    {
      accessorKey: 'bypassCodingRestrictions',
      meta: { label: 'Bypass coding' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Bypass coding" />,
      cell: ({ row }) =>
        row.original.bypassCodingRestrictions ? (
          <Badge>yes</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      // Shown beside the other two permission flags rather than on a screen of
      // its own: an administrator deciding who may take an invoice off a
      // colleague is making the same kind of decision as the two above it, and
      // a flag nobody can see is a flag nobody maintains.
      accessorKey: 'allowSelfReassign',
      meta: { label: 'Reassign to self' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Reassign to self" />,
      cell: ({ row }) =>
        row.original.allowSelfReassign ? (
          <Badge>yes</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ]
}

export function RolesTable({ rows }: { rows: RoleRow[] }) {
  const columns = useMemo(() => buildColumns(), [])
  return (
    <DataTable<RoleRow>
      columns={columns}
      data={rows}
      getRowId={(row) => String(row.id)}
      initialSorting={[{ id: 'name', desc: false }]}
      emptyMessage="No roles."
    />
  )
}
