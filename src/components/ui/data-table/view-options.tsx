'use client'

import type { Table } from '@tanstack/react-table'
import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'

/**
 * Column visibility toggle.
 *
 * Implementation note: we intentionally do NOT use Radix's
 * `DropdownMenuCheckboxItem`. In our setup the dropdown stays open across
 * multiple toggles (so the user can hide several columns at once), and during
 * that window Radix's portaled CheckboxItem can lag in updating its
 * `data-state` attribute — the column hides in the table but the checkmark
 * stays visible. Using a regular `DropdownMenuItem`-like row that wraps a
 * standalone `Checkbox` sidesteps the issue: the Checkbox is a normal
 * controlled component whose `checked` prop drives its indicator every render.
 *
 * Filtering is by `getCanHide()` only. The earlier `accessorFn !== undefined`
 * filter silently dropped columns that only had an `id` + custom `accessorFn`
 * (e.g. the Stage column) on some TanStack v8 paths.
 */
export function DataTableViewOptions<TData>({ table }: { table: Table<TData> }) {
  // Opt out of React Compiler auto-memoization. `table` is a stable reference,
  // so the compiler would consider this component's inputs unchanged across
  // renders and skip re-execution — but `table.getState().columnVisibility` IS
  // a reactive read whose result changes per render. Without this directive,
  // toggling a checkbox hides the column but the checkmark icon stays.
  'use no memo'
  const visibility = table.getState().columnVisibility
  const columns = table.getAllLeafColumns().filter((c) => c.getCanHide())

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9">
          <Settings2 className="mr-1.5 h-3.5 w-3.5" />
          View
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[220px] p-1">
        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => {
          const meta = column.columnDef.meta as { label?: string } | undefined
          const isVisible = visibility[column.id] !== false
          const id = `view-toggle-${column.id}`
          return (
            <Label
              key={column.id}
              htmlFor={id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-normal hover:bg-accent hover:text-accent-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <Checkbox
                id={id}
                checked={isVisible}
                onCheckedChange={(v) => column.toggleVisibility(!!v)}
              />
              <span className="flex-1">{meta?.label ?? column.id}</span>
            </Label>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
