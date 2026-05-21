'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { ColumnDef } from '@tanstack/react-table'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DataTable } from '@/components/ui/data-table'

export type SimpleField<T> = {
  key: keyof T | string
  label: string
  type?: 'text' | 'number'
  placeholder?: string
  defaultValue?: string | number | boolean
  step?: number
}

export type SimpleCrudProps<T extends { id: string | number }> = {
  title: string
  rows: T[]
  /** TanStack column definitions for the displayed (non-action) columns. */
  columns: ColumnDef<T>[]
  /** Form fields for the add/edit dialog. */
  fields: SimpleField<T>[]
  /**
   * Server actions return the persisted id so the UI can swap an optimistic
   * `tmp-…` id for the real one once Postgres has written the row.
   */
  upsert: (id: string | number | null, patch: Record<string, unknown>) => Promise<{ id: string | number }>
  remove: (id: string | number) => Promise<void>
  canDelete?: (row: T) => boolean
  emptyMessage?: string
  /**
   * Runs after a successful upsert / remove. Use it to invalidate client-side
   * TanStack caches whose data this CRUD mutates (e.g. tax-codes edits
   * invalidate `useLookups`). Runs in the background — no UI blocking.
   */
  afterMutate?: () => void | Promise<void>
}

/**
 * Optimistic UX contract:
 *  - `rows` prop seeds local state ONCE on mount; thereafter the local state
 *    is the source of truth and the server is a persistence layer.
 *  - Add: insert a tmp-id row immediately, replace with the server-assigned
 *    id once the action resolves. Roll back on failure.
 *  - Edit: apply patch immediately, roll back on failure.
 *  - Delete: remove immediately, restore on failure.
 *  - No `router.refresh()` — the old "save → wait → re-render whole route"
 *    pattern is exactly the source of the 300-500ms perceived lag we're
 *    eliminating here.
 */
