'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type SegmentRangeDraft = {
  department: string
  fromValue: string
  toValue: string
  note: string
}

export const emptySegmentRangeDraft: SegmentRangeDraft = {
  department: '',
  fromValue: '',
  toValue: '',
  note: '',
}

/** Add or edit one row of the sub-department map. */
export function DepartmentSegmentRangeDialog({
  open,
  onOpenChange,
  editing,
  departments,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: SegmentRangeDraft | null
  departments: Array<{ id: string | number; name: string }>
  onSubmit: (draft: SegmentRangeDraft) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Edit sub-department range' : 'Add sub-department range'}
          </DialogTitle>
        </DialogHeader>
        {/* The form is its own component so that closing the dialog unmounts
            it and the next open starts from the right values — rather than
            resetting state from an effect, which cascades renders. */}
        <RangeForm editing={editing} departments={departments} onSubmit={onSubmit} />
      </DialogContent>
    </Dialog>
  )
}

function RangeForm({
  editing,
  departments,
  onSubmit,
}: {
  editing: SegmentRangeDraft | null
  departments: Array<{ id: string | number; name: string }>
  onSubmit: (draft: SegmentRangeDraft) => void
}) {
  const [draft, setDraft] = useState<SegmentRangeDraft>(
    editing ? { ...editing } : emptySegmentRangeDraft,
  )
  const incomplete = !draft.department || draft.fromValue.trim() === ''

  return (
    <>
      <div className="grid gap-3 py-2">
        <div className="flex flex-col gap-1.5">
          <Label>Department</Label>
          <Select
            value={draft.department}
            onValueChange={(v) => setDraft((d) => ({ ...d, department: v }))}
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
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>From</Label>
            <Input
              value={draft.fromValue}
              onChange={(e) => setDraft((d) => ({ ...d, fromValue: e.target.value }))}
              placeholder="0400"
              className="font-mono"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>To</Label>
            <Input
              value={draft.toValue}
              onChange={(e) => setDraft((d) => ({ ...d, toValue: e.target.value }))}
              placeholder="0414"
              className="font-mono"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Leave To blank to map a single sub-department. A single value always wins over a range
          that contains it, so use one to carve an exception out of a wider range.
        </p>
        <div className="flex flex-col gap-1.5">
          <Label>Note</Label>
          <Input
            value={draft.note}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
            placeholder="Swim Program"
          />
        </div>
      </div>
      <DialogFooter>
        <Button disabled={incomplete} onClick={() => onSubmit(draft)}>
          Save
        </Button>
      </DialogFooter>
    </>
  )
}
