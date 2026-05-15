'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { upsertField, deleteField } from '@/backend/actions/settings-actions'

type Field = {
  id: string | number
  fieldKey: string
  label: string
  scope: 'header' | 'line'
  type: string
  width?: string
  section?: { id: string | number; name: string } | null
  isSystem?: boolean
  removable?: boolean
  showAsColumn?: boolean
  exportable?: boolean
  order?: number
}
type Section = { id: string | number; name: string }

const FIELD_TYPES = [
  'text',
  'textarea',
  'richtext',
  'number',
  'currency',
  'date',
  'choice',
  'multiselect',
  'yesno',
  'lookup',
  'user',
  'group',
  'file',
]

export function FieldsTable({ fields, sections }: { fields: Field[]; sections: Section[]; stages: unknown[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [editing, setEditing] = useState<Field | null>(null)
  const [open, setOpen] = useState(false)

  function save(field: Partial<Field> & { id?: string | number | null }) {
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

  function remove(id: string | number) {
    if (!confirm('Delete this field? Existing invoice values for this fieldKey will remain in the database but stop appearing.')) return
    startTransition(async () => {
      await deleteField(id)
      toast.success('Field deleted')
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
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

      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Section</TableHead>
              <TableHead>Width</TableHead>
              <TableHead>List col</TableHead>
              <TableHead>Export</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((f) => (
              <TableRow key={String(f.id)}>
                <TableCell className="font-mono text-xs">{f.fieldKey}</TableCell>
                <TableCell className="font-medium">{f.label}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{f.scope}</Badge>
                </TableCell>
                <TableCell><Badge variant="outline">{f.type}</Badge></TableCell>
                <TableCell>{f.section?.name ?? '—'}</TableCell>
                <TableCell>{f.width ?? '—'}</TableCell>
                <TableCell>{f.showAsColumn ? '✓' : '—'}</TableCell>
                <TableCell>{f.exportable ? '✓' : '—'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditing(f)
                        setOpen(true)
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {f.removable !== false && !f.isSystem ? (
                      <Button size="icon" variant="ghost" onClick={() => remove(f.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-red-600" />
                      </Button>
                    ) : (
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function FieldDialog({
  field,
  sections,
  onSave,
}: {
  field: Field | null
  sections: Section[]
  onSave: (f: Partial<Field> & { id?: string | number | null }) => void
}) {
  const [state, setState] = useState<Partial<Field>>(() => ({
    label: field?.label ?? '',
    fieldKey: field?.fieldKey ?? '',
    scope: field?.scope ?? 'header',
    type: field?.type ?? 'text',
    width: field?.width ?? 'full',
    section: field?.section ?? null,
    showAsColumn: field?.showAsColumn ?? false,
    exportable: field?.exportable ?? false,
    order: field?.order ?? 99,
  }))

  return (
    <>
      <DialogHeader>
        <DialogTitle>{field ? 'Edit field' : 'Add field'}</DialogTitle>
        <DialogDescription>
          A field defined here automatically appears on the form, header view, list columns, and (if enabled) the CSV export.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3 py-2">
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label>Label</Label>
          <Input value={state.label ?? ''} onChange={(e) => setState((s) => ({ ...s, label: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Key (stable ID)</Label>
          <Input
            value={state.fieldKey ?? ''}
            onChange={(e) => setState((s) => ({ ...s, fieldKey: e.target.value }))}
            disabled={!!field}
            placeholder="e.g. heritageDistrict"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Scope</Label>
          <Select value={state.scope} onValueChange={(v) => setState((s) => ({ ...s, scope: v as 'header' | 'line' }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="header">Header</SelectItem>
              <SelectItem value="line">Coding Line</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Type</Label>
          <Select value={state.type} onValueChange={(v) => setState((s) => ({ ...s, type: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Width</Label>
          <Select value={state.width} onValueChange={(v) => setState((s) => ({ ...s, width: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="full">Full</SelectItem>
              <SelectItem value="half">1/2</SelectItem>
              <SelectItem value="third">1/3</SelectItem>
              <SelectItem value="quarter">1/4</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {state.scope === 'header' ? (
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label>Section</Label>
            <Select
              value={state.section ? String((state.section as Section).id) : ''}
              onValueChange={(v) => {
                const sec = sections.find((s) => String(s.id) === v)
                setState((s) => ({ ...s, section: sec ?? null }))
              }}
            >
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {sections.map((s) => (
                  <SelectItem key={String(s.id)} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="col-span-2 flex items-center justify-between rounded border border-border px-3 py-2">
          <Label htmlFor="lc" className="text-sm font-normal">Show as column on All Requests</Label>
          <Switch
            id="lc"
            checked={!!state.showAsColumn}
            onCheckedChange={(v) => setState((s) => ({ ...s, showAsColumn: v }))}
          />
        </div>
        <div className="col-span-2 flex items-center justify-between rounded border border-border px-3 py-2">
          <Label htmlFor="exp" className="text-sm font-normal">Available for CSV export</Label>
          <Switch
            id="exp"
            checked={!!state.exportable}
            onCheckedChange={(v) => setState((s) => ({ ...s, exportable: v }))}
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          onClick={() =>
            onSave({
              id: field?.id ?? undefined,
              ...state,
              section: state.section ? ((state.section as Section).id as never) : (null as never),
            })
          }
        >
          Save
        </Button>
      </DialogFooter>
    </>
  )
}
