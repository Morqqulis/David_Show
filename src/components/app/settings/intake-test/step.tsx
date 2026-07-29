'use client'

/** One numbered step of the working, and the money wording the steps share. */
export function Step({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
          {number}
        </span>
        {title}
      </h3>
      <div className="space-y-2 pl-7 text-sm">{children}</div>
    </section>
  )
}

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value)
}

export function formatDay(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    timeZone: 'UTC',
  }).format(parsed)
}
