'use client'

import { useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/ui/data-table/column-header'
import { Badge } from '@/components/ui/badge'
import { SimpleCrud } from './simple-crud'
import { upsertTaxCode, deleteTaxCode } from '@/backend/actions/settings-actions'
import { queryKeys } from '@/hooks/use-ap-queries'

type TaxCodeRow = {
  id: string | number
  code: string
  label: string
  rate: number
  recoverablePct: number
  active?: boolean
}

function buildColumns(): ColumnDef<TaxCodeRow>[] {
  return [
    {
      accessorKey: 'code',
      meta: { label: 'Code' },
      size: 180,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
      cell: ({ row }) => <Badge variant="outline">{row.original.code}</Badge>,
    },
    {
      accessorKey: 'label',
      meta: { label: 'Label' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Label" />,
    },
    {
      accessorKey: 'rate',
      meta: { label: 'Rate' },
      size: 100,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Rate" />,
      cell: ({ row }) => <span className="tabular-nums">{(row.original.rate * 100).toFixed(2)}%</span>,
    },
    {
      accessorKey: 'recoverablePct',
      meta: { label: 'Recoverable' },
      size: 110,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Recoverable" />,
      cell: ({ row }) => (
        <span className="tabular-nums">{(row.original.recoverablePct * 100).toFixed(0)}%</span>
      ),
    },
  ]
}

export function TaxCodesCrud({ rows }: { rows: TaxCodeRow[] }) {
  const columns = useMemo(() => buildColumns(), [])
  const qc = useQueryClient()
  return (
    <SimpleCrud<TaxCodeRow>
      title="Tax code"
      rows={rows}
      columns={columns}
      fields={[
        { key: 'code', label: 'Code (e.g. HST-ON-PSB)' },
        { key: 'label', label: 'Label' },
        { key: 'rate', label: 'Rate (decimal, e.g. 0.13)', type: 'number', step: 0.001 },
        { key: 'recoverablePct', label: 'Recoverable % (decimal, 0–1)', type: 'number', step: 0.01 },
      ]}
      upsert={upsertTaxCode}
      remove={deleteTaxCode}
      // Coding screen reads tax rates from the cached `useLookups` query —
      // without this invalidate, a rate change here would not flow through to
      // line-tax math until the next full reload.
      afterMutate={() => qc.invalidateQueries({ queryKey: queryKeys.lookups })}
    />
  )
}
