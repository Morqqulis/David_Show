import { AlertTriangle } from 'lucide-react'
import { Money } from '../money'

export function MismatchBanner({ linesSum, headerSubtotal }: { linesSum: number; headerSubtotal: number }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      <AlertTriangle className="mt-0.5 h-4 w-4" />
      <div>
        <div className="font-medium">Coded sum doesn't match the header subtotal</div>
        <div className="text-xs">
          Σ Lines <Money value={linesSum} /> vs Header Subtotal <Money value={headerSubtotal} /> —
          reconcile before advancing past AP Review.
        </div>
      </div>
    </div>
  )
}
