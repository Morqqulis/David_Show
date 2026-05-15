import { Button } from '@/components/ui/button'

export function SeedPrompt({ error }: { error: string }) {
  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-dashed border-border bg-card p-8 text-center">
      <h2 className="text-lg font-semibold">Database not seeded</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        The AP Invoice tables don't have demo data yet. POST{' '}
        <code className="rounded bg-muted px-1.5 py-0.5">/api/seed</code> to populate Aurora.
      </p>
      <pre className="mt-4 overflow-x-auto rounded bg-muted/50 p-3 text-left text-xs">{error}</pre>
      <form action="/api/seed" method="post" className="mt-4">
        <Button type="submit">Run seed now</Button>
      </form>
    </div>
  )
}
