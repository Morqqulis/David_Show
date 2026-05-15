import Link from 'next/link'
import type { InvoiceRow } from './types'

export function InlineDetail({ row }: { row: InvoiceRow }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-md border border-border bg-background">
        <div className="border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Invoice preview
        </div>
        <div className="grid h-64 place-items-center bg-[repeating-linear-gradient(45deg,#f8fafc,#f8fafc_10px,#f1f5f9_10px,#f1f5f9_20px)] text-xs text-muted-foreground">
          PDF preview placeholder — {row.invoiceNumber}
        </div>
      </div>
      <div className="rounded-md border border-border bg-background">
        <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span>Coded lines</span>
          <Link href={`/requests/${row.id}/coding`} className="text-[11px] text-primary hover:underline">
            Open coding ↗
          </Link>
        </div>
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">GL</th>
              <th className="px-2 py-1.5 text-left font-medium">Cost Ctr</th>
              <th className="px-2 py-1.5 text-right font-medium">Amount</th>
              <th className="px-2 py-1.5 text-left font-medium">Tax</th>
              <th className="px-2 py-1.5 text-right font-medium">Tax $</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(row.lines ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-center text-muted-foreground">
                  No lines coded yet.
                </td>
              </tr>
            ) : (
              row.lines!.map((l) => (
                <tr key={String(l.id)}>
                  <td className="px-2 py-1.5 font-mono">{l.glAccount?.code ?? '—'}</td>
                  <td className="px-2 py-1.5 font-mono">{l.costCenter?.code ?? '—'}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{l.amount.toFixed(2)}</td>
                  <td className="px-2 py-1.5 font-mono">{l.taxCode?.code ?? '—'}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{l.taxAmount.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
