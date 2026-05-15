'use client'

import { useMemo } from 'react'
import { DataTable } from '@/components/ui/data-table'
import { buildInvoiceColumns } from './columns'
import { InvoiceTableToolbar } from './toolbar'
import { BulkActionsBar } from './bulk-actions-bar'
import { InlineDetail } from './inline-detail'
import type { InvoiceRow } from './types'

export type { InvoiceRow, InvoiceLineRow } from './types'

// NOTE: We deliberately do NOT hover-prefetch invoice detail here.
// Each prefetch is a server action POST that takes 2-3s and competes for the
// Vercel Postgres connection pool. Passing the cursor over 8 rows burned ~24s
// of server work and blocked page-to-page navigation. SSR on click already
// fetches the data; an extra hover prefetch is redundant in this architecture.
export function InvoiceTable({
  rows,
  showStageColumn = true,
}: {
  rows: InvoiceRow[]
  showStageColumn?: boolean
}) {
  const columns = useMemo(() => buildInvoiceColumns({ showStageColumn }), [showStageColumn])

  return (
    <DataTable<InvoiceRow>
      columns={columns}
      data={rows}
      getRowId={(row) => String(row.id)}
      initialSorting={[{ id: 'invoiceDate', desc: true }]}
      renderSubComponent={(row) => <InlineDetail row={row.original} />}
      emptyMessage="No invoices match the current filter."
      renderToolbar={(table) => (
        <div className="space-y-2">
          <InvoiceTableToolbar table={table} />
          <BulkActionsBar selectedCount={table.getSelectedRowModel().rows.length} />
        </div>
      )}
    />
  )
}
