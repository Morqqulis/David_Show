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
  initialQ = '',
  initialFlag = '',
}: {
  initialQ?: string
  initialFlag?: string
}) {
  const q = useRequestsFilters((s) => s.q)
  const flag = useRequestsFilters((s) => s.flag)
  const setQ = useRequestsFilters((s) => s.setQ)
  const setFlag = useRequestsFilters((s) => s.setFlag)
  const reset = useRequestsFilters((s) => s.reset)
  const seed = useRequestsFilters((s) => s.seed)

  // Seed once from URL params on mount — keeps deep-links working.
  useEffect(() => {
    seed({ q: initialQ, flag: initialFlag as InvoiceFlagFilter })
  }, [initialQ, initialFlag, seed])

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
