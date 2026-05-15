'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type Column<T> = {
  key: keyof T | string
  label: string
  render?: (row: T) => React.ReactNode
  className?: string
}

export type SimpleField<T> = {
  key: keyof T | string
  label: string
  type?: 'text' | 'number'
  placeholder?: string
  defaultValue?: string | number | boolean
  step?: number
}

export function SimpleCrud<T extends { id: string | number }>({
  title,
  rows,
  columns,
  fields,
  upsert,
  remove,
  canDelete = () => true,
}: {
  title: string
  rows: T[]
  columns: Column<T>[]
  fields: SimpleField<T>[]
  upsert: (id: string | number | null, patch: Record<string, unknown>) => Promise<void>
  remove: (id: string | number) => Promise<void>
  canDelete?: (row: T) => boolean
}) {
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
      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={String(c.key)} className={c.className}>
                  {c.label}
                </TableHead>
              ))}
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="py-8 text-center text-muted-foreground">
                  No records yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={String(row.id)}>
                  {columns.map((c) => (
                    <TableCell key={String(c.key)} className={c.className}>
                      {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key as string] ?? '—')}
                    </TableCell>
                  ))}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(row)
                          setOpen(true)
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {canDelete(row) ? (
                        <Button size="icon" variant="ghost" onClick={() => onRemove(row)}>
                          <Trash2 className="h-3.5 w-3.5 text-red-600" />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
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
              value={(state[f.key as string] ?? '') as string | number}
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
