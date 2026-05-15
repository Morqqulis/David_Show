'use client'

import { Badge } from '@/components/ui/badge'
import { SimpleCrud } from './simple-crud'
import { upsertTaxCode, deleteTaxCode } from '@/backend/actions/settings-actions'

type TaxCode = {
  id: string | number
  code: string
  label: string
  rate: number
  recoverablePct: number
  active?: boolean
}

export function TaxCodesCrud({ rows }: { rows: TaxCode[] }) {
  return (
    <SimpleCrud<TaxCode>
      title="Tax code"
      rows={rows}
      columns={[
        { key: 'code', label: 'Code', className: 'font-mono w-[180px]', render: (r) => <Badge variant="outline">{r.code}</Badge> },
        { key: 'label', label: 'Label' },
        { key: 'rate', label: 'Rate', render: (r) => `${(r.rate * 100).toFixed(2)}%`, className: 'tabular-nums w-[100px]' },
        { key: 'recoverablePct', label: 'Recoverable', render: (r) => `${(r.recoverablePct * 100).toFixed(0)}%`, className: 'tabular-nums w-[100px]' },
      ]}
      fields={[
        { key: 'code', label: 'Code (e.g. HST-ON-PSB)' },
        { key: 'label', label: 'Label' },
        { key: 'rate', label: 'Rate (decimal, e.g. 0.13)', type: 'number', step: 0.001 },
        { key: 'recoverablePct', label: 'Recoverable % (decimal, 0–1)', type: 'number', step: 0.01 },
      ]}
      upsert={upsertTaxCode}
      remove={deleteTaxCode}
    />
  )
}
