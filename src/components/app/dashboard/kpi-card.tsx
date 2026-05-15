import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function KpiCard({
  icon,
  label,
  value,
  hint,
  tone = 'default',
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  hint?: string
  tone?: 'default' | 'warning' | 'danger'
}) {
  const toneClass =
    tone === 'warning' ? 'text-amber-600' : tone === 'danger' ? 'text-red-600' : 'text-primary'
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className={cn(toneClass)}>{icon}</span>
          {label}
        </div>
        <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
        {hint ? <div className="text-[11px] text-muted-foreground">{hint}</div> : null}
      </CardContent>
    </Card>
  )
}
