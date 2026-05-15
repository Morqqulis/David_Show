'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Lock } from 'lucide-react'
import { updateStage } from '@/backend/actions/settings-actions'

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

export function WorkflowTable({ stages }: { stages: Stage[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  function save(id: string | number, patch: Record<string, unknown>, msg: string) {
    startTransition(async () => {
      await updateStage(id, patch)
      toast.success(msg)
      router.refresh()
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
                    defaultValue={s.label}
                    onBlur={(e) => {
                      const v = e.currentTarget.value
                      if (v && v !== s.label) save(s.id, { label: v }, 'Label saved')
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
                  onCheckedChange={(v) => save(s.id, { active: v }, `${s.label} ${v ? 'enabled' : 'disabled'}`)}
                />
              </TableCell>
              <TableCell>
                <Switch checked={s.bulkAssign} onCheckedChange={(v) => save(s.id, { bulkAssign: v }, 'Saved')} />
              </TableCell>
              <TableCell>
                <Switch checked={s.batchAssign} onCheckedChange={(v) => save(s.id, { batchAssign: v }, 'Saved')} />
              </TableCell>
              <TableCell>
                <Switch checked={s.verifyFlag} onCheckedChange={(v) => save(s.id, { verifyFlag: v }, 'Saved')} />
              </TableCell>
              <TableCell>
                <Switch checked={s.allowReject} onCheckedChange={(v) => save(s.id, { allowReject: v }, 'Saved')} />
              </TableCell>
              <TableCell>
                <Switch checked={s.allowReassign} onCheckedChange={(v) => save(s.id, { allowReassign: v }, 'Saved')} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
