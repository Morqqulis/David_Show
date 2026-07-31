'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { unwrap } from '@/lib/action-result'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { DUPLICATE_KEY_FIELDS } from '@/backend/lib/duplicate-detection'
import { saveDuplicateRule } from '@/backend/actions/intake-settings-actions'

export type DuplicateRuleValue = {
  keyFields: string[]
  action: 'flag' | 'block' | 'allow'
  ignoreCancelled: boolean
  caseInsensitive: boolean
  appliesToManualEntry: boolean
  windowDays: number | null
}

// One evolving pill for this screen, however fast the admin edits.
const TOAST_ID = 'duplicate-rule-save'

export function DuplicateRulesForm({ value }: { value: DuplicateRuleValue }) {
  const [form, setForm] = useState<DuplicateRuleValue>(value)
  const lastSaved = useRef<DuplicateRuleValue>(value)
  const [, startTransition] = useTransition()

  function save(next: DuplicateRuleValue) {
    const previous = lastSaved.current
    lastSaved.current = next
    setForm(next)

    startTransition(async () => {
      try {
        unwrap(await saveDuplicateRule(next))
        toast.success('Duplicate rule saved', { id: TOAST_ID, duration: 1500 })
      } catch (err) {
        lastSaved.current = previous
        setForm(previous)
        console.error('[intake] saving the duplicate rule failed', {
          action: next.action,
          keyFields: next.keyFields,
          err,
        })
        toast.error(err instanceof Error ? err.message : 'Could not save — change rolled back', {
          id: TOAST_ID,
        })
      }
    })
  }

  function toggleField(key: string, checked: boolean) {
    const keyFields = checked ? [...form.keyFields, key] : form.keyFields.filter((f) => f !== key)
    save({ ...form, keyFields })
  }

  const chosen = DUPLICATE_KEY_FIELDS.filter((f) => form.keyFields.includes(f.key)).map((f) => f.label)

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <Label>What makes two invoices the same one</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Tick the details that have to match. An invoice is treated as a repeat only when every ticked
            detail is the same.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {DUPLICATE_KEY_FIELDS.map((field) => (
            <label key={field.key} className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={form.keyFields.includes(field.key)}
                onCheckedChange={(checked) => toggleField(field.key, checked === true)}
              />
              {field.label}
            </label>
          ))}
        </div>

        <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
          {chosen.length === 0
            ? 'Nothing is ticked, so no invoice can ever be treated as a repeat.'
            : `Right now an invoice counts as a repeat when the ${chosen.join(' and the ')} both match.`}
        </p>
      </div>

      <div className="space-y-3">
        <Label>What happens when a repeat arrives</Label>
        <RadioGroup
          value={form.action}
          onValueChange={(action) => save({ ...form, action: action as DuplicateRuleValue['action'] })}
          className="gap-3"
        >
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 has-data-[state=checked]:border-primary">
            <RadioGroupItem value="flag" className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium">Mark it and carry on (recommended)</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                The invoice is created with a warning on it. A vendor emailing you directly while a colleague
                forwards the same invoice is normal, so this is usually not a mistake worth stopping for.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 has-data-[state=checked]:border-primary">
            <RadioGroupItem value="block" className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium">Refuse it</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                No invoice is created. The email is still recorded so somebody can see what was turned away.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 has-data-[state=checked]:border-primary">
            <RadioGroupItem value="allow" className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium">Say nothing</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                The invoice is created with no warning at all.
              </span>
            </span>
          </label>
        </RadioGroup>
      </div>

      <div className="space-y-3">
        <Label>How the check is run</Label>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <Checkbox
            className="mt-0.5"
            checked={form.appliesToManualEntry}
            onCheckedChange={(checked) => save({ ...form, appliesToManualEntry: checked === true })}
          />
          <span>
            Also check invoices somebody types in
            <span className="block text-xs text-muted-foreground">
              Not just the ones that arrive by email.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <Checkbox
            className="mt-0.5"
            checked={form.caseInsensitive}
            onCheckedChange={(checked) => save({ ...form, caseInsensitive: checked === true })}
          />
          <span>
            Ignore capital letters and extra spaces
            <span className="block text-xs text-muted-foreground">
              So &ldquo;INV-1001&rdquo; and &ldquo;inv-1001&rdquo; count as the same.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <Checkbox
            className="mt-0.5"
            checked={form.ignoreCancelled}
            onCheckedChange={(checked) => save({ ...form, ignoreCancelled: checked === true })}
          />
          <span>
            Skip invoices that were cancelled
            <span className="block text-xs text-muted-foreground">
              So re-sending an invoice after cancelling the first attempt works normally.
            </span>
          </span>
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="duplicate-window">Only look back this many days</Label>
        <Input
          id="duplicate-window"
          type="number"
          min={1}
          className="w-32"
          placeholder="All time"
          value={form.windowDays ?? ''}
          onChange={(e) =>
            setForm({ ...form, windowDays: e.target.value === '' ? null : Number(e.target.value) })
          }
          onBlur={() => save(form)}
        />
        <p className="text-xs text-muted-foreground">
          Leave blank to compare against every invoice you have ever received.
        </p>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => save(form)}>
          Save rule
        </Button>
      </div>
    </div>
  )
}
