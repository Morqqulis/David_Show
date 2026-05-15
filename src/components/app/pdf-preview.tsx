'use client'

import { FileText, Download } from 'lucide-react'

export type PreviewDocument = {
  id: string | number
  filename?: string
  mimeType?: string
  filesize?: number
  url?: string
}

export function PdfPreview({ doc, invoiceNumber }: { doc?: PreviewDocument | null; invoiceNumber: string }) {
  if (!doc || !doc.url) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-2 bg-[repeating-linear-gradient(45deg,#f8fafc,#f8fafc_10px,#f1f5f9_10px,#f1f5f9_20px)] text-sm text-muted-foreground">
        <FileText className="h-8 w-8" />
        <div className="text-center">
          <div className="font-medium">No document attached</div>
          <div className="mt-0.5 text-xs">{invoiceNumber} · upload one from the Files tab</div>
        </div>
      </div>
    )
  }

  const isPdf = doc.mimeType?.includes('pdf') || doc.filename?.toLowerCase().endsWith('.pdf')
  const isImage = doc.mimeType?.startsWith('image/')

  if (isImage) {
    return (
      <div className="flex h-full w-full items-center justify-center overflow-auto bg-muted/30 p-3">
        <img src={doc.url} alt={doc.filename} className="max-h-full max-w-full object-contain" />
      </div>
    )
  }

  if (isPdf) {
    return (
      <iframe
        src={doc.url}
        className="h-full w-full"
        title={doc.filename ?? 'Invoice PDF'}
      />
    )
  }

  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 bg-muted/30 text-sm text-muted-foreground">
      <FileText className="h-10 w-10" />
      <div className="text-center">
        <div className="font-medium text-foreground">{doc.filename}</div>
        <div className="text-xs">No inline preview for this file type</div>
      </div>
      <a
        href={doc.url}
        download={doc.filename}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
      >
        <Download className="h-3.5 w-3.5" />
        Download
      </a>
    </div>
  )
}
