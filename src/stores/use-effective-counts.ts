'use client'

import { create } from 'zustand'
import type { StageId } from '@/backend/lib/stage-ids'

export type StageCounts = Record<StageId | 'all', number>

/**
 * Effective per-stage counts visible to the Sidebar.
 *
 * The /requests page writes the filtered counts here on render so the Sidebar
 * reflects the same filter the user applied. On any other page the store
 * stays null and the Sidebar falls back to the unfiltered polled counts from
 * TanStack (`useQueueCounts`).
 *
 * Cleared on unmount of RequestsTabs to avoid showing stale filtered counts
 * after navigating away.
 */
type EffectiveCountsStore = {
  counts: StageCounts | null
  setCounts: (counts: StageCounts | null) => void
}

export const useEffectiveCounts = create<EffectiveCountsStore>((set) => ({
  counts: null,
  setCounts: (counts) => set({ counts }),
}))
