import Link from 'next/link'
import { Topbar } from '@/components/app/topbar'
import { PageHeader } from '@/components/app/page-header'
import { EmailNav } from '@/components/app/email-nav'

export default function EmailLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Topbar crumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Email' }]} />
      <main className="flex-1 overflow-y-auto p-8 space-y-4">
        <PageHeader
          title="Email"
          description="Configure templates, what events trigger them, and the global delivery settings."
        />
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <EmailNav />
          <div className="min-w-0">{children}</div>
        </div>
      </main>
    </>
  )
}
