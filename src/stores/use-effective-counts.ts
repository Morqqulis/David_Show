'use client'

import { create } from 'zustand'
import type { StageId } from '@/backend/lib/stage-ids'

export type StageCounts = Record<StageId | 'all', number>

/**
 * Effective per-stage counts visible to the Sidebar.
 *
 * The /requests screen writes the counts the server returned alongside the
 * rows here, so the Sidebar reflects exactly the filter the user applied and
 * updates in the same React commit as the table. On any other page the store
 * stays null and the Sidebar falls back to the unfiltered polled counts from
 * TanStack (`useQueueCounts`).
 *
 * Cleared when the requests screen unmounts, to avoid showing stale filtered
 * counts after navigating away.
 */
type EffectiveCountsStore = {
  counts: StageCounts | null
  setCounts: (counts: StageCounts | null) => void
}

export const useEffectiveCounts = create<EffectiveCountsStore>((set) => ({
  counts: null,
  setCounts: (counts) => set({ counts }),
}))
