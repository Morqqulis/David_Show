import { Skeleton } from '@/components/ui/skeleton'

/**
 * Layout-matching placeholder for /requests and /queues/[stageId] while SSR
 * is in flight. The shape mirrors the StickyFilterBar + table so there's no
 * layout shift when the real page swaps in.
 */
export function InvoiceListSkeleton({
  title = 'Loading…',
  pillCount = 9,
  rowCount = 8,
}: {
  title?: string
  pillCount?: number
  rowCount?: number
}) {
  return (
    <main className="flex flex-1 flex-col overflow-y-auto px-8 pb-8">
      <div className="sticky top-0 z-10 -mx-8 space-y-3 border-b border-border bg-background/95 px-8 py-4 backdrop-blur">
        <div className="flex items-end justify-between gap-4 pb-2">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: pillCount }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-28 rounded-full" />
          ))}
        </div>
      </div>

      <div className="space-y-4 pt-4">
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border p-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-9 w-20" />
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: rowCount }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="ml-auto h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">{title}</span>
    </main>
  )
}
