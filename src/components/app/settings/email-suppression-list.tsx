'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  addSuppressedRecipient,
  deleteSuppressedRecipient,
} from '@/backend/actions/intake-settings-actions'

export type SuppressionRow = {
  id: string | number
  value: string
  kind: 'address' | 'domain' | 'group'
  note: string
}

const KIND_LABELS: Record<SuppressionRow['kind'], string> = {
  address: 'One person',
  domain: 'Everyone at a domain',
  group: 'A team',
}

// One evolving pill for this list, however fast the admin edits.
const TOAST_ID = 'email-suppression-save'

/**
 * People who should not be thanked for every invoice they forward.
 *
 * Managed here by an administrator rather than left as a personal preference,
 * so nobody has to go and find the setting themselves — the AP team in
 * particular forwards invoices all day.
 */
export function EmailSuppressionList({ rows: initialRows }: { rows: SuppressionRow[] }) {
  const [rows, setRows] = useState(initialRows)
  const [draft, setDraft] = useState<{ value: string; kind: SuppressionRow['kind']; note: string }>({
    value: '',
    kind: 'address',
    note: '',
  })
  const [, startTransition] = useTransition()
  const tmpCounter = useRef(0)

  function add() {
    const value = draft.value.trim()
    if (value === '') {
      toast.error('Enter an email address, a domain, or a team name.', { id: TOAST_ID })
      return
    }

    tmpCounter.current += 1
    const tmpId = `tmp-${tmpCounter.current}-${Math.random().toString(36).slice(2, 7)}`
    const row: SuppressionRow = { id: tmpId, value, kind: draft.kind, note: draft.note.trim() }
    setRows((cur) => [...cur, row])
    setDraft({ value: '', kind: draft.kind, note: '' })

    startTransition(async () => {
      try {
        const created = await addSuppressedRecipient({ value, kind: row.kind, note: row.note })
        setRows((cur) => cur.map((r) => (r.id === tmpId ? { ...r, id: created.id } : r)))
        toast.success('Added to the list', { id: TOAST_ID, duration: 1500 })
      } catch (err) {
        setRows((cur) => cur.filter((r) => r.id !== tmpId))
        console.error('[intake] adding a suppressed recipient failed', { kind: row.kind, err })
        toast.error(err instanceof Error ? err.message : 'Could not save — change rolled back', {
          id: TOAST_ID,
        })
      }
    })
  }

  function remove(row: SuppressionRow) {
    const previous = rows
    setRows((cur) => cur.filter((r) => String(r.id) !== String(row.id)))
    startTransition(async () => {
      try {
        await deleteSuppressedRecipient(row.id)
        toast.success('Removed from the list', { id: TOAST_ID, duration: 1500 })
      } catch (err) {
        setRows(previous)
        console.error('[intake] removing a suppressed recipient failed', { id: row.id, err })
        toast.error('Could not remove — change rolled back', { id: TOAST_ID })
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_200px_1fr_auto] sm:items-end">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="suppression-value">Address, domain or team</Label>
          <Input
            id="suppression-value"
            value={draft.value}
            placeholder="finance@aurora.ca"
            onChange={(e) => setDraft({ ...draft, value: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="suppression-kind">What it is</Label>
          <Select
            value={draft.kind}
            onValueChange={(kind) => setDraft({ ...draft, kind: kind as SuppressionRow['kind'] })}
          >
            <SelectTrigger id="suppression-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="address">One person</SelectItem>
              <SelectItem value="domain">Everyone at a domain</SelectItem>
              <SelectItem value="group">A team</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="suppression-note">Why (optional)</Label>
          <Input
            id="suppression-note"
            value={draft.note}
            placeholder="Forwards invoices all day"
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
        </div>
        <Button size="sm" onClick={add}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Address, domain or team</TableHead>
            <TableHead className="w-48">What it is</TableHead>
            <TableHead>Why</TableHead>
            <TableHead className="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                Nobody is on the list, so everyone who emails an invoice in gets a reply confirming it
                arrived.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={String(row.id)}>
                <TableCell className="text-sm">{row.value}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{KIND_LABELS[row.kind]}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{row.note}</TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => remove(row)}>
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
