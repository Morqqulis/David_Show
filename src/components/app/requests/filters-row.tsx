'use client'

import { useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { useRequestsFilters, type InvoiceFlagFilter } from '@/stores/use-requests-filters'

/**
 * Client-side filter inputs. State lives in Zustand so any consumer
 * (table, tab counts, sidebar via effective-counts) reacts in the same
 * React commit. No form submit, no server roundtrip on Apply.
 */
export function FiltersRow({
  urlQ,
  urlFlag,
}: {
  /** When defined, deep-link override; when undefined, trust the store. */
  urlQ?: string
  /** When defined, deep-link override; when undefined, trust the store. */
  urlFlag?: string
}) {
  const q = useRequestsFilters((s) => s.q)
  const flag = useRequestsFilters((s) => s.flag)
  const setQ = useRequestsFilters((s) => s.setQ)
  const setFlag = useRequestsFilters((s) => s.setFlag)
  const reset = useRequestsFilters((s) => s.reset)
  const seed = useRequestsFilters((s) => s.seed)

  // Seed from URL only when at least one filter is in the URL. Otherwise the
  // store's current value wins — so back-nav from /requests/[id] preserves the
  // filter the user had typed before drilling in.
  useEffect(() => {
    if (urlQ === undefined && urlFlag === undefined) return
    seed({ q: urlQ, flag: urlFlag as InvoiceFlagFilter | undefined })
  }, [urlQ, urlFlag, seed])

  const dirty = q !== '' || flag !== ''

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by invoice #, vendor, batch…"
          className="h-9 w-80 pl-8"
        />
      </div>
      <NativeSelect
        name="flag"
        value={flag}
        onChange={(e) => setFlag(e.target.value as InvoiceFlagFilter)}
        className="h-9"
      >
        <option value="">All flags</option>
        <option value="archiveFailed">Archive failed</option>
        <option value="possibleDuplicate">Possible duplicate</option>
        <option value="ocrFailed">OCR failed</option>
        <option value="noAttachment">No attachment</option>
        <option value="vendorSetupRequired">Vendor setup required</option>
      </NativeSelect>
      {dirty ? (
        <Button variant="ghost" size="sm" className="h-9" onClick={reset}>
          Reset
          <X className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
  )
}
