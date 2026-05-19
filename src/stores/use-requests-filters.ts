'use client'

import { create } from 'zustand'

export type InvoiceFlagFilter =
  | ''
  | 'archiveFailed'
  | 'possibleDuplicate'
  | 'ocrFailed'
  | 'noAttachment'
  | 'vendorSetupRequired'

/**
 * Client-side filter state for /requests.
 *
 * Active invoices are fully loaded on the client (Payload `select` keeps the
 * payload small) so filters apply via in-memory derivation rather than a
 * server roundtrip. Apply feels instant; tab counts and sidebar update in the
 * same React commit as the table.
 *
 * Completed invoices are paginated server-side. Current iteration filters
 * them client-side too — only the visible page is searched. If a customer
 * has a large completed archive and wants cross-page filter, swap that
 * specific tab to a server query.
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
