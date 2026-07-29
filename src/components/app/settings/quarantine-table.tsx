'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/backend/lib/formatting'
import { releaseQuarantinedMessage } from '@/backend/actions/intake-actions'
import { senderRejectionMessage, type SenderRejectionReason } from '@/backend/lib/intake-sender-policy'

export type HeldMessage = {
  id: string | number
  sender: string
  subject: string
  receivedAt: string
  reason: SenderRejectionReason
  attachmentCount: number
  released: boolean
  releasedAt: string | null
  releaseError: string | null
}

// One evolving pill for this screen, however many messages are released.
const TOAST_ID = 'quarantine-release'

/**
 * Emails the mailbox turned away. Nothing that arrives is ever discarded
 * silently, so everything the sender policy refused ends up here for someone to
 * look at and, if it is genuine, release into the normal queue.
 */
export function QuarantineTable({ rows: initialRows }: { rows: HeldMessage[] }) {
  const [rows, setRows] = useState(initialRows)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function release(row: HeldMessage) {
    const previous = rows
    setBusyId(String(row.id))
    setRows((cur) =>
      cur.map((r) =>
        String(r.id) === String(row.id)
          ? { ...r, released: true, releasedAt: new Date().toISOString(), releaseError: null }
          : r,
      ),
    )

    startTransition(async () => {
      try {
        const result = await releaseQuarantinedMessage(row.id)
        toast.success(
          result.created === 1
            ? 'Released — one invoice was created'
            : `Released — ${result.created} invoices were created`,
          { id: TOAST_ID, duration: 2000 },
        )
      } catch (err) {
        setRows(previous)
        console.error('[intake] releasing a held message failed', { id: row.id, err })
        toast.error(err instanceof Error ? err.message : 'Could not release this message', { id: TOAST_ID })
      } finally {
        setBusyId(null)
      }
    })
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Arrived</TableHead>
          <TableHead>From</TableHead>
          <TableHead>Subject</TableHead>
          <TableHead>Why it was held</TableHead>
          <TableHead className="w-20 text-right">Files</TableHead>
          <TableHead className="w-40" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
              Nothing is waiting. Every email that reached the mailbox was accepted.
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
            <TableRow key={String(row.id)}>
              <TableCell className="whitespace-nowrap text-sm">{formatDate(row.receivedAt)}</TableCell>
              <TableCell className="text-sm">{row.sender}</TableCell>
              <TableCell className="text-sm">{row.subject || '(no subject)'}</TableCell>
              <TableCell className="max-w-md text-xs text-muted-foreground">
                {senderRejectionMessage(row.reason)}
                {row.releaseError ? (
                  <span className="mt-1 block text-red-600">{row.releaseError}</span>
                ) : null}
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">{row.attachmentCount}</TableCell>
              <TableCell className="text-right">
                {row.released ? (
                  <Badge variant="outline">
                    Released{row.releasedAt ? ` ${formatDate(row.releasedAt)}` : ''}
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === String(row.id)}
                    onClick={() => release(row)}
                  >
                    Accept this one
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
