'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/ui/data-table/column-header'
import { SimpleCrud } from './simple-crud'
import { upsertDepartment, deleteDepartment } from '@/backend/actions/settings-actions'

type DepartmentRow = { id: string | number; name: string; code: string }

function buildColumns(): ColumnDef<DepartmentRow>[] {
  return [
    {
      accessorKey: 'code',
      meta: { label: 'Code' },
      size: 140,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.code}</span>,
    },
    {
      accessorKey: 'name',
      meta: { label: 'Name' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
  ]
}

export function DepartmentsCrud({ rows }: { rows: DepartmentRow[] }) {
  const columns = useMemo(() => buildColumns(), [])
  return (
    <SimpleCrud<DepartmentRow>
      title="Department"
      rows={rows}
      columns={columns}
      fields={[
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Name' },
      ]}
      upsert={upsertDepartment}
      remove={deleteDepartment}
    />
  )
}
