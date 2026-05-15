import { Bell, Search, ChevronRight } from 'lucide-react'

export function Topbar({ crumbs }: { crumbs?: { label: string; href?: string }[] }) {
  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-background/80 px-6 backdrop-blur">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {(crumbs ?? []).map((c, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 ? <ChevronRight className="h-3.5 w-3.5 opacity-50" /> : null}
            {c.href ? (
              <a href={c.href} className="hover:text-foreground">
                {c.label}
              </a>
            ) : (
              <span className="text-foreground">{c.label}</span>
            )}
          </span>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search invoices, vendors, batches…"
            className="h-9 w-72 rounded-md border border-border bg-muted/40 pl-8 pr-3 text-sm outline-none transition focus:bg-background focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <button className="grid h-9 w-9 place-items-center rounded-md border border-border hover:bg-muted">
          <Bell className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
