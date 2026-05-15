'use client'

import { Save, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TableCell, TableRow } from '@/components/ui/table'
import { Money } from '../money'
import { LookupSelect } from './lookup-select'
import { computeLine } from '@/backend/lib/tax-math'
import type { CodingLine, CodingOptions, Tax } from './types'

export function CodingRow({
  idx,
  line,
  opts,
  taxById,
  onUpdate,
  onSave,
  onRemove,
}: {
  idx: number
  line: CodingLine
  opts: CodingOptions
  taxById: Map<string, Tax>
  onUpdate: (patch: Partial<CodingLine>) => void
  onSave: () => void
  onRemove: () => void
}) {
  const tax = line.taxCode ? taxById.get(String(line.taxCode.id)) : null
  const computed = tax
    ? computeLine({ amount: line.amount || 0, rate: tax.rate, recoverablePct: tax.recoverablePct })
    : { taxAmount: 0, recoverable: 0, nonRecoverable: 0 }

  return (
    <TableRow>
      <TableCell>
        <LookupSelect
          value={line.glAccount?.id ? String(line.glAccount.id) : ''}
          onChange={(id) =>
            onUpdate({
              glAccount: id ? (opts.gls.find((g) => String(g.id) === id) as never) : null,
            })
          }
          options={opts.gls.map((g) => ({ id: String(g.id), label: `${g.code} — ${g.description}` }))}
          placeholder="Select GL…"
        />
      </TableCell>
      <TableCell>
        <LookupSelect
          value={line.costCenter?.id ? String(line.costCenter.id) : ''}
          onChange={(id) =>
            onUpdate({
              costCenter: id ? (opts.costCenters.find((d) => String(d.id) === id) as never) : null,
            })
          }
          options={opts.costCenters.map((d) => ({ id: String(d.id), label: `${d.code} — ${d.description}` }))}
          placeholder="—"
        />
      </TableCell>
      <TableCell>
        <LookupSelect
          value={line.project?.id ? String(line.project.id) : ''}
          onChange={(id) =>
            onUpdate({
              project: id ? (opts.projects.find((d) => String(d.id) === id) as never) : null,
            })
          }
          options={opts.projects.map((d) => ({ id: String(d.id), label: `${d.code} — ${d.description}` }))}
          placeholder="—"
        />
      </TableCell>
      <TableCell className="text-right">
        <Input
          type="number"
          step="0.01"
          value={line.amount}
          onChange={(e) => onUpdate({ amount: parseFloat(e.target.value || '0') })}
          className="h-8 text-right tabular-nums"
        />
      </TableCell>
      <TableCell>
        <LookupSelect
          value={line.taxCode?.id ? String(line.taxCode.id) : ''}
          onChange={(id) =>
            onUpdate({
              taxCode: id ? (opts.taxCodes.find((t) => String(t.id) === id) as never) : null,
            })
          }
          options={opts.taxCodes.map((t) => ({ id: String(t.id), label: t.code }))}
          placeholder="—"
        />
      </TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">
        <Money value={computed.taxAmount} />
      </TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">
        <Money value={computed.recoverable} />
      </TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">
        <Money value={computed.nonRecoverable} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          {line._dirty ? (
            <Badge variant="secondary" className="text-[10px]">
              unsaved
            </Badge>
          ) : null}
          <Button size="icon" variant="ghost" onClick={onSave} title="Save line">
            <Save className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onRemove} title="Remove line">
            <Trash2 className="h-3.5 w-3.5 text-red-600" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
