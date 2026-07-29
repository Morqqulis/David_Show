import { ScanLine } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Marks a value that was read off the scanned invoice rather than typed by a
 * person.
 *
 * Finance needs to tell the two apart at a glance, because a machine reading is
 * something to check against the document and a typed value is something a
 * colleague already checked. The marker is deliberately quiet — a small icon
 * and a dotted underline — so a screen full of extracted values does not look
 * like a screen full of warnings.
 *
 * The wording never mentions scanning technology. "Read from the invoice" is
 * what happened, in words a finance clerk uses.
 */
export function OcrValue({
  extracted,
  className,
  children,
}: {
  extracted: boolean
  className?: string
  children: React.ReactNode
}) {
  if (!extracted) return <span className={className}>{children}</span>

  return (
    <span
      className={cn('inline-flex items-center gap-1.5', className)}
      title="Read from the invoice document. Worth a glance against the file before approving."
    >
      <ScanLine className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
      <span className="underline decoration-dotted decoration-muted-foreground/60 underline-offset-4">
        {children}
      </span>
      <span className="sr-only">(read from the invoice document)</span>
    </span>
  )
}

/** The one-line explanation shown once per screen, above a set of marked values. */
export function OcrLegend({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <ScanLine className="h-3 w-3 shrink-0" aria-hidden />
      {count === 1
        ? 'One value below was read from the invoice document rather than typed in.'
        : `${count} values below were read from the invoice document rather than typed in.`}
    </p>
  )
}
