import { Check, Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { StageBadge } from '../stage-badge'
import { Money } from '../money'
import { formatDate } from '@/backend/lib/formatting'
import type { InvoiceViewInvoice } from './types'

export function InvoiceHeaderBar({ inv }: { inv: InvoiceViewInvoice }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{inv.invoiceNumber}</h1>
        {inv.currentStage ? <StageBadge stage={inv.currentStage as never} /> : null}
        {inv.confidential ? (
          <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50 text-amber-800">
            <Lock className="h-3 w-3" /> Confidential
          </Badge>
        ) : null}
        {inv.verified ? (
          <Badge variant="outline" className="gap-1 border-green-200 bg-green-50 text-green-800">
            <Check className="h-3 w-3" /> Verified
          </Badge>
        ) : null}
      </div>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>
          Vendor: <span className="font-medium text-foreground">{inv.vendor?.name ?? '—'}</span>
        </span>
        <Separator orientation="vertical" className="h-4" />
        <span>
          Date: <span className="font-medium text-foreground">{formatDate(inv.invoiceDate)}</span>
        </span>
        <Separator orientation="vertical" className="h-4" />
        <span>
          Total: <Money value={inv.grandTotal} className="font-semibold text-foreground" />
        </span>
      </div>
    </div>
  )
}
