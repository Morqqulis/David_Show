'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function PaginationBar({
  page,
  totalPages,
  totalDocs,
  pageSize,
  basePath,
}: {
  page: number
  totalPages: number
  totalDocs: number
  pageSize: number
  basePath: string
}) {
  const params = useSearchParams()

  function hrefFor(targetPage: number) {
    const next = new URLSearchParams(params.toString())
    if (targetPage <= 1) next.delete('page')
    else next.set('page', String(targetPage))
    const qs = next.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  if (totalDocs === 0) return null

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalDocs)
  const prev = Math.max(1, page - 1)
  const next = Math.min(totalPages, page + 1)
  const window = pageWindow(page, totalPages)

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
      <span>
        Showing <strong className="text-foreground">{start}</strong>–<strong className="text-foreground">{end}</strong>{' '}
        of <strong className="text-foreground">{totalDocs}</strong>
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" asChild disabled={page <= 1}>
          <Link href={hrefFor(prev)} aria-disabled={page <= 1} className={page <= 1 ? 'pointer-events-none opacity-50' : ''}>
            <ChevronLeft className="h-3.5 w-3.5" />
            Prev
          </Link>
        </Button>
        {window.map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="px-2">
              …
            </span>
          ) : (
            <Button
              key={p}
              variant={p === page ? 'default' : 'outline'}
              size="sm"
              asChild
              className={cn('min-w-[32px] tabular-nums', p === page && 'pointer-events-none')}
            >
              <Link href={hrefFor(p)}>{p}</Link>
            </Button>
          ),
        )}
        <Button variant="outline" size="sm" asChild disabled={page >= totalPages}>
          <Link
            href={hrefFor(next)}
            aria-disabled={page >= totalPages}
            className={page >= totalPages ? 'pointer-events-none opacity-50' : ''}
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  )
}

function pageWindow(current: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: Array<number | '…'> = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) pages.push('…')
  for (let p = start; p <= end; p++) pages.push(p)
  if (end < total - 1) pages.push('…')
  pages.push(total)
  return pages
}
