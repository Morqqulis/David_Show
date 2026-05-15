'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Money } from '../money'
import { CodingRow } from './coding-row'
import type { CodingLine, CodingOptions, Tax } from './types'

type Totals = { subtotal: number; tax: number; recoverable: number; nonRecoverable: number; total: number }

export function CodingTable({
  lines,
  opts,
  taxById,
  totals,
  onAdd,
  onUpdate,
  onSave,
  onRemove,
}: {
  lines: CodingLine[]
  opts: CodingOptions
  taxById: Map<string, Tax>
  totals: Totals
  onAdd: () => void
  onUpdate: (idx: number, patch: Partial<CodingLine>) => void
  onSave: (idx: number) => void
  onRemove: (idx: number) => void
}) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[220px]">GL Account</TableHead>
              <TableHead className="w-[160px]">Cost Center</TableHead>
              <TableHead className="w-[160px]">Project</TableHead>
              <TableHead className="w-[120px] text-right">Amount</TableHead>
              <TableHead className="w-[140px]">Tax Code</TableHead>
              <TableHead className="w-[100px] text-right">Tax $</TableHead>
              <TableHead className="w-[100px] text-right">Recoverable</TableHead>
              <TableHead className="w-[100px] text-right">Non-Rec.</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  No lines yet. Click <strong>Add line</strong> to start coding.
                </TableCell>
              </TableRow>
            ) : (
              lines.map((line, idx) => (
                <CodingRow
                  key={String(line.id ?? line._localId ?? idx)}
                  idx={idx}
                  line={line}
                  opts={opts}
                  taxById={taxById}
                  onUpdate={(patch) => onUpdate(idx, patch)}
                  onSave={() => onSave(idx)}
                  onRemove={() => onRemove(idx)}
                />
              ))
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell
                colSpan={3}
                className="text-right text-xs uppercase tracking-wide text-muted-foreground"
              >
                Totals
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <Money value={totals.subtotal} />
              </TableCell>
              <TableCell></TableCell>
              <TableCell className="text-right tabular-nums">
                <Money value={totals.tax} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <Money value={totals.recoverable} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <Money value={totals.nonRecoverable} />
              </TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
      <div className="flex justify-between">
        <Button onClick={onAdd} variant="outline" size="sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add line
        </Button>
        <div className="text-sm text-muted-foreground">
          Grand total (computed):{' '}
          <Money value={totals.total} className="font-semibold text-foreground" />
        </div>
      </div>
    </div>
  )
}
