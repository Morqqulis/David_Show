'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const ITEMS = [
  { href: '/email/templates', label: 'Templates' },
  { href: '/email/triggers', label: 'Triggers' },
  { href: '/email/settings', label: 'Settings' },
]

export function EmailNav() {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col text-sm">
      {ITEMS.map((item) => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm transition-colors',
              active ? 'bg-primary/10 text-primary font-medium' : 'text-foreground/80 hover:bg-muted',
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
