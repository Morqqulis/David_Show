'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useQueueCounts, type QueueCountsPayload } from '@/hooks/use-ap-queries'
import { useRequestsTab, type RequestsTab } from '@/stores/use-requests-tab'
import { useEffectiveCounts } from '@/stores/use-effective-counts'
import type { StageId } from '@/backend/lib/stage-ids'

function iconForStage(systemId: StageId): React.ComponentType<{ className?: string }> {
  // `to_be_assigned` is the intake bucket and gets the Inbox icon to match its
  // semantic; every other queue is a checklist of work to do.
  return systemId === 'to_be_assigned' ? Inbox : ListChecks
}

type LinkItem = {
  kind: 'link'
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number | string
  badgeTone?: 'default' | 'danger'
}

type TabItem = {
  kind: 'tab'
  tab: RequestsTab
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number | string
}

type Item = LinkItem | TabItem

export function SidebarNav({ initial }: { initial: QueueCountsPayload }) {
  const pathname = usePathname()
  const router = useRouter()
  const tab = useRequestsTab((s) => s.tab)
  const setTab = useRequestsTab((s) => s.setTab)
  const { data } = useQueueCounts(initial)
  const polled = data?.counts ?? initial.counts
  // If /requests is mounted with a filter applied, prefer those filtered
  // counts. Otherwise fall back to the unfiltered polled counts.
  const effective = useEffectiveCounts((s) => s.counts)
  const counts = effective ?? polled
  const alertsCount = data?.alerts ?? initial.alerts
  // Stage definitions are SSR-seeded and refreshed on the same poll as counts;
  // editing a stage label in Settings invalidates the 'stages' cache tag, so
  // the next poll surfaces the new label without a manual refresh.
  const stages = data?.stages ?? initial.stages

  const onRequestsPage = pathname === '/requests' || pathname?.startsWith('/requests/') || false

  function activateTab(target: RequestsTab) {
    setTab(target)
    if (!onRequestsPage) router.push('/requests')
  }

  const groups: { title: string; items: Item[] }[] = [
    {
      title: '',
      items: [
        { kind: 'link', href: '/dashboard', label: 'Home', icon: LayoutDashboard },
        { kind: 'tab', tab: 'all', label: 'All Requests', icon: Receipt, badge: counts.all },
        { kind: 'link', href: '/new', label: 'New Invoice', icon: Plus },
      ],
    },
    {
      title: 'Queues',
      // Hide inactive stages that also have zero invoices — they're noise for
      // the AP user. Keep an inactive stage visible when it still has work
      // sitting in it so admins can drain it.
      items: stages
        .filter((s) => s.active || (counts[s.systemId] ?? 0) > 0)
        .map<TabItem>((s) => ({
          kind: 'tab',
          tab: s.systemId,
          label: s.label,
          icon: iconForStage(s.systemId),
          badge: counts[s.systemId] ?? 0,
        })),
    },
    {
      title: 'Admin',
      items: [
        { kind: 'link', href: '/email', label: 'Email', icon: Mail },
        { kind: 'link', href: '/settings', label: 'Settings', icon: Settings },
        { kind: 'link', href: '/trash', label: 'Trash', icon: Trash2 },
        {
          kind: 'link',
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
            const active =
              item.kind === 'tab'
                ? onRequestsPage && tab === item.tab
                : isLinkActive(item.href, pathname ?? '')
            const Icon = item.icon
            const key = item.kind === 'tab' ? `tab:${item.tab}` : item.href
            const className = cn(
              'group flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors',
              active
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-foreground/80 hover:bg-muted hover:text-foreground',
            )
            const inner = (
              <>
                <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
                <span className="flex-1 truncate text-left">{item.label}</span>
                {item.badge != null && Number(item.badge) > 0 ? (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                      item.kind === 'link' && item.badgeTone === 'danger'
                        ? 'bg-destructive text-destructive-foreground'
                        : active
                          ? 'bg-primary/15 text-primary'
                          : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </>
            )

            return item.kind === 'tab' ? (
              <button key={key} onClick={() => activateTab(item.tab)} className={cn(className, 'cursor-pointer')}>
                {inner}
              </button>
            ) : (
              <Link key={key} href={item.href} className={className}>
                {inner}
              </Link>
            )
          })}
        </div>
      ))}

      <div className="mt-auto flex items-center gap-2 rounded-md border border-border px-2.5 py-2">
        <Avatar size="sm">
          <AvatarFallback>DY</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-medium">David Y.</span>
          <span className="truncate text-[11px] text-muted-foreground">Admin</span>
        </div>
      </div>
    </nav>
  )
}

function isLinkActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(href + '/')
}
