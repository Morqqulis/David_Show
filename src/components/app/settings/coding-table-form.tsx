'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { saveCodingRules } from '@/backend/actions/coding-rules-actions'
import type {
  CodingMatchTarget,
  CodingMismatchBehaviour,
  CodingRules,
} from '@/backend/lib/coding-completeness'

/**
 * Optimistic UX contract, same as the other settings tables: local state is the
 * source of truth the moment the user changes something, the server action runs
 * inside a transition, and a failure rolls the field back. One deduped toast id
 * for the whole form, so changing three settings quickly leaves one pill rather
 * than three. No `router.refresh()`.
 */
const TOAST_ID = 'coding-table-save'

const MATCH_TARGET_OPTIONS: Array<{ value: CodingMatchTarget; label: string }> = [
  { value: 'subtotal', label: 'Amount Before Taxes' },
  { value: 'grandTotal', label: 'Invoice Total' },
  { value: 'disabled', label: 'Do not check the totals' },
]

const BEHAVIOUR_OPTIONS: Array<{ value: CodingMismatchBehaviour; label: string }> = [
  { value: 'block', label: 'Stop the approval' },
  { value: 'warn', label: 'Warn, then let it through once confirmed' },
  { value: 'disabled', label: 'Skip the check entirely' },
]

export function CodingTableForm({ rules: initialRules }: { rules: CodingRules }) {
  const [rules, setRules] = useState<CodingRules>(initialRules)
  const [, startTransition] = useTransition()
  // What the database is known to hold. The free-text boxes save on blur, so
  // they need something to compare against to avoid re-saving an untouched
  // value on every click away.
  const persisted = useRef<CodingRules>(initialRules)

  function save(patch: Partial<CodingRules>) {
    const previous = rules
    setRules((cur) => ({ ...cur, ...patch }))
    startTransition(async () => {
      try {
        await saveCodingRules(patch)
        persisted.current = { ...persisted.current, ...patch }
        toast.success('Coding table settings saved', { id: TOAST_ID, duration: 1500 })
      } catch (err) {
        setRules(previous)
        console.error('[coding-table] save failed', { patch, err })
        toast.error('Could not save — change rolled back', { id: TOAST_ID })
      }
    })
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-1.5">
        <Label htmlFor="coding-match-target">Coding lines must add up to</Label>
        <Select
          value={rules.matchTarget}
          onValueChange={(value) => save({ matchTarget: value as CodingMatchTarget })}
        >
          <SelectTrigger id="coding-match-target" className="w-full max-w-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MATCH_TARGET_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          The invoice amount the coded lines are compared against before an approval is allowed.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="coding-on-mismatch">When an invoice is not fully coded</Label>
        <Select
          value={rules.onMismatch}
          onValueChange={(value) => save({ onMismatch: value as CodingMismatchBehaviour })}
        >
          <SelectTrigger id="coding-on-mismatch" className="w-full max-w-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BEHAVIOUR_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          An invoice counts as fully coded when it has at least one line, every line has a GL
          account, and the lines add up to the amount chosen above. A missing tax code never blocks
          a coder.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="coding-message">Message shown to the user</Label>
        <Input
          id="coding-message"
          className="w-full max-w-md"
          value={rules.message}
          onChange={(e) => setRules((cur) => ({ ...cur, message: e.target.value }))}
          onBlur={(e) => {
            const next = e.target.value.trim()
            // An empty message would leave a blocked coder with no explanation,
            // so restore the last saved wording instead of persisting nothing.
            if (next.length === 0) {
              setRules((cur) => ({ ...cur, message: persisted.current.message }))
              return
            }
            if (next === persisted.current.message) return
            save({ message: next })
          }}
        />
        <p className="text-xs text-muted-foreground">
          Saved when you click away from the box.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="coding-tolerance">Rounding allowance</Label>
        <Input
          id="coding-tolerance"
          type="number"
          step={0.01}
          min={0}
          className="w-full max-w-48"
          value={String(rules.tolerance)}
          onChange={(e) =>
            setRules((cur) => ({ ...cur, tolerance: Number.parseFloat(e.target.value || '0') }))
          }
          onBlur={(e) => {
            const parsed = Number.parseFloat(e.target.value)
            const next = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0.01
            setRules((cur) => ({ ...cur, tolerance: next }))
            if (next === persisted.current.tolerance) return
            save({ tolerance: next })
          }}
        />
        <p className="text-xs text-muted-foreground">
          Difference in dollars that is still treated as a match. 0.01 allows one cent of rounding.
        </p>
      </div>
    </div>
  )
}
