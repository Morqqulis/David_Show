'use client'

import { SimpleCrud } from './simple-crud'
import { upsertDepartment, deleteDepartment } from '@/backend/actions/settings-actions'

export function DepartmentsCrud({ rows }: { rows: Array<{ id: string | number; name: string; code: string }> }) {
  return (
    <SimpleCrud
      title="Department"
      rows={rows}
      columns={[
        { key: 'code', label: 'Code', className: 'w-[120px] font-mono text-xs' },
        { key: 'name', label: 'Name' },
      ]}
      fields={[
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Name' },
      ]}
      upsert={upsertDepartment}
      remove={deleteDepartment}
    />
  )
}
