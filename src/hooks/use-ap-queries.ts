'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { StageId } from '@/backend/lib/stage-ids'
import { unwrap } from '@/lib/action-result'
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
import { fetchReasonList } from '@/backend/actions/reason-actions'
import type { ReasonScope } from '@/backend/collections/ActionReasons'
import {
  fetchBulkReassignContext,
  fetchBulkReassignPermission,
  fetchInvoicesForReassign,
  fetchOpenWorkFor,
  fetchReassignAvailability,
  fetchReassignContext,
  reassignInvoices,
  type ReassignCommand,
} from '@/backend/actions/reassign-actions'

export type { QueueCountsPayload, LookupsPayload }

export const queryKeys = {
  queueCounts: ['queue-counts'] as const,
  lookups: ['lookups'] as const,
  invoice: (id: string | number) => ['invoice', String(id)] as const,
  reasonList: (scope: ReasonScope) => ['reason-list', scope] as const,
  reassignContext: (id: string | number) => ['reassign-context', String(id)] as const,
  bulkReassignContext: ['bulk-reassign-context'] as const,
  openWork: (userId: string | number, stage?: string, department?: string) =>
    ['open-work', String(userId), stage ?? '', department ?? ''] as const,
}

// ────────────────────────────────────────────────────────────────────────────
// Queries (server actions as queryFn — type-safe end-to-end)
// ────────────────────────────────────────────────────────────────────────────

export function useQueueCounts(initialData?: QueueCountsPayload) {
  // No polling, no auto-refetch. Counts come from SSR initialData; mutations
  // invalidate this query explicitly, and the Refresh button in the topbar
  // forces a re-fetch on demand.
  return useQuery({
    queryKey: queryKeys.queueCounts,
    queryFn: () => fetchQueueCounts(),
    initialData,
  })
}

export function useLookups(initialData?: LookupsPayload) {
  return useQuery({
    queryKey: queryKeys.lookups,
    queryFn: () => fetchLookups(),
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
    mutationFn: async ({
      id,
      acknowledgedWarning,
    }: {
      id: string | number
      currentStage?: StageId
      /** Set once the user has confirmed a Warn-level sum-match message. */
      acknowledgedWarning?: boolean
    }) => {
      // `unwrap` is what turns the sum-match gate's configured block message
      // into a thrown error the mutation's onError can show. Awaiting without
      // it would discard the refusal and report a successful approval.
      unwrap(await approveInvoice(id, { acknowledgedWarning }))
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
    mutationFn: async ({
      id,
      target,
      reasonId,
      otherText,
    }: {
      id: string | number
      target: StageId
      /** A row in the admin-managed Reject reason list, or null when optional. */
      reasonId: string | number | null
      /** The free-text line the built-in Other option reveals. */
      otherText?: string
    }) => {
      unwrap(await rejectInvoice(id, target, reasonId, otherText))
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

// ────────────────────────────────────────────────────────────────────────────
// Reasons and reassignment
// ────────────────────────────────────────────────────────────────────────────

/**
 * One admin-managed reason list. Shared by the Reassign, Reject and Cancel
 * pickers — the scope is the only thing that differs between them.
 * Reason lists change about as often as tax codes, so they are cached for the
 * session and dropped when Settings → Reasons saves.
 */
export function useReasonList(scope: ReasonScope, enabled = true) {
  return useQuery({
    queryKey: queryKeys.reasonList(scope),
    queryFn: () => fetchReasonList(scope),
    enabled,
    staleTime: 5 * 60_000,
  })
}

/**
 * Whether the Reassign button belongs on this invoice. Deliberately a separate,
 * cheap query — the invoice screen asks it on every open, and the full modal
 * context is only worth loading once somebody clicks.
 */
export function useReassignAvailability(invoiceId: string | number) {
  return useQuery({
    queryKey: [...queryKeys.reassignContext(invoiceId), 'availability'] as const,
    queryFn: () => fetchReassignAvailability(invoiceId),
    staleTime: 60_000,
  })
}

/** Directory, invoice state and slots for the single-invoice Reassign modal. */
export function useReassignContext(invoiceId: string | number, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.reassignContext(invoiceId),
    queryFn: () => fetchReassignContext(invoiceId),
    enabled,
  })
}

/**
 * Whether the bulk Reassign buttons belong on All Requests. Cheap on purpose —
 * the toolbar asks on every render, and the directory only loads when a modal
 * actually opens.
 */
export function useBulkReassignPermission() {
  return useQuery({
    queryKey: ['bulk-reassign-permission'] as const,
    queryFn: () => fetchBulkReassignPermission(),
    staleTime: 5 * 60_000,
  })
}

/** Directory plus the stage and department filter options for both bulk screens. */
export function useBulkReassignContext(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.bulkReassignContext,
    queryFn: () => fetchBulkReassignContext(),
    enabled,
    staleTime: 5 * 60_000,
  })
}

/**
 * The rows ticked on All Requests, re-read from the database. The table's own
 * row data is a display projection and does not carry approval slots, so the
 * bulk modal cannot work out whose turn it is from it.
 */
export function useInvoicesForReassign(invoiceIds: Array<string | number>, enabled: boolean) {
  return useQuery({
    queryKey: ['reassign-selection', invoiceIds.map(String).sort().join(',')] as const,
    queryFn: () => fetchInvoicesForReassign(invoiceIds),
    enabled: enabled && invoiceIds.length > 0,
  })
}

/** One person's open work, for the from-person bulk entry point. */
export function useOpenWorkFor(
  userId: string | number | null,
  filters: { stageSystemId?: string; departmentId?: string },
) {
  return useQuery({
    queryKey: queryKeys.openWork(userId ?? '', filters.stageSystemId, filters.departmentId),
    queryFn: () => fetchOpenWorkFor(userId as string | number, filters),
    enabled: userId !== null,
  })
}

/**
 * The one reassignment mutation. Single and bulk both land here, because the
 * server has one engine behind them; only the invoice list differs.
 * Partial success is normal, so the caller reads the outcome rather than
 * relying on the promise resolving.
 */
export function useReassignInvoices() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (cmd: ReassignCommand) => unwrap(await reassignInvoices(cmd)),
    onError: (err) => {
      console.error('[reassign] the operation could not be completed', { err })
      toast.error((err as Error).message || 'The invoices could not be reassigned.')
    },
    onSettled: (_d, _e, cmd) => {
      for (const id of cmd.invoiceIds) {
        qc.invalidateQueries({ queryKey: queryKeys.invoice(id) })
        qc.invalidateQueries({ queryKey: queryKeys.reassignContext(id) })
      }
      qc.invalidateQueries({ queryKey: queryKeys.queueCounts })
      qc.invalidateQueries({ queryKey: ['open-work'] })
    },
  })
}
