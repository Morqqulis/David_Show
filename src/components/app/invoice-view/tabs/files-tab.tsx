'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Download, FileText, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { DocumentUpload } from '../../document-upload'
import { formatRelative } from '@/backend/lib/formatting'
import { deleteDocument } from '@/backend/actions/document-actions'
import type { InvoiceViewDocument } from '../types'

export function FilesTab({
  invoiceId,
  documents,
  activeDocId,
  setActiveDocId,
}: {
  invoiceId: string | number
  documents: InvoiceViewDocument[]
  activeDocId: string
  setActiveDocId: (id: string) => void
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  function onDelete(docId: string | number, filename?: string) {
    if (!confirm(`Remove ${filename ?? 'this document'} from this invoice?`)) return
    startTransition(async () => {
      await deleteDocument(docId, invoiceId)
      toast.success('Document removed')
      if (String(docId) === activeDocId) setActiveDocId('')
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <DocumentUpload invoiceId={invoiceId} />
      {documents.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          No documents yet. Upload above — PDFs, Word, and images are supported.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {documents.map((d) => {
            const isActive = String(d.id) === activeDocId
            return (
              <li
                key={String(d.id)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2',
                  isActive ? 'bg-primary/5' : 'hover:bg-muted/40',
                )}
              >
                <button
                  onClick={() => setActiveDocId(String(d.id))}
                  className="flex flex-1 items-center gap-3 text-left"
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{d.filename}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {d.filesize ? `${(d.filesize / 1024).toFixed(0)} KB` : ''}
                      {d.uploadedBy?.name ? ` · uploaded by ${d.uploadedBy.name}` : ''}
                      {d.createdAt ? ` · ${formatRelative(d.createdAt)}` : ''}
                    </div>
                  </div>
                </button>
                {d.url ? (
                  <a
                    href={d.url}
                    download={d.filename}
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Download"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                ) : null}
                <Button size="icon" variant="ghost" onClick={() => onDelete(d.id, d.filename)}>
                  <Trash2 className="h-3.5 w-3.5 text-red-600" />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
