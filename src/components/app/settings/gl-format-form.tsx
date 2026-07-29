'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
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
import { saveGlFormat } from '@/backend/actions/gl-mapping-actions'
import { parseMask } from '@/backend/lib/segments'

export type GlFormatValue = {
  mask: string
  labels: string[]
  departmentSegment: number
  catchAllDepartment: string
}

// One evolving pill for this card, however many times the admin saves.
const TOAST_ID = 'gl-format-save'

export function GlFormatForm({
  value,
  departments,
}: {
  value: GlFormatValue
  departments: Array<{ id: string | number; name: string }>
}) {
  const [form, setForm] = useState<GlFormatValue>(value)
  const lastSaved = useRef<GlFormatValue>(value)
  const [, startTransition] = useTransition()

  // Re-read the format on every keystroke so the part names and the
  // "which part" picker follow what the admin is typing.
  let parts: string[] = []
  let problem: string | null = null
  try {
    parts = parseMask(form.mask, form.labels, 0).segments.map((s) => s.label)
  } catch (err) {
    problem = (err as Error).message
  }

  function setLabel(index: number, label: string) {
    setForm((f) => {
      const labels = [...f.labels]
      while (labels.length <= index) labels.push('')
      labels[index] = label
      return { ...f, labels }
    })
  }

  function save() {
    if (problem) {
      toast.error(problem, { id: TOAST_ID })
      return
    }
    if (!form.catchAllDepartment) {
      toast.error('Choose the department that unmapped sub-departments should go to.', { id: TOAST_ID })
      return
    }
    const previous = lastSaved.current
    const next = { ...form, labels: form.labels.slice(0, parts.length) }
    lastSaved.current = next
    setForm(next)
    startTransition(async () => {
      try {
        await saveGlFormat({
          mask: next.mask,
          labels: next.labels,
          departmentSegment: next.departmentSegment,
          catchAllDepartment: next.catchAllDepartment,
        })
        toast.success('GL account format saved', { id: TOAST_ID, duration: 1500 })
      } catch (err) {
        lastSaved.current = previous
        setForm(previous)
        console.error('[gl-mapping] saving the GL account format failed', {
          mask: next.mask,
          departmentSegment: next.departmentSegment,
          err,
        })
        toast.error('Could not save — change rolled back', { id: TOAST_ID })
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <Label>Account code format</Label>
        <Input
          value={form.mask}
          onChange={(e) => setForm((f) => ({ ...f, mask: e.target.value }))}
          placeholder="XX-XXX-XXXX-XXXXX"
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          One X for each character, with the separator between the parts. Parts may be different
          lengths — for example XX-XXX-XXXX-XXXXX matches 10-000-0000-10116.
        </p>
        {problem ? <p className="text-xs text-red-600">{problem}</p> : null}
      </div>

      {parts.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {parts.map((label, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Label>Name of part {i + 1}</Label>
              <Input
                value={form.labels[i] ?? ''}
                onChange={(e) => setLabel(i, e.target.value)}
                placeholder={label}
              />
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Part that names the sub-department</Label>
          <Select
            value={String(form.departmentSegment)}
            onValueChange={(v) => setForm((f) => ({ ...f, departmentSegment: Number(v) }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a part" />
            </SelectTrigger>
            <SelectContent>
              {parts.map((label, i) => (
                <SelectItem key={i} value={String(i + 1)}>
                  Part {i + 1} — {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            This is the part matched against the sub-department ranges below.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Department for unmapped sub-departments</Label>
          <Select
            value={form.catchAllDepartment}
            onValueChange={(v) => setForm((f) => ({ ...f, catchAllDepartment: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a department" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((d) => (
                <SelectItem key={String(d.id)} value={String(d.id)}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            New sub-departments appear in the accounts list before anyone maps them. They go here,
            so somebody sees them, instead of becoming codeable by everyone.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={save}>
          Save format
        </Button>
      </div>
    </div>
  )
}
