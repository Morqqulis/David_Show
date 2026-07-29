'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PREBUILT_INVOICE_SOURCE_FIELDS } from '@/backend/lib/intake-field-mapping'

export type TypedReading = { source: string; value: string; confidencePercent: number }

/**
 * The readings a person supplies when the reading service is not connected.
 *
 * Deliberately the same eight things the service itself reports on a header —
 * so what happens next is exactly what would have happened with a real machine
 * reading, including a value being thrown away for not being certain enough.
 */
const OFFERED = [
  'VendorName',
  'InvoiceId',
  'InvoiceDate',
  'DueDate',
  'PurchaseOrder',
  'SubTotal',
  'TotalTax',
  'InvoiceTotal',
] as const

const PLACEHOLDER: Record<string, string> = {
  VendorName: 'BlueRock Construction Ltd.',
  InvoiceId: 'INV-40218',
  InvoiceDate: '2026-07-14  (year-month-day)',
  DueDate: '2026-08-13  (year-month-day)',
  PurchaseOrder: 'PO-9931',
  SubTotal: '4200.00',
  TotalTax: '546.00',
  InvoiceTotal: '4746.00',
}

const DEFAULT_CONFIDENCE = 95

/** The starting rows, so the parent owns the state from its first render. */
export function createDefaultReadings(): TypedReading[] {
  return OFFERED.map((source) => ({ source, value: '', confidencePercent: DEFAULT_CONFIDENCE }))
}

export function ManualReadingForm({
  readings,
  onChange,
}: {
  readings: TypedReading[]
  onChange: (next: TypedReading[]) => void
}) {
  function patch(source: string, patchValue: Partial<TypedReading>) {
    onChange(readings.map((r) => (r.source === source ? { ...r, ...patchValue } : r)))
  }

  const label = (source: string) =>
    PREBUILT_INVOICE_SOURCE_FIELDS.find((f) => f.name === source)?.label ?? source

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">2. Type in what the invoice says</p>
        <p className="pt-1 text-xs text-muted-foreground">
          Fill in only what is printed on the document you chose. Leave anything blank that is not on it —
          a blank is treated exactly as &ldquo;nothing was found for this&rdquo;. The percentage beside each
          box is how certain a machine reading would have been; lower it below the bar set in your settings
          to see what happens to a doubtful reading.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {readings.map((reading) => (
          <div key={reading.source} className="space-y-1.5">
            <Label htmlFor={`v-${reading.source}`} className="text-xs">
              {label(reading.source)}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id={`v-${reading.source}`}
                value={reading.value}
                placeholder={PLACEHOLDER[reading.source] ?? ''}
                onChange={(e) => patch(reading.source, { value: e.target.value })}
                className="h-8 text-sm"
              />
              <div className="flex shrink-0 items-center gap-1">
                <Input
                  aria-label={`How certain, ${label(reading.source)}`}
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  value={reading.confidencePercent}
                  onChange={(e) =>
                    patch(reading.source, {
                      confidencePercent: clamp(Number(e.target.value)),
                    })
                  }
                  className="h-8 w-16 text-sm"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}
