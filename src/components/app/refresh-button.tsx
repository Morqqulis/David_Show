'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Refresh button for the topbar. Invalidates every TanStack query so client
 * caches re-fetch from server actions, and calls `router.refresh()` so the
 * current server-rendered page re-runs its data loaders too.
 *
 * Replaces the polling / refetchOnMount auto-fetches we used to have. Quieter
 * by default; the user reaches for this when they want fresh data.
 */
export function RefreshButton() {
  const router = useRouter()
  const qc = useQueryClient()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant="outline"
      size="icon"
      className="h-9 w-9"
      aria-label="Refresh data"
      title="Refresh data"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await qc.invalidateQueries()
          router.refresh()
        })
      }
    >
      <RefreshCw className={cn('h-4 w-4', pending && 'animate-spin')} />
    </Button>
  )
}
