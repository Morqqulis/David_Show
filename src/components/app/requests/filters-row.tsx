'use client'

import { useEffect, useRef, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { useRequestsFilters, type InvoiceFlagFilter } from '@/stores/use-requests-filters'

/** Typing pause before the search runs, so each keystroke is not a database trip. */
const SEARCH_DEBOUNCE_MS = 300

/**
 * Search and flag filters for All Requests.
 *
 * The typed value echoes instantly from the shared store, then lands in the
 * URL a moment later; the server answers with matching rows from the whole
 * result set rather than whatever page is loaded.
 */
export function FiltersRow({
  urlQ,
  urlFlag,
}: {
  urlQ?: string
  urlFlag?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const q = useRequestsFilters((s) => s.q)
  const flag = useRequestsFilters((s) => s.flag)
  const setQ = useRequestsFilters((s) => s.setQ)
  const setFlag = useRequestsFilters((s) => s.setFlag)
  const seed = useRequestsFilters((s) => s.seed)

  // The URL is the source of truth for what the server was asked. Adopt it
  // whenever it changes underneath us (deep link, back button, view applied).
  useEffect(() => {
    seed({ q: urlQ, flag: urlFlag as InvoiceFlagFilter | undefined })
  }, [urlQ, urlFlag, seed])

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (debounce.current) clearTimeout(debounce.current)
  }, [])

  function pushFilters(next: { q?: string; flag?: string }, delay: number) {
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      const nextQ = next.q ?? q
      const nextFlag = next.flag ?? flag
      if (nextQ) params.set('q', nextQ)
      else params.delete('q')
      if (nextFlag) params.set('flag', nextFlag)
      else params.delete('flag')
      // Any change to the filter invalidates the page the user was on.
      params.delete('page')
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
      })
    }, delay)
  }

  const dirty = q !== '' || flag !== ''

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            pushFilters({ q: e.target.value }, SEARCH_DEBOUNCE_MS)
          }}
          placeholder="Search by invoice #, vendor, batch…"
          className="h-9 w-80 pl-8"
        />
      </div>
      <NativeSelect
        name="flag"
        value={flag}
        onChange={(e) => {
          setFlag(e.target.value as InvoiceFlagFilter)
          pushFilters({ flag: e.target.value }, 0)
        }}
        className="h-9"
      >
        <option value="">All flags</option>
        <option value="archiveFailed">Archive failed</option>
        <option value="possibleDuplicate">Possible duplicate</option>
        <option value="ocrFailed">OCR failed</option>
        <option value="noAttachment">No attachment</option>
        <option value="vendorSetupRequired">Vendor setup required</option>
        <option value="amountMismatch">Amounts do not add up</option>
      </NativeSelect>
      {dirty ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-9"
          onClick={() => {
            setQ('')
            setFlag('')
            pushFilters({ q: '', flag: '' }, 0)
          }}
        >
          Reset
          <X className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
  )
}
