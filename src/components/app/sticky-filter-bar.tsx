import { cn } from '@/lib/utils'

/**
 * Sticky container for the page-top filter zone (page header, stage pills, search row).
 * Renders inside a scrollable <main>; stays pinned at top:0 while the table scrolls.
 *
 * Background uses backdrop-blur so content sliding under it remains faintly visible.
 */
export function StickyFilterBar({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'sticky top-0 z-10 -mx-8 border-b border-border bg-background/95 px-8 py-4 backdrop-blur',
        'space-y-3',
        className,
      )}
    >
      {children}
    </div>
  )
}
