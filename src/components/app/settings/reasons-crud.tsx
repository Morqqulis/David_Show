'use client'

import { useMemo, useState, useTransition } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { ColumnDef } from '@tanstack/react-table'
import { Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataTableColumnHeader } from '@/components/ui/data-table/column-header'
import {
  deleteReason,
  setReasonRequired,
  upsertReason,
  type ReasonList,
  type ReasonOption,
} from '@/backend/actions/reason-actions'
import type { ReasonScope } from '@/backend/collections/ActionReasons'
import { queryKeys } from '@/hooks/use-ap-queries'
import { SimpleCrud } from './simple-crud'

/** What each list is called on screen. Never the internal scope name. */
const SCOPE_COPY: Record<ReasonScope, { tab: string; noun: string; blurb: string }> = {
  reassign: {
    tab: 'Reassigning',
    noun: 'Reassign reason',
    blurb: 'Offered when somebody hands an invoice to a colleague.',
  },
  reject: {
    tab: 'Rejecting',
    noun: 'Reject reason',
    blurb: 'Offered when an invoice is sent back to an earlier stage.',
  },
  cancel: {
    tab: 'Cancelling',
    noun: 'Cancel reason',
    blurb: 'Offered when an invoice is moved to Trash.',
  },
}

type ReasonRow = ReasonOption & { id: string | number }

function buildColumns(): ColumnDef<ReasonRow>[] {
  return [
    {
      accessorKey: 'label',
      meta: { label: 'Reason' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Reason" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.original.label}</span>
          {row.original.isOther ? (
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <Lock className="h-2.5 w-2.5" />
              built in
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: 'order',
      meta: { label: 'Position' },
      size: 110,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Position" />,
      cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.order}</span>,
    },
    {
      accessorKey: 'active',
      meta: { label: 'In use' },
      size: 110,
      header: ({ column }) => <DataTableColumnHeader column={column} title="In use" />,
      cell: ({ row }) =>
        row.original.active ? <Badge>yes</Badge> : <span className="text-muted-foreground">hidden</span>,
    },
  ]
}

export function ReasonsCrud({ lists }: { lists: ReasonList[] }) {
  const columns = useMemo(() => buildColumns(), [])
  return (
    <Tabs defaultValue={lists[0]?.scope ?? 'reassign'}>
      <TabsList>
        {lists.map((list) => (
          <TabsTrigger key={list.scope} value={list.scope}>
            {SCOPE_COPY[list.scope].tab}
          </TabsTrigger>
        ))}
      </TabsList>
      {lists.map((list) => (
        <TabsContent key={list.scope} value={list.scope} className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">{SCOPE_COPY[list.scope].blurb}</p>
          <RequiredToggle scope={list.scope} initial={list.required} />
          <ScopeList list={list} columns={columns} />
        </TabsContent>
      ))}
    </Tabs>
  )
}

/**
 * Whether a reason must be given. Follows the optimistic convention used by
 * every other settings table: flip locally, save in the background, roll back
 * and say so if the save fails.
 */
function RequiredToggle({ scope, initial }: { scope: ReasonScope; initial: boolean }) {
  const qc = useQueryClient()
  const [required, setRequired] = useState(initial)
  const [, startTransition] = useTransition()
  const toastId = `reasons-required-${scope}`

  function save(next: boolean) {
    const previous = required
    setRequired(next)
    startTransition(async () => {
      try {
        await setReasonRequired(scope, next)
        qc.invalidateQueries({ queryKey: queryKeys.reasonList(scope) })
        toast.success('Saved', { id: toastId, duration: 1500 })
      } catch (err) {
        setRequired(previous)
        console.error('[settings/reasons] saving the required setting failed', { scope, next, err })
        toast.error('Could not save — change rolled back', { id: toastId })
      }
    })
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
      <Switch id={`required-${scope}`} checked={required} onCheckedChange={save} />
      <Label htmlFor={`required-${scope}`} className="font-normal">
        A reason must be given before this action can be completed
      </Label>
    </div>
  )
}

function ScopeList({ list, columns }: { list: ReasonList; columns: ColumnDef<ReasonRow>[] }) {
  const qc = useQueryClient()
  return (
    <SimpleCrud<ReasonRow>
      title={SCOPE_COPY[list.scope].noun}
      rows={list.options as ReasonRow[]}
      columns={columns}
      fields={[
        { key: 'label', label: 'Reason' },
        { key: 'order', label: 'Position in the list', type: 'number', defaultValue: 1 },
      ]}
      upsert={(id, patch) => upsertReason(id, { ...patch, scope: list.scope, active: true })}
      remove={deleteReason}
      // Other is permanent — a clerk always needs somewhere to put a reason
      // nobody anticipated. It can be switched off, but not removed.
      canDelete={(row) => !row.isOther}
      emptyMessage="No reasons yet. Add the ones your team actually gives."
      afterMutate={() => qc.invalidateQueries({ queryKey: queryKeys.reasonList(list.scope) })}
    />
  )
}
