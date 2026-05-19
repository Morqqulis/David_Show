'use client'

import { create } from 'zustand'
import type { StageId } from '@/backend/lib/stage-ids'

export type RequestsTab = StageId | 'all'

/**
 * Shared client-side state for the active tab on /requests.
 *
 * Lives in a Zustand store (not URL searchParams) so the Sidebar can update
 * synchronously alongside the Tabs component. URL-based searchParams updates
 * through `router.replace` are async — at rapid tab clicks the sidebar lagged
 * a frame behind the active tab, producing a visible flicker. A single source
 * of truth in memory removes that lag entirely.
 *
 * Deep-linking via `/requests?tab=X` still works: the page reads `?tab=` on
 * mount and seeds the store via `setTab` once.
 */
type RequestsTabStore = {
  tab: RequestsTab
  setTab: (tab: RequestsTab) => void
}

export const useRequestsTab = create<RequestsTabStore>((set) => ({
  tab: 'all',
  setTab: (tab) => set({ tab }),
}))
