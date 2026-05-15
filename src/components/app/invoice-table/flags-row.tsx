import { AlertCircle, FileWarning, FileX, Paperclip } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { InvoiceRow } from './types'

type FlagItem = { icon: React.ReactNode; label: string; tone: 'red' | 'amber' }

function collectFlags(row: InvoiceRow): FlagItem[] {
  const flags = row.flags ?? {}
  const items: FlagItem[] = []
  if (flags.archiveFailed) items.push({ icon: <FileX className="h-3 w-3" />, label: 'Archive failed', tone: 'red' })
  if (flags.ocrFailed) items.push({ icon: <FileWarning className="h-3 w-3" />, label: 'OCR failed', tone: 'amber' })
  if (flags.noAttachment) items.push({ icon: <Paperclip className="h-3 w-3" />, label: 'No attachment', tone: 'amber' })
  if (flags.possibleDuplicate)
    items.push({ icon: <AlertCircle className="h-3 w-3" />, label: 'Possible duplicate', tone: 'amber' })
  if (flags.vendorSetupRequired)
    items.push({ icon: <AlertCircle className="h-3 w-3" />, label: 'Vendor setup required', tone: 'amber' })
  return items
}

export function FlagsRow({ row }: { row: InvoiceRow }) {
  const items = collectFlags(row)
  if (items.length === 0) return null
  return (
    <div className="mt-0.5 flex flex-wrap gap-1">
      {items.map((it, i) => (
        <span
          key={i}
          className={cn(
            'inline-flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-medium',
            it.tone === 'red'
              ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
              : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
          )}
        >
          {it.icon}
          {it.label}
        </span>
      ))}
    </div>
  )
}
