import { Money } from '../../money'
import type { InvoiceViewLine } from '../types'

export function CodingTab({
  lines,
  totals,
}: {
  invoiceId: string | number
  lines: InvoiceViewLine[]
  totals: { subtotal: number; tax: number; total: number }
}) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">GL Account</th>
              <th className="px-3 py-2">Cost Center</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2">Tax Code</th>
              <th className="px-3 py-2 text-right">Tax $</th>
              <th className="px-3 py-2 text-right">Recoverable</th>
              <th className="px-3 py-2 text-right">Non-Rec.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lines.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  No coded lines yet. Open the Coding screen to add lines.
                </td>
              </tr>
            ) : (
              lines.map((l) => (
                <tr key={String(l.id)}>
                  <td className="px-3 py-2 font-mono text-xs">{l.glAccount?.code ?? '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{l.costCenter?.code ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <Money value={l.amount} />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{l.taxCode?.code ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <Money value={l.taxAmount} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    <Money value={l.recoverable} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    <Money value={l.nonRecoverable} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="bg-muted/30 text-sm font-medium">
            <tr>
              <td className="px-3 py-2 text-right" colSpan={2}>
                Totals
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                <Money value={totals.subtotal} />
              </td>
              <td></td>
              <td className="px-3 py-2 text-right tabular-nums">
                <Money value={totals.tax} />
              </td>
              <td className="px-3 py-2 text-right tabular-nums" colSpan={2}>
                <Money value={totals.total} className="font-semibold" />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
