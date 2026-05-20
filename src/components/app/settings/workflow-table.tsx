'use client'

import { useState, useTransition } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Lock } from 'lucide-react'
import { updateStage } from '@/backend/actions/settings-actions'
import { queryKeys, type QueueCountsPayload } from '@/hooks/use-ap-queries'

type Stage = {
  id: string | number
  systemId: string
  label: string
  active: boolean
  required: boolean
  bulkAssign: boolean
  batchAssign: boolean
  verifyFlag: boolean
  allowReject: boolean
  allowReassign: boolean
  order: number
}

/**
 * Optimistic UX contract for this table:
 *
 *  - The `stages` prop seeds local state ONCE on mount. After that, this
 *    component is the source of truth. The server is a persistence layer
 *    we sync to in the background.
 *  - Every Switch / label edit flips the local state synchronously on the
 *    same task as the click — no `router.refresh()`, no "Postgres
 *    roundtrip → re-render whole route" pause. The user gets a 0-frame
 *    visual response.
 *  - The server action runs inside a transition. On success we just drop the
 *    TanStack queue-counts cache so the sidebar picks up the label rename.
 *  - On failure we roll back the optimistic patch and surface a toast.
 *  - We intentionally skip `router.refresh()` — the previous implementation
 *    paid 300-500ms per toggle for a server-side re-render that this view
 *    no longer needs (it has its own local truth).
 */
export function WorkflowTable({ stages: initialStages }: { stages: Stage[] }) {
  const qc = useQueryClient()
  const [stages, setStages] = useState<Stage[]>(initialStages)
  const [, startTransition] = useTransition()

  function save(
    id: string | number,
    patch: Partial<Stage>,
  ) {
    // Snapshot for rollback BEFORE mutating.
    const previous = stages.find((s) => String(s.id) === String(id))
    if (!previous) return

    setStages((cur) =>
      cur.map((s) => (String(s.id) === String(id) ? { ...s, ...patch } : s)),
    )

    // Mirror the patch into the TanStack `queueCounts` cache so the sidebar
    // (and every consumer of `useStageLabels`) reflects the rename / toggle
    // synchronously. Without this we'd be paying ~3s for an
    // `invalidateQueries → fetchQueueCounts → 9 Postgres roundtrips` cycle
    // every time someone flips a switch, even though we already know the
    // exact patch to apply.
    const previousCache = qc.getQueryData<QueueCountsPayload>(queryKeys.queueCounts)
    if (previousCache) {
      qc.setQueryData<QueueCountsPayload>(queryKeys.queueCounts, {
        ...previousCache,
        stages: previousCache.stages.map((s) =>
          String(s.id) === String(id)
            ? {
                ...s,
                // The cache shape only exposes the fields that drive the
                // sidebar — label, order, active. Other toggles (bulkAssign,
                // verifyFlag, etc.) don't affect the sidebar so we skip them.
                ...(patch.label !== undefined ? { label: patch.label } : null),
                ...(patch.order !== undefined ? { order: patch.order } : null),
                ...(patch.active !== undefined ? { active: patch.active } : null),
              }
            : s,
        ),
      })
    }

    startTransition(async () => {
      try {
        await updateStage(id, patch as Record<string, unknown>)
        // No success toast. The Switch / label is already in its new visual
        // state from the optimistic update — confirming "Saved" 1-2s later,
        // after the user has moved on, just creates a stream of stale toasts
        // when they flip several switches in a row.
      } catch (err) {
        setStages((cur) =>
          cur.map((s) => (String(s.id) === String(id) ? previous : s)),
        )
        if (previousCache) {
          qc.setQueryData<QueueCountsPayload>(queryKeys.queueCounts, previousCache)
        }
        console.error('[settings/workflow] updateStage failed', { id, patch, err })
        toast.error('Could not save — change rolled back')
      }
    })
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60px]">Order</TableHead>
            <TableHead className="w-[260px]">Stage</TableHead>
            <TableHead>Active</TableHead>
            <TableHead>Bulk Assign</TableHead>
            <TableHead>Batch Assign</TableHead>
            <TableHead>Verify Flag</TableHead>
            <TableHead>Reject</TableHead>
            <TableHead>Reassign</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stages.map((s) => (
            <TableRow key={String(s.id)}>
              <TableCell className="tabular-nums text-muted-foreground">{s.order}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Input
                    // `key` ties the uncontrolled input to the underlying row;
                    // if state ever rolls back we want the input to re-mount
                    // with the rolled-back label rather than keeping the
                    // typed-but-not-saved value visible.
                    key={`${s.id}:${s.label}`}
                    defaultValue={s.label}
                    onBlur={(e) => {
                      const v = e.currentTarget.value
                      if (v && v !== s.label) save(s.id, { label: v })
                    }}
                    className="h-8 max-w-[200px]"
                  />
                  <Badge variant="secondary" className="text-[10px]">{s.systemId}</Badge>
                  {s.required ? <Lock className="h-3 w-3 text-amber-600" /> : null}
                </div>
              </TableCell>
              <TableCell>
                <Switch
                  checked={s.active}
                  disabled={s.required}
                  onCheckedChange={(v) => save(s.id, { active: v })}
                />
              </TableCell>
              <TableCell>
                <Switch checked={s.bulkAssign} onCheckedChange={(v) => save(s.id, { bulkAssign: v })} />
              </TableCell>
              <TableCell>
                <Switch checked={s.batchAssign} onCheckedChange={(v) => save(s.id, { batchAssign: v })} />
              </TableCell>
              <TableCell>
                <Switch checked={s.verifyFlag} onCheckedChange={(v) => save(s.id, { verifyFlag: v })} />
              </TableCell>
              <TableCell>
                <Switch checked={s.allowReject} onCheckedChange={(v) => save(s.id, { allowReject: v })} />
              </TableCell>
              <TableCell>
                <Switch checked={s.allowReassign} onCheckedChange={(v) => save(s.id, { allowReassign: v })} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
