'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { restoreInvoice } from '@/backend/actions/invoice-actions'

export function RestoreButton({ id }: { id: string | number }) {
  const router = useRouter()
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
          router.refresh()
        })
      }
    >
      <Undo2 className="mr-1.5 h-3.5 w-3.5" />
      Restore
    </Button>
  )
}
