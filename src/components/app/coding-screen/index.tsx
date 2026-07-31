'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { unwrap } from '@/lib/action-result'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { saveLine, deleteLine } from '@/backend/actions/invoice'
import { fetchCodingGate, submitDepartmentCoding } from '@/backend/actions/invoice/coding'
import { computeLine } from '@/backend/lib/tax-math'
import {
  DEFAULT_CODING_RULES,
  evaluateCodingCompleteness,
} from '@/backend/lib/coding-completeness'
import { useLookups, queryKeys, type LookupsPayload } from '@/hooks/use-ap-queries'

import { CodingHeaderBar } from './header-bar'
import { CodingPreviewPane } from './preview-pane'
import { MismatchBanner } from './mismatch-banner'
import { CodingTable } from './coding-table'
import type {
  CodingLine,
  CodingOptions,
  CodingScreenInvoice,
  PreviewDocument,
} from './types'

export type { CodingLine } from './types'

export function CodingScreen({
  invoice,
  lines: initialLines,
  documents,
  options: initialOptions,
}: {
  invoice: CodingScreenInvoice
  lines: CodingLine[]
  documents?: PreviewDocument[]
  options: CodingOptions
}) {
  // Seed TanStack from SSR — same-session navigation between Coding screens
  // reuses the cached catalog, skipping the round-trip.
  const seed: LookupsPayload = {
    glAccounts: initialOptions.gls as never,
    taxCodes: initialOptions.taxCodes as never,
    costCenters: initialOptions.costCenters as never,
    projects: initialOptions.projects as never,
    funds: initialOptions.funds as never,
    vendors: [],
  }
  const { data: lookups } = useLookups(seed)
  const opts: CodingOptions = {
    gls: (lookups?.glAccounts ?? initialOptions.gls) as never,
    taxCodes: (lookups?.taxCodes ?? initialOptions.taxCodes) as never,
    costCenters: (lookups?.costCenters ?? initialOptions.costCenters) as never,
    projects: (lookups?.projects ?? initialOptions.projects) as never,
    funds: (lookups?.funds ?? initialOptions.funds) as never,
  }

  const activeDoc = documents?.[0]
  const [lines, setLines] = useState<CodingLine[]>(() => initialLines)
  const [previewCollapsed, setPreviewCollapsed] = useState(false)
  const [, startTransition] = useTransition()
  const router = useRouter()
  const qc = useQueryClient()

  // Re-seed the editable rows when the server sends a different set (a save,
  // or navigating to another invoice). Adjusting state during render is React's
  // own answer for "reset state when a prop changes" — the effect version ran a
  // render late, and tripped `react-hooks/set-state-in-effect`.
  const [seededFrom, setSeededFrom] = useState(initialLines)
  if (seededFrom !== initialLines) {
    setSeededFrom(initialLines)
    setLines(initialLines)
  }

  const taxById = useMemo(
    () => new Map(opts.taxCodes.map((t) => [String(t.id), t])),
    [opts.taxCodes],
  )

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

  // The sum-match rule and the multi-department carve-out both live server-side;
  // this read only mirrors them so the coder is told what is missing before they
  // walk to the invoice screen and press Approve.
  const { data: gate } = useQuery({
    queryKey: ['coding-gate', String(invoice.id)] as const,
    queryFn: () => fetchCodingGate(invoice.id),
  })
  const rules = gate?.rules ?? DEFAULT_CODING_RULES
  const gateEnforced = gate?.enforced ?? true

  // Evaluated against the lines currently on screen, including unsaved edits,
  // rather than against the server's copy — otherwise the banner lags a save.
  const verdict = useMemo(
    () =>
      evaluateCodingCompleteness({
        rules,
        lines: lines.map((l, i) => ({
          id: l.id ?? l._localId ?? i,
          amount: l.amount || 0,
          hasGlAccount: Boolean(l.glAccount),
        })),
        subtotal: invoice.subtotal,
        grandTotal: invoice.grandTotal,
        // Always evaluated as if enforced: an early coder on a multi-department
        // invoice is not blocked, but still deserves to see the shortfall. The
        // banner labels the difference.
        enforce: true,
      }),
    [rules, lines, invoice.subtotal, invoice.grandTotal],
  )

  const subtotalMismatch = Math.abs(totals.subtotal - invoice.subtotal) > rules.tolerance

  const outstanding = gate?.outstandingDepartments ?? []
  // The submission marker only means something once several departments share
  // the invoice; with one department the plain rule applies and there is
  // nothing to hand off.
  const showDepartmentSubmit = outstanding.length > 1

  function submitMyDepartment(departmentId: string | number, departmentName: string) {
    startTransition(async () => {
      try {
        unwrap(await submitDepartmentCoding(invoice.id, departmentId))
        await qc.invalidateQueries({ queryKey: ['coding-gate', String(invoice.id)] })
        await qc.invalidateQueries({ queryKey: queryKeys.invoice(invoice.id) })
        toast.success(`${departmentName} coding submitted`)
      } catch (err) {
        console.error('[coding-gate] department submission failed', {
          invoiceId: invoice.id,
          departmentId,
          err,
        })
        toast.error((err as Error).message || 'Could not submit this department’s coding')
      }
    })
  }

  function updateLine(idx: number, patch: Partial<CodingLine>) {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch, _dirty: true } : l)))
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
        // Unwrapped so a GL restriction refusal ("that code belongs to another
        // department") reaches the toast instead of being silently discarded.
        unwrap(
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
          }),
        )
        toast.success('Line saved')
        // SSR (re-fetched via router.refresh) feeds CodingScreen's own props,
        // but InvoiceView reads lines from the TanStack invoice cache — drop
        // that cache so navigating back to /requests/[id] shows fresh data.
        await qc.invalidateQueries({ queryKey: queryKeys.invoice(invoice.id) })
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
      await qc.invalidateQueries({ queryKey: queryKeys.invoice(invoice.id) })
      router.refresh()
    })
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden">
      <CodingHeaderBar
        invoice={invoice}
        totalsSubtotal={totals.subtotal}
        subtotalMismatch={subtotalMismatch}
      />

      <div
        className={cn(
          'grid flex-1 gap-3 overflow-hidden',
          previewCollapsed ? 'grid-cols-[44px_1fr]' : 'grid-cols-[1fr_1.4fr]',
        )}
      >
        <CodingPreviewPane
          collapsed={previewCollapsed}
          setCollapsed={setPreviewCollapsed}
          activeDoc={activeDoc}
          invoiceNumber={invoice.invoiceNumber}
        />

        <Card className="flex flex-col overflow-hidden">
          <Tabs
            value="coding"
            onValueChange={(next) => {
              // Tabs other than Coding live on the invoice view page — mirror
              // the navigation contract of InvoiceView so the user gets unified
              // tab bars on both screens.
              if (next === 'coding') return
              router.push(`/requests/${invoice.id}?tab=${next}`)
            }}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <TabsList className="m-2 mb-0 grid w-fit grid-cols-5">
              <TabsTrigger value="header">Header</TabsTrigger>
              <TabsTrigger value="coding">Coding</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="log">Log</TabsTrigger>
            </TabsList>
            <TabsContent value="coding" className="m-0 flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {verdict.reasons.length > 0 ? (
                  <MismatchBanner
                    verdict={verdict}
                    enforced={gateEnforced}
                    outstandingDepartments={outstanding}
                  />
                ) : null}
                {showDepartmentSubmit ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
                    <span className="text-muted-foreground">
                      Finished your department’s lines? Submit them so the remaining departments can
                      finish the invoice.
                    </span>
                    {outstanding.map((d) => (
                      <Button
                        key={String(d.id)}
                        size="sm"
                        variant="outline"
                        onClick={() => submitMyDepartment(d.id, d.name)}
                      >
                        Submit {d.name} coding
                      </Button>
                    ))}
                  </div>
                ) : null}
                <CodingTable
                  lines={lines}
                  opts={opts}
                  taxById={taxById}
                  totals={totals}
                  onAdd={addLine}
                  onUpdate={updateLine}
                  onSave={saveRow}
                  onRemove={removeRow}
                />
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}
