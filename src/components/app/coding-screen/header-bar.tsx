import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { StageBadge } from '../stage-badge'
import { Money } from '../money'
import type { CodingScreenInvoice } from './types'

export function CodingHeaderBar({
  invoice,
  totalsSubtotal,
  subtotalMismatch,
}: {
  invoice: CodingScreenInvoice
  totalsSubtotal: number
  subtotalMismatch: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div className="flex items-center gap-3">
          <CardTitle className="text-lg">{invoice.invoiceNumber} — Coding</CardTitle>
          {invoice.currentStage ? <StageBadge stage={invoice.currentStage as never} /> : null}
          <span className="text-sm text-muted-foreground">{invoice.vendor?.name ?? '—'}</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <div>
            Header subtotal:{' '}
            <Money value={invoice.subtotal} className="font-semibold text-foreground" />
          </div>
          <div>
            Σ Lines:{' '}
            <Money
              value={totalsSubtotal}
              className={cn('font-semibold', subtotalMismatch ? 'text-amber-600' : 'text-foreground')}
            />
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}
