import { Skeleton } from '@/components/ui/skeleton'

/**
 * Mirrors the split-view layout of /requests/[id] while SSR is in flight.
 * Stepper bar across the top, preview pane on the left, tab pane on the right.
 */
export function InvoiceDetailSkeleton() {
  return (
    <main className="flex flex-1 flex-col gap-3 overflow-hidden p-6">
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <Skeleton className="h-4 w-48" />
      </div>

      <div className="flex gap-2 overflow-hidden rounded-lg border border-border bg-card p-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-7 flex-1 rounded-md" />
        ))}
      </div>

      <div className="grid flex-1 grid-cols-[1.4fr_1fr] gap-3 overflow-hidden">
        <Skeleton className="h-full rounded-lg" />
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-20 rounded-md" />
            ))}
          </div>
          <div className="space-y-3 pt-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex justify-between gap-3 border-b border-border/60 pb-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <Skeleton className="h-12 rounded-lg" />
    </main>
  )
}
