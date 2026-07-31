'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { unwrap } from '@/lib/action-result'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PREBUILT_INVOICE_SOURCE_FIELDS } from '@/backend/lib/intake-field-mapping'
import { deleteOcrMappingRow, upsertOcrMappingRow } from '@/backend/actions/intake-settings-actions'

export type MappingRow = {
  id: string | number
  appField: string
  sourceField: string
  enabled: boolean
  order: number
}

export type AppFieldOption = { key: string; label: string }

// One evolving pill for this table, however fast the admin edits.
const TOAST_ID = 'ocr-mapping-save'

/**
 * Which reading from a scanned invoice fills which field in this app.
 *
 * A table rather than a list of switches: the fields are set up differently for
 * every municipality, so without being told where a value belongs the reading
 * has nowhere to put it.
 */
export function OcrMappingTable({
  rows: initialRows,
  appFields,
}: {
  rows: MappingRow[]
  appFields: AppFieldOption[]
}) {
  const [rows, setRows] = useState(initialRows)
  const [, startTransition] = useTransition()
  const tmpCounter = useRef(0)

  const sourceLabel = (name: string) =>
    PREBUILT_INVOICE_SOURCE_FIELDS.find((f) => f.name === name)?.label ?? name

  function patchRow(row: MappingRow, patch: Partial<MappingRow>) {
    const previous = rows
    const next = { ...row, ...patch }
    setRows((cur) => cur.map((r) => (String(r.id) === String(row.id) ? next : r)))

    startTransition(async () => {
      try {
        unwrap(
          await upsertOcrMappingRow(row.id, {
            appField: next.appField,
            sourceField: next.sourceField,
            enabled: next.enabled,
            order: next.order,
          }),
        )
        toast.success('Reading rule saved', { id: TOAST_ID, duration: 1500 })
      } catch (err) {
        setRows(previous)
        console.error('[intake] saving a reading rule failed', {
          id: row.id,
          appField: next.appField,
          sourceField: next.sourceField,
          err,
        })
        toast.error(err instanceof Error ? err.message : 'Could not save — change rolled back', {
          id: TOAST_ID,
        })
      }
    })
  }

  function addRow() {
    const used = new Set(rows.map((r) => r.appField))
    const target = appFields.find((f) => !used.has(f.key)) ?? appFields[0]
    if (!target) {
      toast.error('There are no fields left to map.', { id: TOAST_ID })
      return
    }

    tmpCounter.current += 1
    const tmpId = `tmp-${tmpCounter.current}-${Math.random().toString(36).slice(2, 7)}`
    const draft: MappingRow = {
      id: tmpId,
      appField: target.key,
      sourceField: PREBUILT_INVOICE_SOURCE_FIELDS[0].name,
      enabled: true,
      order: rows.length,
    }
    setRows((cur) => [...cur, draft])

    startTransition(async () => {
      try {
        const created = unwrap(
          await upsertOcrMappingRow(null, {
            appField: draft.appField,
            sourceField: draft.sourceField,
            enabled: draft.enabled,
            order: draft.order,
          }),
        )
        setRows((cur) => cur.map((r) => (r.id === tmpId ? { ...r, id: created.id } : r)))
        toast.success('Reading rule added', { id: TOAST_ID, duration: 1500 })
      } catch (err) {
        setRows((cur) => cur.filter((r) => r.id !== tmpId))
        console.error('[intake] adding a reading rule failed', { appField: draft.appField, err })
        toast.error('Could not save — change rolled back', { id: TOAST_ID })
      }
    })
  }

  function removeRow(row: MappingRow) {
    const previous = rows
    setRows((cur) => cur.filter((r) => String(r.id) !== String(row.id)))
    startTransition(async () => {
      try {
        await deleteOcrMappingRow(row.id)
        toast.success('Reading rule removed', { id: TOAST_ID, duration: 1500 })
      } catch (err) {
        setRows(previous)
        console.error('[intake] removing a reading rule failed', { id: row.id, err })
        toast.error('Could not remove — change rolled back', { id: TOAST_ID })
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={addRow}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add a rule
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Field in this app</TableHead>
            <TableHead>Filled from</TableHead>
            <TableHead className="w-24">In use</TableHead>
            <TableHead className="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                No rules yet, so nothing is filled in automatically. Add one to start.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={String(row.id)}>
                <TableCell>
                  <Select value={row.appField} onValueChange={(appField) => patchRow(row, { appField })}>
                    <SelectTrigger className="w-56">
                      <SelectValue placeholder="Choose a field" />
                    </SelectTrigger>
                    <SelectContent>
                      {appFields.map((field) => (
                        <SelectItem key={field.key} value={field.key}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={row.sourceField} onValueChange={(sourceField) => patchRow(row, { sourceField })}>
                    <SelectTrigger className="w-72">
                      <SelectValue placeholder="Choose a reading">{sourceLabel(row.sourceField)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {PREBUILT_INVOICE_SOURCE_FIELDS.map((field) => (
                        <SelectItem key={field.name} value={field.name}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Switch checked={row.enabled} onCheckedChange={(enabled) => patchRow(row, { enabled })} />
                </TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => removeRow(row)}>
                    <Trash2 className="h-3.5 w-3.5 text-red-600" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
