import Link from 'next/link'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatRelative, initials } from '@/backend/lib/formatting'

type Event = {
  id: string | number
  action: string
  createdAt: string
  invoice?: { invoiceNumber?: string; id?: string | number }
  actor?: { name?: string }
}

const ACTION_PHRASES: Record<string, string> = {
  created: 'created invoice',
  updated: 'updated stage on',
  approved: 'approved',
  rejected: 'rejected',
  reassigned: 'reassigned',
  coded: 'coded lines on',
  batch_applied: 'applied batch to',
  batch_closed: 'closed batch including',
  verified: 'verified',
  unverified: 'cleared verification on',
  document_uploaded: 'uploaded document to',
  comment_added: 'commented on',
}

function humanize(action: string) {
  return ACTION_PHRASES[action] ?? action.replace(/_/g, ' ')
}

export function ActivityFeed({ events }: { events: Event[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Recent activity</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {events.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No activity yet.</div>
          ) : (
            events.map((evt) => (
              <div key={String(evt.id)} className="flex items-start gap-3 px-4 py-3">
                <Avatar size="sm">
                  <AvatarFallback>{initials(evt.actor?.name) || '·'}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="text-sm">
                    <span className="font-medium">{evt.actor?.name ?? 'System'}</span>{' '}
                    <span className="text-muted-foreground">{humanize(evt.action)}</span>{' '}
                    {evt.invoice?.invoiceNumber ? (
                      <Link
                        href={`/requests/${evt.invoice.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {evt.invoice.invoiceNumber}
                      </Link>
                    ) : null}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatRelative(evt.createdAt)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
