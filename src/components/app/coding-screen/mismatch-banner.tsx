import { AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CodingVerdict } from '@/backend/lib/coding-completeness'

export type OutstandingDepartment = { id: string | number; name: string }

/**
 * Tells the coder, before they ever click Approve, what the sum-match rule will
 * say. Purely informational — the rule itself is enforced on the server.
 */
export function MismatchBanner({
  verdict,
  enforced,
  outstandingDepartments,
}: {
  verdict: CodingVerdict
  enforced: boolean
  outstandingDepartments: OutstandingDepartment[]
}) {
  const blocking = enforced && verdict.behaviour === 'block'
  const others = outstandingDepartments.map((d) => d.name)

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
        blocking
          ? 'border-red-300 bg-red-50 text-red-800'
          : 'border-amber-300 bg-amber-50 text-amber-800',
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="space-y-1">
        <div className="font-medium">
          {blocking ? 'This invoice cannot be approved yet' : 'This invoice is not fully coded'}
        </div>
        <ul className="list-disc space-y-0.5 pl-4 text-xs">
          {verdict.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        {!enforced ? (
          <div className="flex items-start gap-1.5 pt-0.5 text-xs">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {others.length > 0
                ? `Other departments are still coding this invoice (${others.join(', ')}), so you can submit your own lines now. The totals are checked when the last department approves.`
                : 'Other departments are still coding this invoice, so you can submit your own lines now. The totals are checked when the last department approves.'}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
