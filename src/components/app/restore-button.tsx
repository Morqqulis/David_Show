'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { restoreInvoice } from '@/backend/actions/invoice'
import { queryKeys } from '@/hooks/use-ap-queries'

export function RestoreButton({ id }: { id: string | number }) {
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
          await restoreInvoice(id)
          toast.success('Invoice restored')
          // Restored invoice re-enters /requests counts — drop the stale
          // TanStack caches so the sidebar and list reflect it on nav.
          await qc.invalidateQueries({ queryKey: queryKeys.queueCounts })
          await qc.invalidateQueries({ queryKey: queryKeys.invoice(id) })
          router.refresh()
        })
      }
    >
      <Undo2 className="mr-1.5 h-3.5 w-3.5" />
      Restore
    </Button>
  )
}
