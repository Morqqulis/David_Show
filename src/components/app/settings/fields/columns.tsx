'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { Lock, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/ui/data-table/column-header'

export type FieldRow = {
  id: string | number
  fieldKey: string
  label: string
  scope: 'header' | 'line'
  type: string
  width?: string
  section?: { id: string | number; name: string } | null
  isSystem?: boolean
  removable?: boolean
  showAsColumn?: boolean
  order?: number
}

export function buildFieldsColumns({
  onEdit,
  onRemove,
}: {
  onEdit: (row: FieldRow) => void
  onRemove: (row: FieldRow) => void
}): ColumnDef<FieldRow>[] {
  return [
    {
      accessorKey: 'order',
      meta: { label: 'Order' },
      size: 60,
      header: ({ column }) => <DataTableColumnHeader column={column} title="#" />,
      cell: ({ row }) => (
        <span className="tabular-nums text-xs text-muted-foreground">{row.original.order ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'fieldKey',
      meta: { label: 'Key' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Key" />,
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.fieldKey}</span>,
    },
    {
      accessorKey: 'label',
      meta: { label: 'Label' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Label" />,
      cell: ({ row }) => <span className="font-medium">{row.original.label}</span>,
    },
    {
      accessorKey: 'scope',
      meta: { label: 'Scope' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Scope" />,
      cell: ({ row }) => <Badge variant="secondary">{row.original.scope}</Badge>,
    },
    {
      accessorKey: 'type',
      meta: { label: 'Type' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
      cell: ({ row }) => <Badge variant="outline">{row.original.type}</Badge>,
    },
    {
      id: 'section',
      accessorFn: (row) => row.section?.name ?? '',
      meta: { label: 'Section' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Section" />,
      cell: ({ row }) => row.original.section?.name ?? '—',
    },
    {
      accessorKey: 'width',
      meta: { label: 'Width' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Width" />,
      cell: ({ row }) => row.original.width ?? '—',
    },
    {
      accessorKey: 'showAsColumn',
      meta: { label: 'List col' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="List col" />,
      cell: ({ row }) => (row.original.showAsColumn ? '✓' : '—'),
    },
    {
      id: 'actions',
      enableSorting: false,
      enableHiding: false,
      size: 80,
      header: () => null,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => onEdit(row.original)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {row.original.removable !== false && !row.original.isSystem ? (
            <Button size="icon" variant="ghost" onClick={() => onRemove(row.original)}>
              <Trash2 className="h-3.5 w-3.5 text-red-600" />
            </Button>
          ) : (
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      ),
    },
  ]
}
