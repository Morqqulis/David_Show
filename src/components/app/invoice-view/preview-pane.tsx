'use client'

import { Download, FileText, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PdfPreview, type PreviewDocument } from '../pdf-preview'

export function InvoicePreviewPane({
  collapsed,
  setCollapsed,
  activeDoc,
  invoiceNumber,
}: {
  collapsed: boolean
  setCollapsed: (next: boolean) => void
  activeDoc?: PreviewDocument
  invoiceNumber: string
}) {
  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="flex h-full w-full flex-col items-center gap-2 px-2 py-3 text-xs font-medium text-muted-foreground hover:bg-muted"
        title="Expand preview"
      >
        <PanelLeftOpen className="h-4 w-4" />
        <span className="rotate-180 [writing-mode:vertical-rl]">
          {activeDoc?.filename ?? `${invoiceNumber} · no doc`}
        </span>
      </button>
    )
  }
  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-xs">
        <span className="flex min-w-0 items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="truncate font-medium">
            {activeDoc?.filename ?? `${invoiceNumber} · no document`}
          </span>
        </span>
        <div className="flex items-center gap-1">
          {activeDoc?.url ? (
            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
              <a href={activeDoc.url} download={activeDoc.filename} title="Download">
                <Download className="h-3.5 w-3.5" />
              </a>
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCollapsed(true)}
            title="Collapse preview"
          >
            <PanelLeftClose className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <PdfPreview doc={activeDoc} invoiceNumber={invoiceNumber} />
      </div>
    </>
  )
}
