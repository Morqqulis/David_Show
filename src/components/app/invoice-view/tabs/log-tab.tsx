import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { formatRelative, initials } from '@/backend/lib/formatting'
import type { InvoiceViewAuditEvent } from '../types'

function prettyAction(action: string) {
  return action.replace(/_/g, ' ')
}

export function LogTab({ events }: { events: InvoiceViewAuditEvent[] }) {
  if (events.length === 0) {
    return <div className="text-center text-sm text-muted-foreground">No audit events yet.</div>
  }
  return (
    <ol className="space-y-2">
      {events.map((e) => (
        <li
          key={String(e.id)}
          className="flex items-start gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <Avatar size="sm">
            <AvatarFallback>{initials(e.actor?.name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span>
                <span className="font-medium">{e.actor?.name ?? 'System'}</span>{' '}
                <span className="text-muted-foreground">{prettyAction(e.action)}</span>
              </span>
              <span className="text-[11px] text-muted-foreground">{formatRelative(e.createdAt)}</span>
            </div>
            {e.context ? (
              <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted/40 p-2 text-[11px] text-muted-foreground">
                {JSON.stringify(e.context, null, 2)}
              </pre>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  )
}
