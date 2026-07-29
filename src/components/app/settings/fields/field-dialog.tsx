'use client'

import { useState } from 'react'
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { FieldRow } from './columns'

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

export function FieldDialog({
  field,
  sections,
  onSave,
}: {
  field: FieldRow | null
  sections: Section[]
  onSave: (f: Partial<FieldRow> & { id?: string | number | null }) => void
}) {
  const [state, setState] = useState<Partial<FieldRow>>(() => ({
    label: field?.label ?? '',
    fieldKey: field?.fieldKey ?? '',
    scope: field?.scope ?? 'header',
    type: field?.type ?? 'text',
    width: field?.width ?? 'full',
    section: field?.section ?? null,
    showAsColumn: field?.showAsColumn ?? false,
    order: field?.order ?? 99,
  }))

  return (
    <>
      <DialogHeader>
        <DialogTitle>{field ? 'Edit field' : 'Add field'}</DialogTitle>
        <DialogDescription>
          A field defined here appears on the form and the invoice header. Turn on the column
          option to offer it on All Requests, where it can also be filtered and exported.
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
          <Select
            value={state.scope}
            onValueChange={(v) => setState((s) => ({ ...s, scope: v as 'header' | 'line' }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="header">Header</SelectItem>
              <SelectItem value="line">Coding Line</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Type</Label>
          <Select value={state.type} onValueChange={(v) => setState((s) => ({ ...s, type: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Width</Label>
          <Select value={state.width} onValueChange={(v) => setState((s) => ({ ...s, width: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
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
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {sections.map((s) => (
                  <SelectItem key={String(s.id)} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="col-span-2 flex items-center justify-between rounded border border-border px-3 py-2">
          <Label htmlFor="lc" className="text-sm font-normal">
            Show as column on All Requests
          </Label>
          <Switch
            id="lc"
            checked={!!state.showAsColumn}
            onCheckedChange={(v) => setState((s) => ({ ...s, showAsColumn: v }))}
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          onClick={() =>
            onSave({
              id: field?.id,
              ...state,
              section: state.section ? ((state.section as Section).id as never) : null,
            })
          }
        >
          Save
        </Button>
      </DialogFooter>
    </>
  )
}
