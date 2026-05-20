'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { DataTable } from '@/components/ui/data-table'
import { upsertField, deleteField } from '@/backend/actions/settings-actions'
import { buildFieldsColumns, type FieldRow } from './columns'
import { FieldDialog } from './field-dialog'

type Section = { id: string | number; name: string }

/**
 * Optimistic UX contract — same as SimpleCrud / WorkflowTable:
 *  - The `fields` prop seeds local state once. Local state is the source of
 *    truth thereafter. Server is a persistence layer.
 *  - Add: insert with `tmp-…` id; swap to real id once `upsertField`
 *    resolves. Roll back on failure.
 *  - Edit: apply patch immediately; roll back on failure.
 *  - Delete: drop the row immediately; restore on failure.
 *  - No `router.refresh()` — that's the prior 300-500ms-per-save tax.
 */
export function FieldsTable({
  fields: initialFields,
  sections,
}: {
  fields: FieldRow[]
  sections: Section[]
  stages: unknown[]
}) {
  const [fields, setFields] = useState<FieldRow[]>(initialFields)
  const [, startTransition] = useTransition()
  const [editing, setEditing] = useState<FieldRow | null>(null)
  const [open, setOpen] = useState(false)
  const tmpCounter = useRef(0)

  function save(field: Partial<FieldRow> & { id?: string | number | null }) {
    const { id: incomingId, ...patch } = field
    const isEdit = !!incomingId

    if (isEdit) {
      const editingId = incomingId as string | number
      const previous = fields.find((f) => String(f.id) === String(editingId))
      if (!previous) return
      setFields((cur) =>
        cur.map((f) => (String(f.id) === String(editingId) ? { ...f, ...(patch as Partial<FieldRow>) } : f)),
      )
      setOpen(false)
      setEditing(null)
      startTransition(async () => {
        try {
          await upsertField(editingId, patch as Record<string, unknown>)
        } catch (err) {
          setFields((cur) => cur.map((f) => (String(f.id) === String(editingId) ? previous : f)))
          console.error('[settings/fields] upsert failed', { id: editingId, err })
          toast.error('Could not save — change rolled back')
        }
      })
      return
    }

    // ADD
    tmpCounter.current += 1
    const tmpId = `tmp-${tmpCounter.current}-${Math.random().toString(36).slice(2, 7)}`
    const optimistic = { id: tmpId, ...(patch as Partial<FieldRow>) } as FieldRow
    setFields((cur) => [...cur, optimistic])
    setOpen(false)
    setEditing(null)
    startTransition(async () => {
      try {
        const created = await upsertField(null, patch as Record<string, unknown>)
        setFields((cur) => cur.map((f) => (f.id === tmpId ? { ...f, id: created.id } : f)))
      } catch (err) {
        setFields((cur) => cur.filter((f) => f.id !== tmpId))
        console.error('[settings/fields] create failed', { patch, err })
        toast.error('Could not save — change rolled back')
      }
    })
  }

  function remove(row: FieldRow) {
    if (
      !confirm(
        'Delete this field? Existing invoice values for this fieldKey will remain in the database but stop appearing.',
      )
    )
      return
    const previousFields = fields
    setFields((cur) => cur.filter((f) => String(f.id) !== String(row.id)))
    startTransition(async () => {
      try {
        await deleteField(row.id)
      } catch (err) {
        setFields(previousFields)
        console.error('[settings/fields] delete failed', { id: row.id, err })
        toast.error('Could not delete — change rolled back')
      }
    })
  }

  // Reconcile with parent props if the fingerprint materially changes (e.g.
  // user navigated away and back, so the route re-fetched). A no-op render
  // with the same id set leaves in-flight optimistic state untouched.
  const initialFingerprint = useMemo(
    () => `${initialFields.length}:${initialFields.map((f) => f.id).join('|')}`,
    [initialFields],
  )
  const lastSeenFingerprint = useRef(initialFingerprint)
  useEffect(() => {
    if (initialFingerprint !== lastSeenFingerprint.current) {
      lastSeenFingerprint.current = initialFingerprint
      setFields(initialFields)
    }
  }, [initialFingerprint, initialFields])

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
