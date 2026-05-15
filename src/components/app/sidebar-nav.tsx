'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Inbox,
  ListChecks,
  Plus,
  Mail,
  Settings,
  Trash2,
  AlertTriangle,
  Receipt,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useQueueCounts, type QueueCountsPayload } from '@/hooks/use-ap-queries'

type Item = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number | string
  badgeTone?: 'default' | 'danger'
}

export function SidebarNav({ initial }: { initial: QueueCountsPayload }) {
  const pathname = usePathname()
  const { data } = useQueueCounts(initial)
  const counts = data?.counts ?? initial.counts
  const alertsCount = data?.alerts ?? initial.alerts

  const groups: { title: string; items: Item[] }[] = [
    {
      title: '',
      items: [
        { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
        { href: '/requests', label: 'All Requests', icon: Receipt, badge: counts.all },
        { href: '/new', label: 'New Invoice', icon: Plus },
      ],
    },
    {
      title: 'Queues',
      items: [
        { href: '/queues/to_be_assigned', label: 'To Be Assigned', icon: Inbox, badge: counts.to_be_assigned },
        { href: '/queues/to_be_coded', label: 'To Be Coded', icon: ListChecks, badge: counts.to_be_coded },
        { href: '/queues/conditional_approvals', label: 'Conditional Approvals', icon: ListChecks, badge: counts.conditional_approvals },
        { href: '/queues/ap_review', label: 'AP Review', icon: ListChecks, badge: counts.ap_review },
        { href: '/queues/ready_for_processing', label: 'Ready for Processing', icon: ListChecks, badge: counts.ready_for_processing },
        { href: '/queues/processed', label: 'Processed', icon: ListChecks, badge: counts.processed },
        { href: '/queues/treasurer_review', label: 'Treasurer Review', icon: ListChecks, badge: counts.treasurer_review },
        { href: '/queues/completed', label: 'Completed', icon: ListChecks, badge: counts.completed },
      ],
    },
    {
      title: 'Admin',
      items: [
        { href: '/email', label: 'Email', icon: Mail },
        { href: '/settings', label: 'Settings', icon: Settings },
        { href: '/trash', label: 'Trash', icon: Trash2 },
        {
          href: '/alerts',
          label: 'Alerts',
          icon: AlertTriangle,
          badge: alertsCount > 0 ? alertsCount : undefined,
          badgeTone: 'danger',
        },
      ],
    },
  ]

  return (
    <nav className="flex h-full flex-col gap-1 px-3 py-4 text-sm">
      <div className="flex items-center gap-2 px-2 pb-4">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">
          A
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-semibold">AuroraAP</span>
          <span className="text-[11px] text-muted-foreground">City of Aurora · AP</span>
        </div>
      </div>

      {groups.map((group, gi) => (
        <div key={gi} className="flex flex-col gap-0.5">
          {group.title ? (
            <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.title}
            </div>
          ) : null}
          {group.items.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + '/')
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                  active
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-foreground/80 hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge != null && Number(item.badge) > 0 ? (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                      item.badgeTone === 'danger'
                        ? 'bg-destructive text-destructive-foreground'
                        : active
                          ? 'bg-primary/15 text-primary'
                          : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            )
          })}
        </div>
      ))}

      <div className="mt-auto flex items-center gap-2 rounded-md border border-border px-2.5 py-2">
        <div className="grid h-8 w-8 place-items-center rounded-full bg-muted text-xs font-semibold">DY</div>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-medium">David Y.</span>
          <span className="truncate text-[11px] text-muted-foreground">Admin</span>
        </div>
      </div>
    </nav>
  )
}