export function SimpleCrud<T extends { id: string | number }>({
  title,
  rows: initialRows,
  columns: providedColumns,
  fields,
  upsert,
  remove,
  canDelete = () => true,
  emptyMessage,
  afterMutate,
}: SimpleCrudProps<T>) {
  const [rows, setRows] = useState<T[]>(initialRows)
  const [, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<T | null>(null)
  const tmpCounter = useRef(0)
  // All saves from this CRUD share a single Sonner toast id — rapid
  // add/edit/delete sequences collapse into one evolving pill.
  const toastId = `simple-crud-${title.toLowerCase().replace(/\s+/g, '-')}`

  function applyTo(id: string | number, mapper: (row: T) => T): void {
    setRows((cur) => cur.map((r) => (String(r.id) === String(id) ? mapper(r) : r)))
  }

  function save(patch: Record<string, unknown>) {
    if (editing) {
      // EDIT — optimistic patch + rollback snapshot.
      const editingId = editing.id
      const previous = rows.find((r) => String(r.id) === String(editingId))
      if (!previous) return
      applyTo(editingId, (row) => ({ ...row, ...(patch as Partial<T>) }))
      setOpen(false)
      setEditing(null)
      startTransition(async () => {
        try {
          await upsert(editingId, patch)
          await afterMutate?.()
          toast.success(`${title} saved`, { id: toastId, duration: 1500 })
        } catch (err) {
          applyTo(editingId, () => previous)
          console.error(`[settings/${title.toLowerCase()}] upsert failed`, { id: editingId, err })
          toast.error(`Could not save — change rolled back`, { id: toastId })
        }
      })
      return
    }

    // ADD — push tmp-id row, swap for real id after server resolves.
    tmpCounter.current += 1
    const tmpId = `tmp-${tmpCounter.current}-${Math.random().toString(36).slice(2, 7)}`
    const optimisticRow = { id: tmpId, ...(patch as Partial<T>) } as T
    setRows((cur) => [...cur, optimisticRow])
    setOpen(false)
    setEditing(null)
    startTransition(async () => {
      try {
        const created = await upsert(null, patch)
        applyTo(tmpId, (row) => ({ ...row, id: created.id }))
        await afterMutate?.()
        toast.success(`${title} saved`, { id: toastId, duration: 1500 })
      } catch (err) {
        setRows((cur) => cur.filter((r) => r.id !== tmpId))
        console.error(`[settings/${title.toLowerCase()}] create failed`, { patch, err })
        toast.error(`Could not save — change rolled back`, { id: toastId })
      }
    })
  }

  function onRemove(row: T) {
    if (!confirm(`Delete this ${title.toLowerCase()}?`)) return
    const previousRows = rows
    setRows((cur) => cur.filter((r) => String(r.id) !== String(row.id)))
    startTransition(async () => {
      try {
        await remove(row.id)
        await afterMutate?.()
        toast.success(`${title} deleted`, { id: toastId, duration: 1500 })
      } catch (err) {
        setRows(previousRows)
        console.error(`[settings/${title.toLowerCase()}] delete failed`, { id: row.id, err })
        toast.error(`Could not delete — change rolled back`, { id: toastId })
      }
    })
  }

  // When the parent re-renders with materially different rows (e.g. the page
  // got `router.refresh`'d from elsewhere, or a server-driven cache eviction
  // happened), reconcile our local state. We key on length + the joined id
  // set so a no-op refetch doesn't clobber in-flight optimistic state.
  const initialFingerprint = useMemo(
    () => `${initialRows.length}:${initialRows.map((r) => r.id).join('|')}`,
    [initialRows],
  )
  const lastSeenFingerprint = useRef(initialFingerprint)
  useEffect(() => {
    if (initialFingerprint !== lastSeenFingerprint.current) {
      lastSeenFingerprint.current = initialFingerprint
      setRows(initialRows)
    }
  }, [initialFingerprint, initialRows])

  const columns = useMemo<ColumnDef<T>[]>(
    () => [
      ...providedColumns,
      {
        id: 'actions',
        enableSorting: false,
        enableHiding: false,
        size: 80,
        header: () => null,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                setEditing(row.original)
                setOpen(true)
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {canDelete(row.original) ? (
              <Button size="icon" variant="ghost" onClick={() => onRemove(row.original)}>
                <Trash2 className="h-3.5 w-3.5 text-red-600" />
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [providedColumns, canDelete],
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
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? `Edit ${title}` : `Add ${title}`}</DialogTitle>
            </DialogHeader>
            <FormBody fields={fields} editing={editing} onSubmit={save} />
          </DialogContent>
        </Dialog>
      </div>
      <DataTable<T>
        columns={columns}
        data={rows}
        getRowId={(row) => String(row.id)}
        emptyMessage={emptyMessage ?? `No ${title.toLowerCase()} records yet.`}
      />
    </div>
  )
}

function FormBody<T extends { id: string | number }>({
  fields,
  editing,
  onSubmit,
}: {
  fields: SimpleField<T>[]
  editing: T | null
  onSubmit: (patch: Record<string, unknown>) => void
}) {
  const [state, setState] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {}
    for (const f of fields) {
      const key = f.key as string
      init[key] = editing
        ? (editing as Record<string, unknown>)[key]
        : (f.defaultValue ?? (f.type === 'number' ? 0 : ''))
    }
    return init
  })

  return (
    <>
      <div className="grid gap-3 py-2">
        {fields.map((f) => (
          <div key={String(f.key)} className="flex flex-col gap-1.5">
            <Label>{f.label}</Label>
            <Input
              type={f.type ?? 'text'}
              step={f.step}
              value={String(state[f.key as string] ?? '')}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  [f.key as string]: f.type === 'number' ? parseFloat(e.target.value || '0') : e.target.value,
                }))
              }
              placeholder={f.placeholder}
            />
          </div>
        ))}
      </div>
      <DialogFooter>
        <Button onClick={() => onSubmit(state)}>Save</Button>
      </DialogFooter>
    </>
  )
}
