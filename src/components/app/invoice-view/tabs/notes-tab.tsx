'use client'

import { useState, useTransition } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Send } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { formatRelative, initials } from '@/backend/lib/formatting'
import { postComment } from '@/backend/actions/invoice'
import { queryKeys } from '@/hooks/use-ap-queries'
import type { InvoiceViewComment } from '../types'

export function NotesTab({
  invoiceId,
  comments,
}: {
  invoiceId: string | number
  comments: InvoiceViewComment[]
}) {
  const qc = useQueryClient()
  const [body, setBody] = useState('')
  const [pending, startTransition] = useTransition()

  const submit = () => {
    if (!body.trim()) return
    startTransition(async () => {
      await postComment(invoiceId, body.trim())
      setBody('')
      toast.success('Comment posted')
      // InvoiceView reads comments from the TanStack invoice cache; without
      // an explicit invalidate, staleTime: Infinity keeps the old list.
      await qc.invalidateQueries({ queryKey: queryKeys.invoice(invoiceId) })
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-md border border-border bg-background p-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Add a note… use @name to mention"
          className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={submit} disabled={pending || !body.trim()}>
            <Send className="h-3.5 w-3.5" />
            Post
          </Button>
        </div>
      </div>

      {comments.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground">No notes yet.</div>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={String(c.id)} className="flex items-start gap-2">
              <Avatar size="sm">
                <AvatarFallback>{initials(c.author?.name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 rounded-md border border-border bg-background p-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{c.author?.name ?? 'Unknown'}</span>
                  <span className="text-muted-foreground">{formatRelative(c.createdAt)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
