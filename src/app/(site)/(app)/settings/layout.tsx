import Link from 'next/link'
import { Topbar } from '@/components/app/topbar'
import { PageHeader } from '@/components/app/page-header'
import { SettingsNav } from '@/components/app/settings-nav'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Topbar crumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Settings' }]} />
      <main className="flex-1 overflow-y-auto p-8 space-y-4">
        <PageHeader
          title="Settings"
          description="Everything in the AP app is configurable — fields, stages, roles, rules, taxes, archive."
        />
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <SettingsNav />
          <div className="min-w-0">{children}</div>
        </div>
      </main>
    </>
  )
}
