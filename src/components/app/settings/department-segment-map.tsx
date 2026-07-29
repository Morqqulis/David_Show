'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { ColumnDef } from '@tanstack/react-table'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { DataTableColumnHeader } from '@/components/ui/data-table/column-header'
import { deleteSegmentMapRow, upsertSegmentMapRow } from '@/backend/actions/gl-mapping-actions'
import { compareSegmentValues, rowCovers } from '@/backend/lib/segments'
import {
  DepartmentSegmentRangeDialog,
  type SegmentRangeDraft,
} from './department-segment-range-dialog'
import { UnmappedSubDepartments, type SubDepartmentUsage } from './unmapped-sub-departments'

export type SegmentMapRowView = SegmentRangeDraft & {
  id: string | number
  departmentName: string
}

export type { SubDepartmentUsage }

// One evolving pill for this table, however fast the admin edits.
const TOAST_ID = 'department-segment-map-save'

export function DepartmentSegmentMap({
  rows: initialRows,
  departments,
  usage,
  catchAllDepartmentName,
}: {
  rows: SegmentMapRowView[]
  departments: Array<{ id: string | number; name: string }>
  /** Sub-department values actually present in the GL master, with a count. */
  usage: SubDepartmentUsage[]
  catchAllDepartmentName: string | null
}) {
  const [rows, setRows] = useState(initialRows)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SegmentMapRowView | null>(null)
  const [, startTransition] = useTransition()
  const tmpCounter = useRef(0)

  // The parent re-renders with fresh rows after each server action revalidates
  // the route; adopt them only when the set of ids actually changed, so an
  // in-flight optimistic edit is not clobbered.
  const fingerprint = useMemo(
    () => `${initialRows.length}:${initialRows.map((r) => r.id).join('|')}`,
    [initialRows],
  )
  const lastFingerprint = useRef(fingerprint)
  useEffect(() => {
    if (fingerprint !== lastFingerprint.current) {
      lastFingerprint.current = fingerprint
      setRows(initialRows)
    }
  }, [fingerprint, initialRows])

  const asRules = useMemo(
    () =>
      rows.map((r) => ({
        departmentId: r.department,
        from: r.fromValue,
        to: r.toValue.trim() === '' ? null : r.toValue,
      })),
    [rows],
  )
  const unmapped = useMemo(
    () => usage.filter((u) => !asRules.some((rule) => rowCovers(rule, u.value))),
    [asRules, usage],
  )

  function save(draft: SegmentRangeDraft) {
    const departmentName = departments.find((d) => String(d.id) === draft.department)?.name ?? ''
    const patch = {
      department: draft.department,
      fromValue: draft.fromValue.trim(),
      toValue: draft.toValue.trim() || null,
      note: draft.note.trim() || null,
    }
    setOpen(false)

    if (editing) {
      const id = editing.id
      const previous = rows
      setRows((cur) =>
        cur.map((r) => (String(r.id) === String(id) ? { ...r, ...draft, departmentName } : r)),
      )
      setEditing(null)
      startTransition(async () => {
        try {
          await upsertSegmentMapRow(id, patch)
          toast.success('Sub-department range saved', { id: TOAST_ID, duration: 1500 })
        } catch (err) {
          setRows(previous)
          console.error('[gl-mapping] saving a sub-department range failed', { id, patch, err })
          toast.error('Could not save — change rolled back', { id: TOAST_ID })
        }
      })
      return
    }

    tmpCounter.current += 1
    const tmpId = `tmp-${tmpCounter.current}-${Math.random().toString(36).slice(2, 7)}`
    setRows((cur) => [...cur, { id: tmpId, ...draft, departmentName }])
    setEditing(null)
    startTransition(async () => {
      try {
        const created = await upsertSegmentMapRow(null, patch)
        setRows((cur) => cur.map((r) => (r.id === tmpId ? { ...r, id: created.id } : r)))
        toast.success('Sub-department range added', { id: TOAST_ID, duration: 1500 })
      } catch (err) {
        setRows((cur) => cur.filter((r) => r.id !== tmpId))
        console.error('[gl-mapping] adding a sub-department range failed', { patch, err })
        toast.error('Could not save — change rolled back', { id: TOAST_ID })
      }
    })
  }

  function remove(row: SegmentMapRowView) {
    if (!confirm('Delete this sub-department range?')) return
    const previous = rows
    setRows((cur) => cur.filter((r) => String(r.id) !== String(row.id)))
    startTransition(async () => {
      try {
        await deleteSegmentMapRow(row.id)
        toast.success('Sub-department range deleted', { id: TOAST_ID, duration: 1500 })
      } catch (err) {
        setRows(previous)
        console.error('[gl-mapping] deleting a sub-department range failed', { id: row.id, err })
        toast.error('Could not delete — change rolled back', { id: TOAST_ID })
      }
    })
  }

  const columns = useMemo<ColumnDef<SegmentMapRowView>[]>(
    () => [
      {
        id: 'range',
        accessorFn: (row) => row.fromValue,
        meta: { label: 'Sub-departments' },
        sortingFn: (a, b) => compareSegmentValues(a.original.fromValue, b.original.fromValue),
        header: ({ column }) => <DataTableColumnHeader column={column} title="Sub-departments" />,
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.toValue
              ? `${row.original.fromValue} to ${row.original.toValue}`
              : row.original.fromValue}
            {row.original.toValue ? null : (
              <Badge variant="outline" className="ml-2 font-sans text-[10px]">
                single
              </Badge>
            )}
          </span>
        ),
      },
      {
        id: 'department',
        accessorFn: (row) => row.departmentName,
        meta: { label: 'Department' },
        header: ({ column }) => <DataTableColumnHeader column={column} title="Department" />,
        cell: ({ row }) => <span className="font-medium">{row.original.departmentName || '—'}</span>,
      },
      {
        id: 'covers',
        enableSorting: false,
        meta: { label: 'GL accounts' },
        header: () => (
          <span className="text-xs uppercase tracking-wide text-muted-foreground">GL accounts</span>
        ),
        cell: ({ row }) => {
          const rule = {
            departmentId: row.original.department,
            from: row.original.fromValue,
            to: row.original.toValue.trim() === '' ? null : row.original.toValue,
          }
          const covered = usage.reduce((sum, u) => (rowCovers(rule, u.value) ? sum + u.glCount : sum), 0)
          return <span className="text-xs tabular-nums text-muted-foreground">{covered}</span>
        },
      },
      {
        id: 'note',
        accessorFn: (row) => row.note,
        enableSorting: false,
        meta: { label: 'Note' },
        header: () => (
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Note</span>
        ),
        cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.note}</span>,
      },
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
            <Button size="icon" variant="ghost" onClick={() => remove(row.original)}>
              <Trash2 className="h-3.5 w-3.5 text-red-600" />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [usage, rows],
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => {
            setEditing(null)
            setOpen(true)
          }}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add range
        </Button>
      </div>

      <DataTable<SegmentMapRowView>
        columns={columns}
        data={rows}
        getRowId={(row) => String(row.id)}
        initialSorting={[{ id: 'range', desc: false }]}
        emptyMessage="No sub-department ranges yet. Every GL account goes to the catch-all department until you add one."
      />

      <UnmappedSubDepartments values={unmapped} catchAllDepartmentName={catchAllDepartmentName} />

      <DepartmentSegmentRangeDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) setEditing(null)
        }}
        editing={editing}
        departments={departments}
        onSubmit={save}
      />
    </div>
  )
}
