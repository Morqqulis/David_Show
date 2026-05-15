'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'
import { DataTableColumnHeader } from '@/components/ui/data-table/column-header'
import { Badge } from '@/components/ui/badge'
import { Money } from '../money'

export type ApprovalRuleRow = {
  id: string | number
  name: string
  order: number
  enabled: boolean
  conditions?: {
    operator: 'and' | 'or'
    conditions: Array<{ fieldKey: string; operator: string; value: unknown }>
  }
  approvers?: Array<{
    type: string
    user?: { name?: string }
    role?: { name?: string }
    department?: { name?: string }
  }>
  mode?: string
}

function renderConditionValue(key: string, v: unknown): React.ReactNode {
  if (key === 'grandTotal' || key === 'subtotal') return <Money value={Number(v)} />
  return String(v ?? '')
}

function buildColumns(): ColumnDef<ApprovalRuleRow>[] {
  return [
    {
      accessorKey: 'order',
      meta: { label: 'Order' },
      size: 60,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Order" />,
      cell: ({ row }) => <span className="tabular-nums">{row.original.order}</span>,
    },
    {
      accessorKey: 'name',
      meta: { label: 'Rule' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Rule" />,
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      id: 'conditions',
      enableSorting: false,
      meta: { label: 'Conditions' },
      header: () => <span className="text-xs uppercase tracking-wide text-muted-foreground">Conditions</span>,
      cell: ({ row }) => (
        <div className="space-y-1 text-xs">
          <Badge variant="outline">{row.original.conditions?.operator ?? '—'}</Badge>
          <ul className="space-y-0.5">
            {(row.original.conditions?.conditions ?? []).map((c, i) => (
              <li key={i} className="font-mono text-[11px] text-muted-foreground">
                {c.fieldKey} <span className="text-foreground">{c.operator}</span>{' '}
                {renderConditionValue(c.fieldKey, c.value)}
              </li>
            ))}
          </ul>
        </div>
      ),
    },
    {
      id: 'approvers',
      enableSorting: false,
      meta: { label: 'Approvers' },
      header: () => <span className="text-xs uppercase tracking-wide text-muted-foreground">Approvers</span>,
      cell: ({ row }) => (
        <div className="space-y-0.5 text-xs">
          {(row.original.approvers ?? []).map((a, i) => (
            <div key={i}>
              <Badge variant="secondary" className="text-[10px]">
                {a.type}
              </Badge>{' '}
              <span>{a.user?.name ?? a.role?.name ?? a.department?.name ?? ''}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'mode',
      accessorFn: (row) => row.mode ?? 'parallel',
      meta: { label: 'Mode' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Mode" />,
      cell: ({ row }) => <Badge variant="outline">{row.original.mode ?? 'parallel'}</Badge>,
    },
    {
      accessorKey: 'enabled',
      meta: { label: 'Enabled' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Enabled" />,
      cell: ({ row }) => (row.original.enabled ? <Badge>on</Badge> : <Badge variant="secondary">off</Badge>),
    },
  ]
}

export function ApprovalRulesTable({ rows }: { rows: ApprovalRuleRow[] }) {
  const columns = useMemo(() => buildColumns(), [])
  return (
    <DataTable<ApprovalRuleRow>
      columns={columns}
      data={rows}
      getRowId={(row) => String(row.id)}
      initialSorting={[{ id: 'order', desc: false }]}
      emptyMessage="No approval rules configured."
    />
  )
}
