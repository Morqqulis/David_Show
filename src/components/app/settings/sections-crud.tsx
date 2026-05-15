'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/ui/data-table/column-header'
import { SimpleCrud } from './simple-crud'
import { upsertSection, deleteSection } from '@/backend/actions/settings-actions'

type SectionRow = { id: string | number; name: string; order: number }

function buildColumns(): ColumnDef<SectionRow>[] {
  return [
    {
      accessorKey: 'order',
      meta: { label: 'Order' },
      size: 80,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Order" />,
      cell: ({ row }) => <span className="tabular-nums">{row.original.order}</span>,
    },
    {
      accessorKey: 'name',
      meta: { label: 'Name' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
  ]
}

export function SectionsCrud({ sections }: { sections: SectionRow[] }) {
  const columns = useMemo(() => buildColumns(), [])
  return (
    <SimpleCrud<SectionRow>
      title="Section"
      rows={sections}
      columns={columns}
      fields={[
        { key: 'name', label: 'Name' },
        { key: 'order', label: 'Order', type: 'number' },
      ]}
      upsert={upsertSection}
      remove={deleteSection}
    />
  )
}
