'use client'

import { useQuery } from '@tanstack/react-query'
import { Save, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TableCell, TableRow } from '@/components/ui/table'
import { Money } from '../money'
import { LookupSelect } from './lookup-select'
import { computeLine } from '@/backend/lib/tax-math'
import { fetchCodableGlAccounts } from '@/backend/actions/gl-mapping-actions'
import type { CodingLine, CodingOptions, Tax } from './types'

/**
 * The GL accounts this coder may pick, on their own query key.
 *
 * It cannot ride on the shared `lookups` cache: that one is seeded from the
 * page's server render, and with `staleTime: Infinity` a seeded query never
 * refetches — the unfiltered server-rendered list would win forever. Every row
 * on the screen shares this key, so the whole table costs one request.
 */
function useCodableGlAccounts() {
  return useQuery({
    queryKey: ['codable-gl-accounts'],
    queryFn: () => fetchCodableGlAccounts(),
  })
}

export function CodingRow({
  line,
  opts,
  taxById,
  onUpdate,
  onSave,
  onRemove,
}: {
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

  const { data: codable, isPending: codableLoading } = useCodableGlAccounts()
  // Until the permitted list arrives, offer nothing rather than the page's
  // unfiltered server-rendered catalogue — a GL that flashes up and then
  // disappears is worse than a moment's wait.
  const glOptions = codable?.glAccounts ?? []
  const owningDepartment = codable?.glAccounts.find(
    (g) => String(g.id) === String(line.glAccount?.id ?? ''),
  )?.owningDepartmentName

  return (
    <TableRow>
      <TableCell>
        <LookupSelect
          value={line.glAccount?.id ? String(line.glAccount.id) : ''}
          onChange={(id) =>
            onUpdate({
              glAccount: id ? (glOptions.find((g) => String(g.id) === id) as never) : null,
            })
          }
          options={glOptions.map((g) => ({ id: String(g.id), label: `${g.code} — ${g.description}` }))}
          placeholder={codableLoading ? 'Loading GL accounts…' : 'Select GL…'}
          disabled={codableLoading}
          emptyMessage={codable?.message ?? 'No GL accounts are available to you.'}
        />
        {owningDepartment ? (
          <p className="mt-1 text-[10px] text-muted-foreground">Approval routes to {owningDepartment}.</p>
        ) : null}
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
