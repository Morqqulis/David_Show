'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'
import { DataTableColumnHeader } from '@/components/ui/data-table/column-header'
import { Badge } from '@/components/ui/badge'

export type RestrictionRow = {
  id: string | number
  department?: { name: string; code: string }
  rules?: Array<{
    segmentIndex: number
    operator: string
    value?: string
    listValues?: Array<{ value: string }>
  }>
}

function buildColumns(): ColumnDef<RestrictionRow>[] {
  return [
    {
      id: 'department',
      accessorFn: (row) => row.department?.name ?? '',
      meta: { label: 'Department' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Department" />,
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.department ? `${row.original.department.name} (${row.original.department.code})` : '—'}
        </span>
      ),
    },
    {
      id: 'rules',
      enableSorting: false,
      meta: { label: 'Rules' },
      header: () => <span className="text-xs uppercase tracking-wide text-muted-foreground">Rules</span>,
      cell: ({ row }) => (
        <div className="space-y-1 text-xs">
          {(row.original.rules ?? []).map((rule, i) => (
            <div key={i} className="font-mono">
              Segment {rule.segmentIndex}{' '}
              <Badge variant="outline" className="mx-1 text-[10px]">
                {rule.operator}
              </Badge>
              {rule.operator === 'in'
                ? `{ ${(rule.listValues ?? []).map((v) => v.value).join(', ')} }`
                : rule.value}
            </div>
          ))}
        </div>
      ),
    },
  ]
}

export function CodingRestrictionsTable({ rows }: { rows: RestrictionRow[] }) {
  const columns = useMemo(() => buildColumns(), [])
  return (
    <DataTable<RestrictionRow>
      columns={columns}
      data={rows}
      getRowId={(row) => String(row.id)}
      initialSorting={[{ id: 'department', desc: false }]}
      emptyMessage="No coding restrictions defined."
    />
  )
}
