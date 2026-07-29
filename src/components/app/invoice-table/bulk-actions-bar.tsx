'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useBulkReassignPermission } from '@/hooks/use-ap-queries'
import { BulkReassignDialog } from './bulk-reassign-dialog'
import type { InvoiceRow } from './types'

/**
 * Actions for the ticked rows.
 *
 * Reassign here is the secondary way into bulk reassignment: it reads whose
 * turn each ticked row is waiting on, and asks which person is meant when the
 * selection spans more than one. The primary route is the toolbar button, which
 * starts from the person instead.
 */
export function BulkActionsBar({
  rows,
  onClearSelection,
}: {
  rows: InvoiceRow[]
  onClearSelection: () => void
}) {
  const [reassignOpen, setReassignOpen] = useState(false)
  const { data: permission } = useBulkReassignPermission()

  if (rows.length === 0) return null
  return (
    <div className="flex items-center justify-between rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
      <span>
        <strong>{rows.length}</strong> selected
      </span>
      {/*
        Bulk Assign, Apply Batch # and Approve used to sit here as buttons with
        no click handler at all. They are not built, and a button that does
        nothing is worse than an absent one: it is indistinguishable from a
        broken feature, and it costs a demo audience their trust in everything
        next to it. They come back when they do something.
      */}
      <div className="flex items-center gap-2">
        {permission?.allowed ? (
          <Button variant="outline" size="sm" onClick={() => setReassignOpen(true)}>
            Reassign
          </Button>
        ) : null}
      </div>

      <BulkReassignDialog
        open={reassignOpen}
        onOpenChange={setReassignOpen}
        mode={{ kind: 'selection', invoiceIds: rows.map((r) => r.id) }}
        onCommitted={onClearSelection}
      />
    </div>
  )
}
