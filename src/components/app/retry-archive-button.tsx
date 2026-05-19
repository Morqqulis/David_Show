'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { retryArchive } from '@/backend/actions/invoice'
import { queryKeys } from '@/hooks/use-ap-queries'

export function RetryArchiveButton({ id }: { id: string | number }) {
  const router = useRouter()
  const qc = useQueryClient()
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
          // Clearing the archiveFailed flag drops the alerts count badge in
          // the sidebar — invalidate the TanStack cache to reflect it.
          await qc.invalidateQueries({ queryKey: queryKeys.queueCounts })
          await qc.invalidateQueries({ queryKey: queryKeys.invoice(id) })
          router.refresh()
        })
      }
    >
      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
      Retry
    </Button>
  )
}
