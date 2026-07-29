'use client'

import { useState } from 'react'
import { Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  sanitizeJsonFilterValue,
  type ColumnFilterSpec,
  type InvoiceColumn,
} from '@/backend/lib/invoice-filters'

export type ColumnFilterOption = { value: string; label: string }

/**
 * The filter control for one column. Which control appears follows the field
 * type: a contains box for text, a tick-list for choices and people, a from/to
 * pair for dates and amounts. Everything the clerk ticks inside one column is
 * OR-ed; separate columns narrow each other.
 */
export function ColumnFilterControl({
  column,
  value,
  options,
  onChange,
}: {
  column: InvoiceColumn
  value: ColumnFilterSpec | undefined
  options: ColumnFilterOption[]
  onChange: (next: ColumnFilterSpec | null) => void
}) {
  const [open, setOpen] = useState(false)
  const active = isActive(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-6 w-6', active ? 'text-primary' : 'text-muted-foreground/60')}
          aria-label={active ? `Change the ${column.label} filter` : `Filter by ${column.label}`}
        >
          <Filter className={cn('h-3 w-3', active && 'fill-current')} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <div className="text-xs font-medium text-muted-foreground">Filter by {column.label}</div>
        {column.kind === 'text' ? (
          <TextFilter column={column} value={value} onChange={onChange} />
        ) : column.kind === 'date' || column.kind === 'number' ? (
          <RangeFilter column={column} value={value} onChange={onChange} />
        ) : (
          <ListFilter column={column} value={value} options={options} onChange={onChange} />
        )}
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            disabled={!active}
            onClick={() => {
              onChange(null)
              setOpen(false)
            }}
          >
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function isActive(value: ColumnFilterSpec | undefined): boolean {
  if (!value) return false
  return (value.values?.length ?? 0) > 0 || !!value.from || !!value.to
}

function TextFilter({
  column,
  value,
  onChange,
}: {
  column: InvoiceColumn
  value: ColumnFilterSpec | undefined
  onChange: (next: ColumnFilterSpec | null) => void
}) {
  const text = value?.values?.[0] ?? ''
  return (
    <div className="flex flex-col gap-1.5">
      <Input
        autoFocus
        value={text}
        placeholder="Contains…"
        className="h-8"
        onChange={(e) => {
          // Values held in a custom field are matched inside a JSON document,
          // where the database only accepts a restricted character set. Trim
          // the input as it is typed so the clerk sees exactly what is searched
          // instead of a filter that silently finds nothing.
          const next = column.json ? sanitizeJsonFilterValue(e.target.value) : e.target.value
          onChange(next.trim() === '' ? null : { columnId: column.id, values: [next] })
        }}
      />
    </div>
  )
}

function RangeFilter({
  column,
  value,
  onChange,
}: {
  column: InvoiceColumn
  value: ColumnFilterSpec | undefined
  onChange: (next: ColumnFilterSpec | null) => void
}) {
  const inputType = column.kind === 'date' ? 'date' : 'number'
  function update(patch: { from?: string; to?: string }) {
    const next = { columnId: column.id, from: value?.from ?? '', to: value?.to ?? '', ...patch }
    if (!next.from && !next.to) onChange(null)
    else onChange({ columnId: column.id, from: next.from || undefined, to: next.to || undefined })
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="flex flex-col gap-1">
        <Label className="text-[11px] text-muted-foreground">From</Label>
        <Input
          type={inputType}
          className="h-8"
          value={value?.from ?? ''}
          onChange={(e) => update({ from: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-[11px] text-muted-foreground">To</Label>
        <Input
          type={inputType}
          className="h-8"
          value={value?.to ?? ''}
          onChange={(e) => update({ to: e.target.value })}
        />
      </div>
    </div>
  )
}

function ListFilter({
  column,
  value,
  options,
  onChange,
}: {
  column: InvoiceColumn
  value: ColumnFilterSpec | undefined
  options: ColumnFilterOption[]
  onChange: (next: ColumnFilterSpec | null) => void
}) {
  const selected = value?.values ?? []
  const choices = options.length > 0 ? options : fallbackChoices(column)

  if (choices.length === 0) {
    return <p className="text-xs text-muted-foreground">Nothing to choose from yet.</p>
  }

  return (
    <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
      {choices.map((choice) => {
        const id = `filter-${column.id}-${choice.value}`
        const checked = selected.includes(choice.value)
        return (
          <Label
            key={choice.value}
            htmlFor={id}
            className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm font-normal hover:bg-accent"
          >
            <Checkbox
              id={id}
              checked={checked}
              onCheckedChange={(next) => {
                const values = next
                  ? [...selected, choice.value]
                  : selected.filter((v) => v !== choice.value)
                onChange(values.length === 0 ? null : { columnId: column.id, values })
              }}
            />
            <span className="flex-1 truncate">{choice.label}</span>
          </Label>
        )
      })}
    </div>
  )
}

/** Choice lists that come from the column definition itself rather than the database. */
function fallbackChoices(column: InvoiceColumn): ColumnFilterOption[] {
  if (column.kind === 'boolean') {
    return [
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' },
    ]
  }
  return (column.options ?? []).map((value) => ({ value, label: value }))
}
