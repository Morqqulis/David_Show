'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Save, Trash2, AlertTriangle, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Money } from './money'
import { Badge } from '@/components/ui/badge'
import { computeLine } from '@/backend/lib/tax-math'
import { saveLine, deleteLine } from '@/backend/actions/invoice-actions'
import { StageBadge } from './stage-badge'
import type { StageId } from '@/backend/lib/stage-ids'

type GL = { id: string | number; code: string; description: string }
type Tax = { id: string | number; code: string; rate: number; recoverablePct: number }
type Dim = { id: string | number; code: string; description: string }

export type CodingLine = {
  id: string | number | null
  glAccount?: { id: string | number; code: string; description: string } | null
  costCenter?: { id: string | number; code: string; description: string } | null
  project?: { id: string | number; code: string; description: string } | null
  fund?: { id: string | number; code: string; description: string } | null
  amount: number
  taxCode?: { id: string | number; code: string; rate?: number; recoverablePct?: number } | null
  taxAmount: number
  recoverable: number
  nonRecoverable: number
  description?: string | null
  _dirty?: boolean
  _localId?: string
}

export function CodingScreen({
  invoice,
  lines: initialLines,
  options,
}: {
  invoice: {
    id: string | number
    invoiceNumber: string
    vendor?: { name: string }
    subtotal: number
    totalTax: number
    grandTotal: number
    currentStage?: { systemId: StageId; label?: string }
  }
  lines: CodingLine[]
  options: {
    gls: GL[]
    taxCodes: Tax[]
    costCenters: Dim[]
    projects: Dim[]
    funds: Dim[]
  }
}) {
  const [lines, setLines] = useState<CodingLine[]>(() => initialLines)
  const [previewCollapsed, setPreviewCollapsed] = useState(false)
  const [, startTransition] = useTransition()
  const router = useRouter()

  useEffect(() => {
    setLines(initialLines)
  }, [initialLines])

  const taxById = useMemo(() => new Map(options.taxCodes.map((t) => [String(t.id), t])), [options.taxCodes])

  const totals = useMemo(() => {
    return lines.reduce(
      (acc, l) => {
        const tax = l.taxCode ? taxById.get(String(l.taxCode.id)) : null
        const computed = tax
          ? computeLine({ amount: l.amount || 0, rate: tax.rate, recoverablePct: tax.recoverablePct })
          : { amount: l.amount || 0, taxAmount: 0, recoverable: 0, nonRecoverable: 0, lineTotal: l.amount || 0 }
        return {
          subtotal: acc.subtotal + computed.amount,
          tax: acc.tax + computed.taxAmount,
          recoverable: acc.recoverable + computed.recoverable,
          nonRecoverable: acc.nonRecoverable + computed.nonRecoverable,
          total: acc.total + computed.lineTotal,
        }
      },
      { subtotal: 0, tax: 0, recoverable: 0, nonRecoverable: 0, total: 0 },
    )
  }, [lines, taxById])

  const subtotalMismatch = Math.abs(totals.subtotal - invoice.subtotal) > 0.01

  function updateLine(idx: number, patch: Partial<CodingLine>) {
    setLines((ls) =>
      ls.map((l, i) => (i === idx ? { ...l, ...patch, _dirty: true } : l)),
    )
  }

  function addLine() {
    setLines((ls) => [
      ...ls,
      {
        id: null,
        amount: 0,
        taxAmount: 0,
        recoverable: 0,
        nonRecoverable: 0,
        _dirty: true,
        _localId: `tmp-${Math.random().toString(36).slice(2)}`,
      },
    ])
  }

  function saveRow(idx: number) {
    const line = lines[idx]
    startTransition(async () => {
      try {
        await saveLine({
          id: line.id ?? undefined,
          invoice: invoice.id,
          order: idx + 1,
          glAccount: line.glAccount?.id ?? null,
          costCenter: line.costCenter?.id ?? null,
          project: line.project?.id ?? null,
          fund: line.fund?.id ?? null,
          amount: line.amount || 0,
          taxCode: line.taxCode?.id ?? null,
          description: line.description ?? null,
        })
        toast.success('Line saved')
        router.refresh()
      } catch (e) {
        toast.error((e as Error).message)
      }
    })
  }

  function removeRow(idx: number) {
    const line = lines[idx]
    if (!line.id) {
      setLines((ls) => ls.filter((_, i) => i !== idx))
      return
    }
    startTransition(async () => {
      await deleteLine(line.id!)
      toast.success('Line removed')
      router.refresh()
    })
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">{invoice.invoiceNumber} — Coding</CardTitle>
            {invoice.currentStage ? <StageBadge stage={invoice.currentStage as never} /> : null}
            <span className="text-sm text-muted-foreground">{invoice.vendor?.name ?? '—'}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div>
              Header subtotal: <Money value={invoice.subtotal} className="font-semibold text-foreground" />
            </div>
            <div>
              Σ Lines: <Money value={totals.subtotal} className={cn('font-semibold', subtotalMismatch ? 'text-amber-600' : 'text-foreground')} />
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className={cn('grid flex-1 gap-3 overflow-hidden', previewCollapsed ? 'grid-cols-[44px_1fr]' : 'grid-cols-[1fr_1.4fr]')}>
        <Card className="flex flex-col overflow-hidden">
          {previewCollapsed ? (
            <button
              onClick={() => setPreviewCollapsed(false)}
              className="flex h-full w-full flex-col items-center gap-2 px-2 py-3 text-xs font-medium text-muted-foreground hover:bg-muted"
              title="Expand preview"
            >
              <PanelLeftOpen className="h-4 w-4" />
              <span className="rotate-180 [writing-mode:vertical-rl]">{invoice.invoiceNumber}</span>
            </button>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs">
                <span className="font-medium">{invoice.invoiceNumber}.pdf</span>
                <button
                  onClick={() => setPreviewCollapsed(true)}
                  className="grid h-7 w-7 place-items-center rounded hover:bg-muted"
                >
                  <PanelLeftClose className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex flex-1 items-center justify-center bg-[repeating-linear-gradient(45deg,#f8fafc,#f8fafc_10px,#f1f5f9_10px,#f1f5f9_20px)] text-xs text-muted-foreground">
                <div className="text-center">
                  <div className="font-medium">PDF preview placeholder</div>
                </div>
              </div>
            </>
          )}
        </Card>

        <Card className="flex flex-col overflow-hidden">
          <Tabs defaultValue="coding" className="flex flex-1 flex-col overflow-hidden">
            <TabsList className="m-2 mb-0 grid w-fit grid-cols-5">
              <TabsTrigger value="coding">Coding</TabsTrigger>
              <TabsTrigger value="header" disabled>Header</TabsTrigger>
              <TabsTrigger value="files" disabled>Files</TabsTrigger>
              <TabsTrigger value="notes" disabled>Notes</TabsTrigger>
              <TabsTrigger value="log" disabled>Log</TabsTrigger>
            </TabsList>
            <TabsContent value="coding" className="m-0 flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {subtotalMismatch ? (
                  <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4" />
                    <div>
                      <div className="font-medium">Coded sum doesn't match the header subtotal</div>
                      <div className="text-xs">
                        Σ Lines <Money value={totals.subtotal} /> vs Header Subtotal <Money value={invoice.subtotal} /> — reconcile before
                        advancing past AP Review.
                      </div>
                    </div>
                  </div>
                ) : null}

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
                        lines.map((line, idx) => {
                          const tax = line.taxCode ? taxById.get(String(line.taxCode.id)) : null
                          const computed = tax
                            ? computeLine({ amount: line.amount || 0, rate: tax.rate, recoverablePct: tax.recoverablePct })
                            : { taxAmount: 0, recoverable: 0, nonRecoverable: 0 }
                          return (
                            <TableRow key={String(line.id ?? line._localId ?? idx)}>
                              <TableCell>
                                <LookupSelect
                                  value={line.glAccount?.id ? String(line.glAccount.id) : ''}
                                  onChange={(id) =>
                                    updateLine(idx, {
                                      glAccount: id
                                        ? (options.gls.find((g) => String(g.id) === id) as never)
                                        : null,
                                    })
                                  }
                                  options={options.gls.map((g) => ({ id: String(g.id), label: `${g.code} — ${g.description}` }))}
                                  placeholder="Select GL…"
                                />
                              </TableCell>
                              <TableCell>
                                <LookupSelect
                                  value={line.costCenter?.id ? String(line.costCenter.id) : ''}
                                  onChange={(id) =>
                                    updateLine(idx, {
                                      costCenter: id
                                        ? (options.costCenters.find((d) => String(d.id) === id) as never)
                                        : null,
                                    })
                                  }
                                  options={options.costCenters.map((d) => ({ id: String(d.id), label: `${d.code} — ${d.description}` }))}
                                  placeholder="—"
                                />
                              </TableCell>
                              <TableCell>
                                <LookupSelect
                                  value={line.project?.id ? String(line.project.id) : ''}
                                  onChange={(id) =>
                                    updateLine(idx, {
                                      project: id
                                        ? (options.projects.find((d) => String(d.id) === id) as never)
                                        : null,
                                    })
                                  }
                                  options={options.projects.map((d) => ({ id: String(d.id), label: `${d.code} — ${d.description}` }))}
                                  placeholder="—"
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={line.amount}
                                  onChange={(e) => updateLine(idx, { amount: parseFloat(e.target.value || '0') })}
                                  className="h-8 text-right tabular-nums"
                                />
                              </TableCell>
                              <TableCell>
                                <LookupSelect
                                  value={line.taxCode?.id ? String(line.taxCode.id) : ''}
                                  onChange={(id) =>
                                    updateLine(idx, {
                                      taxCode: id
                                        ? (options.taxCodes.find((t) => String(t.id) === id) as never)
                                        : null,
                                    })
                                  }
                                  options={options.taxCodes.map((t) => ({ id: String(t.id), label: t.code }))}
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
                                  {line._dirty ? <Badge variant="secondary" className="text-[10px]">unsaved</Badge> : null}
                                  <Button size="icon" variant="ghost" onClick={() => saveRow(idx)} title="Save line">
                                    <Save className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={() => removeRow(idx)} title="Remove line">
                                    <Trash2 className="h-3.5 w-3.5 text-red-600" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={3} className="text-right text-xs uppercase tracking-wide text-muted-foreground">
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
                  <Button onClick={addLine} variant="outline" size="sm">
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Add line
                  </Button>
                  <div className="text-sm text-muted-foreground">
                    Grand total (computed): <Money value={totals.total} className="font-semibold text-foreground" />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}

function LookupSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (id: string) => void
  options: Array<{ id: string; label: string }>
  placeholder?: string
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-full text-xs">
        <SelectValue placeholder={placeholder ?? 'Select…'} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.id} value={opt.id} className="text-xs">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
