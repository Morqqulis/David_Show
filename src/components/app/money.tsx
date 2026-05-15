import { formatCurrency } from '@/backend/lib/tax-math'
import { cn } from '@/lib/utils'

export function Money({
  value,
  className,
  muted,
}: {
  value: number | null | undefined
  className?: string
  muted?: boolean
}) {
  return (
    <span className={cn('tabular-nums', muted ? 'text-muted-foreground' : '', className)}>
      {formatCurrency(value)}
    </span>
  )
}
