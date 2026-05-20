'use client'

import { useQuery } from '@tanstack/react-query'
import { STAGE_LABELS, type StageId } from '@/backend/lib/stage-ids'
import { fetchQueueCounts } from '@/backend/actions/query-actions'
import { queryKeys, type QueueCountsPayload } from './use-ap-queries'

/**
 * Returns the live stage label dictionary, merging admin-edited labels on top
 * of the compiled-in fallback in `STAGE_LABELS`.
 *
 * Architecturally this is a *selector* over the `queueCounts` TanStack cache.
 * It registers as a real consumer (queryKey + queryFn) — not `enabled: false`
 * — so that TanStack:
 *   1. Deduplicates with the SidebarNav's `useQueueCounts(initial)`, sharing
 *      the same network round-trip when both are mounted in the same tree.
 *   2. Fetches on its own if this hook renders on a route where the sidebar
 *      seed never ran (e.g. a server-component-only branch hot-reloaded in
 *      isolation), instead of throwing "No queryFn passed".
 *
 * Returns the static `STAGE_LABELS` while data is loading so callers never
 * see `undefined` labels — admin label edits surface on the next poll.
 */
export function useStageLabels(): Record<StageId, string> {
  const { data } = useQuery<QueueCountsPayload>({
    queryKey: queryKeys.queueCounts,
    queryFn: () => fetchQueueCounts(),
  })
  if (!data?.stages?.length) return STAGE_LABELS
  const overrides: Partial<Record<StageId, string>> = {}
  for (const s of data.stages) overrides[s.systemId] = s.label
  return { ...STAGE_LABELS, ...overrides }
}
