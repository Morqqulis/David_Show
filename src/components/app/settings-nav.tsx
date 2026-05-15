'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const SECTIONS: Array<{ title: string; items: Array<{ href: string; label: string }> }> = [
  {
    title: 'Workflow',
    items: [
      { href: '/settings/workflow', label: 'Workflow' },
      { href: '/settings/fields', label: 'Fields' },
      { href: '/settings/sections', label: 'Header Sections' },
    ],
  },
  {
    title: 'Security',
    items: [
      { href: '/settings/roles', label: 'Roles & Permissions' },
      { href: '/settings/users', label: 'Users' },
      { href: '/settings/departments', label: 'Departments' },
    ],
  },
  {
    title: 'Coding & Tax',
    items: [
      { href: '/settings/tax-codes', label: 'Tax Codes' },
      { href: '/settings/coding-restrictions', label: 'Coding Restrictions' },
      { href: '/settings/coding-table', label: 'Coding Table' },
    ],
  },
  {
    title: 'Automation',
    items: [
      { href: '/settings/approval-rules', label: 'Approval Rules' },
      { href: '/settings/duplicate-detection', label: 'Duplicate Detection' },
      { href: '/settings/ocr', label: 'OCR' },
    ],
  },
  {
    title: 'Integration',
    items: [
      { href: '/settings/erp', label: 'ERP Sync' },
      { href: '/settings/export-format', label: 'Export Format' },
      { href: '/settings/archive', label: 'Archive' },
      { href: '/settings/audit-retention', label: 'Audit Retention' },
    ],
  },
]

export function SettingsNav() {
  const pathname = usePathname()
  return (
    <nav className="space-y-5 text-sm">
      {SECTIONS.map((section) => (
        <div key={section.title}>
          <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {section.title}
          </div>
          <div className="flex flex-col">
            {section.items.map((item) => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm transition-colors',
                    active
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-foreground/80 hover:bg-muted',
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}
