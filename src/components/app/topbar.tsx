import Link from 'next/link'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

export function Topbar({ crumbs }: { crumbs?: { label: string; href?: string }[] }) {
  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-background/80 px-6 backdrop-blur">
      {crumbs && crumbs.length > 0 ? (
        <Breadcrumb>
          <BreadcrumbList>
            {crumbs.map((c, i) => {
              const isLast = i === crumbs.length - 1
              return (
                <span key={i} className="contents">
                  {i > 0 ? <BreadcrumbSeparator /> : null}
                  <BreadcrumbItem>
                    {isLast || !c.href ? (
                      <BreadcrumbPage>{c.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href={c.href}>{c.label}</Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </span>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
      ) : null}

      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
