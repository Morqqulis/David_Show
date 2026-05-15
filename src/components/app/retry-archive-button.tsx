'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { retryArchive } from '@/backend/actions/invoice-actions'

export function RetryArchiveButton({ id }: { id: string | number }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await retryArchive(id)
          toast.success('Archive retried — flagged success')
          router.refresh()
        })
      }
    >
      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
      Retry
    </Button>
  )
}
