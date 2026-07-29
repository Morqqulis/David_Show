'use client'

import { create } from 'zustand'

export type InvoiceFlagFilter =
  | ''
  | 'archiveFailed'
  | 'possibleDuplicate'
  | 'ocrFailed'
  | 'noAttachment'
  | 'vendorSetupRequired'
  | 'amountMismatch'

/**
 * Search and flag inputs for /requests.
 *
 * This store exists so the text box echoes instantly while the real query is
 * still in flight. It is NOT what narrows the list: the URL carries the search
 * to the server, which filters the whole result set. Keeping the typed value
 * here and the answered value in the URL is what stops a filter from looking
 * applied while the rows still belong to the previous query.
 */
type RequestsFiltersStore = {
  q: string
  flag: InvoiceFlagFilter
  setQ: (q: string) => void
  setFlag: (flag: InvoiceFlagFilter) => void
  reset: () => void
  seed: (init: { q?: string; flag?: InvoiceFlagFilter }) => void
}

export const useRequestsFilters = create<RequestsFiltersStore>((set) => ({
  q: '',
  flag: '',
  setQ: (q) => set({ q }),
  setFlag: (flag) => set({ flag }),
  reset: () => set({ q: '', flag: '' }),
  seed: ({ q, flag }) => set({ q: q ?? '', flag: (flag as InvoiceFlagFilter) ?? '' }),
}))
