'use client'

import { SimpleCrud } from './simple-crud'
import { upsertSection, deleteSection } from '@/backend/actions/settings-actions'

export function SectionsCrud({ sections }: { sections: Array<{ id: string | number; name: string; order: number }> }) {
  return (
    <SimpleCrud
      title="Section"
      rows={sections}
      columns={[
        { key: 'order', label: 'Order', className: 'w-[80px]' },
        { key: 'name', label: 'Name' },
      ]}
      fields={[
        { key: 'name', label: 'Name' },
        { key: 'order', label: 'Order', type: 'number' },
      ]}
      upsert={upsertSection}
      remove={deleteSection}
    />
  )
}
