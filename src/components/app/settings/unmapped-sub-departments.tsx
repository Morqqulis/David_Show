'use client'

import { Badge } from '@/components/ui/badge'

export type SubDepartmentUsage = { value: string; glCount: number }

/**
 * The sub-departments in use across the GL master that no range covers — the
 * mechanism by which a new capital-project code gets noticed instead of
 * quietly becoming everybody's to code.
 */
export function UnmappedSubDepartments({
  values,
  catchAllDepartmentName,
}: {
  values: SubDepartmentUsage[]
  catchAllDepartmentName: string | null
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-sm font-medium">Not mapped yet</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Sub-departments used by GL accounts that no range above covers. They go to{' '}
        {catchAllDepartmentName ?? 'the catch-all department'} until somebody maps them.
      </p>
      {values.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Nothing — every sub-department in use is covered.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {values.map((u) => (
            <Badge key={u.value} variant="outline" className="font-mono text-[10px]">
              {u.value} · {u.glCount} account{u.glCount === 1 ? '' : 's'}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
