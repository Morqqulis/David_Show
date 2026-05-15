import { Money } from '../../money'
import { formatDate } from '@/backend/lib/formatting'
import type { InvoiceViewInvoice } from '../types'

export function HeaderTab({ inv }: { inv: InvoiceViewInvoice }) {
  const fields: Array<{ label: string; value: React.ReactNode }> = [
    { label: 'Invoice #', value: inv.invoiceNumber },
    { label: 'PO #', value: inv.poNumber ?? '—' },
    { label: 'Vendor', value: inv.vendor?.name ?? '—' },
    { label: 'Vendor #', value: inv.vendor?.vendorNumber ?? '—' },
    { label: 'Invoice Date', value: formatDate(inv.invoiceDate) },
    { label: 'Due Date', value: formatDate(inv.dueDate) },
    { label: 'Fiscal Year', value: inv.fiscalYear ?? '—' },
    { label: 'Subtotal', value: <Money value={inv.subtotal} /> },
    { label: 'Total Tax', value: <Money value={inv.totalTax} /> },
    { label: 'Grand Total', value: <Money value={inv.grandTotal} className="font-semibold" /> },
    { label: 'Departments', value: inv.departments?.map((d) => d.name).join(', ') || '—' },
    { label: 'Assignees', value: inv.assignees?.map((a) => a.name).join(', ') || '—' },
    { label: 'Batch #', value: inv.batch?.number ?? '—' },
    { label: 'Priority', value: (inv.customFields?.priority as string) ?? '—' },
  ]
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {fields.map((f) => (
        <div
          key={f.label}
          className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1.5"
        >
          <span className="text-xs text-muted-foreground">{f.label}</span>
          <span className="text-sm font-medium">{f.value}</span>
        </div>
      ))}
    </div>
  )
}
