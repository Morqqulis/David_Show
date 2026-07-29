'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function LookupSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  emptyMessage,
}: {
  value: string
  onChange: (id: string) => void
  options: Array<{ id: string; label: string }>
  placeholder?: string
  disabled?: boolean
  /**
   * Shown in place of the list when there is nothing to choose. Without it an
   * empty dropdown opens onto blank space and reads as a broken screen rather
   * than as "you have no options here".
   */
  emptyMessage?: string
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-8 w-full text-xs">
        <SelectValue placeholder={placeholder ?? 'Select…'} />
      </SelectTrigger>
      <SelectContent>
        {options.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            {emptyMessage ?? 'Nothing available.'}
          </p>
        ) : (
          options.map((opt) => (
            <SelectItem key={opt.id} value={opt.id} className="text-xs">
              {opt.label}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  )
}
