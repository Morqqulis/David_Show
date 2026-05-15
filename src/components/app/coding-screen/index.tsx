'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { saveLine, deleteLine } from '@/backend/actions/invoice'
import { computeLine } from '@/backend/lib/tax-math'
import { useLookups, type LookupsPayload } from '@/hooks/use-ap-queries'

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

  useEffect(() => {
    setLines(initialLines)
  }, [initialLines])

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

  const subtotalMismatch = Math.abs(totals.subtotal - invoice.subtotal) > 0.01

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
          <Tabs defaultValue="coding" className="flex flex-1 flex-col overflow-hidden">
            <TabsList className="m-2 mb-0 grid w-fit grid-cols-5">
              <TabsTrigger value="coding">Coding</TabsTrigger>
              <TabsTrigger value="header" disabled>
                Header
              </TabsTrigger>
              <TabsTrigger value="files" disabled>
                Files
              </TabsTrigger>
              <TabsTrigger value="notes" disabled>
                Notes
              </TabsTrigger>
              <TabsTrigger value="log" disabled>
                Log
              </TabsTrigger>
            </TabsList>
            <TabsContent value="coding" className="m-0 flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {subtotalMismatch ? (
                  <MismatchBanner linesSum={totals.subtotal} headerSubtotal={invoice.subtotal} />
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
