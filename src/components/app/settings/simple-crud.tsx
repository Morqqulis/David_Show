'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
  upsert: (id: string | number | null, patch: Record<string, unknown>) => Promise<void>
  remove: (id: string | number) => Promise<void>
  canDelete?: (row: T) => boolean
  emptyMessage?: string
}

export function SimpleCrud<T extends { id: string | number }>({
  title,
  rows,
  columns: providedColumns,
  fields,
  upsert,
  remove,
  canDelete = () => true,
  emptyMessage,
}: SimpleCrudProps<T>) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<T | null>(null)

  function save(patch: Record<string, unknown>) {
    startTransition(async () => {
      await upsert(editing?.id ?? null, patch)
      toast.success(`${title} saved`)
      router.refresh()
      setOpen(false)
      setEditing(null)
    })
  }

  function onRemove(row: T) {
    if (!confirm(`Delete this ${title.toLowerCase()}?`)) return
    startTransition(async () => {
      await remove(row.id)
      toast.success(`${title} deleted`)
      router.refresh()
    })
  }

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
