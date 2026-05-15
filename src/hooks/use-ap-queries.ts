'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { StageId } from '@/backend/lib/stage-ids'
import {
  approveInvoice,
  rejectInvoice,
  verifyInvoice,
  setConfidential,
} from '@/backend/actions/invoice'
import {
  fetchQueueCounts,
  fetchLookups,
  fetchInvoice,
  type QueueCountsPayload,
  type LookupsPayload,
} from '@/backend/actions/query-actions'

export type { QueueCountsPayload, LookupsPayload }

export const queryKeys = {
  queueCounts: ['queue-counts'] as const,
  lookups: ['lookups'] as const,
  invoice: (id: string | number) => ['invoice', String(id)] as const,
}

// ────────────────────────────────────────────────────────────────────────────
// Queries (server actions as queryFn — type-safe end-to-end)
// ────────────────────────────────────────────────────────────────────────────

export function useQueueCounts(initialData?: QueueCountsPayload) {
  return useQuery({
    queryKey: queryKeys.queueCounts,
    queryFn: () => fetchQueueCounts(),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    initialData,
    staleTime: 15_000,
  })
}

export function useLookups(initialData?: LookupsPayload) {
  return useQuery({
    queryKey: queryKeys.lookups,
    queryFn: () => fetchLookups(),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    initialData,
  })
}

export function useInvoice(
  id: string | number,
  options?: { enabled?: boolean; initialData?: unknown },
) {
  return useQuery({
    queryKey: queryKeys.invoice(id),
    queryFn: () => fetchInvoice(id),
    staleTime: 10_000,
    enabled: options?.enabled ?? true,
    // initialData lets TanStack skip the initial fetch when SSR already
    // provided the data. Without this, every InvoiceView mount duplicated
    // the server's getInvoiceWithLines call — a 3s redundant round-trip.
    initialData: options?.initialData as never,
  })
}

export function usePrefetchInvoice() {
  const queryClient = useQueryClient()
  return (id: string | number) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.invoice(id),
      queryFn: () => fetchInvoice(id),
      staleTime: 30_000,
    })
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Mutations with optimistic updates
// ────────────────────────────────────────────────────────────────────────────

export function useApproveInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string | number; currentStage?: StageId }) => {
      await approveInvoice(id)
    },
    onMutate: async ({ id, currentStage }) => {
      await qc.cancelQueries({ queryKey: queryKeys.invoice(id) })
      const previous = qc.getQueryData(queryKeys.invoice(id))
      if (currentStage) {
        qc.setQueryData(queryKeys.invoice(id), (old: unknown) => {
          if (!old || typeof old !== 'object') return old
          const data = old as { invoice?: { currentStage?: { systemId?: StageId; label?: string } } }
          if (data.invoice?.currentStage) {
            data.invoice.currentStage = {
              ...data.invoice.currentStage,
              label: 'Advancing…',
            }
          }
          return { ...data }
        })
      }
      return { previous }
    },
    onError: (err, vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.invoice(vars.id), ctx.previous)
      toast.error((err as Error).message || 'Approve failed')
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.invoice(vars.id) })
      qc.invalidateQueries({ queryKey: queryKeys.queueCounts })
    },
    onSuccess: () => toast.success('Approved — advanced to next stage'),
  })
}

export function useRejectInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, target, reason }: { id: string | number; target: StageId; reason: string }) => {
      await rejectInvoice(id, target, reason)
    },
    onError: (err) => toast.error((err as Error).message || 'Reject failed'),
    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.invoice(vars.id) })
      qc.invalidateQueries({ queryKey: queryKeys.queueCounts })
    },
    onSuccess: (_d, vars) => {
      toast.success(`Rejected — sent to ${vars.target.replace(/_/g, ' ')}`)
    },
  })
}

export function useVerifyInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, value }: { id: string | number; value: boolean }) => {
      await verifyInvoice(id, value)
    },
    onMutate: async ({ id, value }) => {
      await qc.cancelQueries({ queryKey: queryKeys.invoice(id) })
      const previous = qc.getQueryData(queryKeys.invoice(id))
      qc.setQueryData(queryKeys.invoice(id), (old: unknown) => {
        if (!old || typeof old !== 'object') return old
        const data = old as { invoice?: { verified?: boolean } }
        if (data.invoice) data.invoice.verified = value
        return { ...data }
      })
      return { previous }
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.invoice(vars.id), ctx.previous)
      toast.error('Verification update failed')
    },
    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.invoice(vars.id) })
      qc.invalidateQueries({ queryKey: queryKeys.queueCounts })
    },
    onSuccess: (_d, vars) => toast.success(vars.value ? 'Marked verified' : 'Verification cleared'),
  })
}

export function useSetConfidential() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, value }: { id: string | number; value: boolean }) => {
      await setConfidential(id, value)
    },
    onMutate: async ({ id, value }) => {
      await qc.cancelQueries({ queryKey: queryKeys.invoice(id) })
      const previous = qc.getQueryData(queryKeys.invoice(id))
      qc.setQueryData(queryKeys.invoice(id), (old: unknown) => {
        if (!old || typeof old !== 'object') return old
        const data = old as { invoice?: { confidential?: boolean } }
        if (data.invoice) data.invoice.confidential = value
        return { ...data }
      })
      return { previous }
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.invoice(vars.id), ctx.previous)
      toast.error('Update failed')
    },
    onSettled: (_d, _e, vars) => qc.invalidateQueries({ queryKey: queryKeys.invoice(vars.id) }),
    onSuccess: (_d, vars) => toast.success(vars.value ? 'Marked confidential' : 'Confidential cleared'),
  })
}
