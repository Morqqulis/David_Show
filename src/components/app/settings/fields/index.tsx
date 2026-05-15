'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { DataTable } from '@/components/ui/data-table'
import { upsertField, deleteField } from '@/backend/actions/settings-actions'
import { buildFieldsColumns, type FieldRow } from './columns'
import { FieldDialog } from './field-dialog'

type Section = { id: string | number; name: string }

export function FieldsTable({
  fields,
  sections,
}: {
  fields: FieldRow[]
  sections: Section[]
  stages: unknown[]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [editing, setEditing] = useState<FieldRow | null>(null)
  const [open, setOpen] = useState(false)

  function save(field: Partial<FieldRow> & { id?: string | number | null }) {
    startTransition(async () => {
      const id = field.id ?? null
      const { id: _id, ...rest } = field
      await upsertField(id as never, rest as never)
      toast.success('Field saved')
      router.refresh()
      setOpen(false)
      setEditing(null)
    })
  }

  function remove(row: FieldRow) {
    if (
      !confirm(
        'Delete this field? Existing invoice values for this fieldKey will remain in the database but stop appearing.',
      )
    )
      return
    startTransition(async () => {
      await deleteField(row.id)
      toast.success('Field deleted')
      router.refresh()
    })
  }

  const columns = useMemo(
    () =>
      buildFieldsColumns({
        onEdit: (row) => {
          setEditing(row)
          setOpen(true)
        },
        onRemove: remove,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o)
            if (!o) setEditing(null)
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setEditing(null)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add field
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <FieldDialog field={editing} sections={sections} onSave={save} />
          </DialogContent>
        </Dialog>
      </div>
      <DataTable<FieldRow>
        columns={columns}
        data={fields}
        getRowId={(row) => String(row.id)}
        initialSorting={[{ id: 'order', desc: false }]}
        emptyMessage="No fields defined."
      />
    </div>
  )
}
