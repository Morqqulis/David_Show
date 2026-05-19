'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { uploadDocument } from '@/backend/actions/document-actions'

const ACCEPTED = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.tif,.tiff,application/pdf,image/*'

export function DocumentUpload({
  invoiceId,
  compact = false,
  onUploaded,
}: {
  invoiceId: string | number
  compact?: boolean
  onUploaded?: (docId: string | number) => void | Promise<void>
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [dragOver, setDragOver] = useState(false)

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const file = files[0]
    if (file.size > 50 * 1024 * 1024) {
      toast.error(`${file.name} exceeds 50 MB cap`)
      return
    }
    startTransition(async () => {
      const fd = new FormData()
      fd.set('file', file)
      fd.set('invoiceId', String(invoiceId))
      try {
        const result = await uploadDocument(fd)
        toast.success(`${file.name} uploaded`)
        if (inputRef.current) inputRef.current.value = ''
        await onUploaded?.(result.id)
      } catch (err) {
        toast.error((err as Error).message || 'Upload failed')
      }
    })
  }

  if (compact) {
    return (
      <>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          {pending ? 'Uploading…' : 'Upload'}
        </Button>
      </>
    )
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        handleFiles(e.dataTransfer.files)
      }}
      className={`flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-sm transition-colors ${
        dragOver ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'
      }`}
    >
      <Upload className="h-5 w-5 text-muted-foreground" />
      <div className="text-center">
        <div className="font-medium">{pending ? 'Uploading…' : 'Drop a file here'}</div>
        <div className="text-xs text-muted-foreground">PDF, Word, or image · up to 50 MB</div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button size="sm" variant="outline" disabled={pending} onClick={() => inputRef.current?.click()}>
        Browse files
      </Button>
    </div>
  )
}
