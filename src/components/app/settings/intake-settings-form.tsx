'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { unwrap } from '@/lib/action-result'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import {
  saveIntakeSettings,
  startMailboxWatch,
  stopMailboxWatch,
} from '@/backend/actions/intake-settings-actions'
import { formatDate } from '@/backend/lib/formatting'

export type IntakeSettingsValue = {
  enabled: boolean
  mailboxAddress: string
  senderPolicy: 'internal_only' | 'public'
  internalDomains: string
  confidencePercent: number
  amountTolerance: number
}

// One evolving pill for this card, however many times the admin saves.
const TOAST_ID = 'intake-settings-save'

export function IntakeSettingsForm({ value }: { value: IntakeSettingsValue }) {
  const [form, setForm] = useState<IntakeSettingsValue>(value)
  const lastSaved = useRef<IntakeSettingsValue>(value)
  const [, startTransition] = useTransition()

  function save(next: IntakeSettingsValue) {
    const previous = lastSaved.current
    lastSaved.current = next
    setForm(next)

    startTransition(async () => {
      try {
        unwrap(
          await saveIntakeSettings({
            enabled: next.enabled,
            mailboxAddress: next.mailboxAddress,
            senderPolicy: next.senderPolicy,
            internalDomains: next.internalDomains
              .split(/[\s,]+/)
              .map((d) => d.trim())
              .filter(Boolean),
            confidenceThreshold: next.confidencePercent / 100,
            amountTolerance: next.amountTolerance,
          }),
        )
        toast.success('Mailbox settings saved', { id: TOAST_ID, duration: 1500 })
      } catch (err) {
        lastSaved.current = previous
        setForm(previous)
        console.error('[intake] saving the mailbox settings failed', {
          senderPolicy: next.senderPolicy,
          enabled: next.enabled,
          err,
        })
        toast.error(err instanceof Error ? err.message : 'Could not save — change rolled back', {
          id: TOAST_ID,
        })
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6 rounded-md border border-border bg-card p-3">
        <div>
          <Label htmlFor="intake-enabled" className="text-sm font-medium">
            Collect invoices from this mailbox
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">
            When this is off, emails still arrive in the mailbox but nothing is turned into an invoice.
          </p>
        </div>
        <Switch
          id="intake-enabled"
          checked={form.enabled}
          onCheckedChange={(enabled) => save({ ...form, enabled })}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="intake-mailbox">Mailbox address</Label>
        <Input
          id="intake-mailbox"
          type="email"
          value={form.mailboxAddress}
          placeholder="accountspayable@yourmunicipality.ca"
          onChange={(e) => setForm({ ...form, mailboxAddress: e.target.value })}
          onBlur={() => save(form)}
        />
        <p className="text-xs text-muted-foreground">
          The shared mailbox staff forward invoices to. It lives in your own Microsoft 365 account.
        </p>
      </div>

      <div className="space-y-3">
        <Label>Who may email invoices to this address</Label>
        <RadioGroup
          value={form.senderPolicy}
          onValueChange={(mode) => save({ ...form, senderPolicy: mode as IntakeSettingsValue['senderPolicy'] })}
          className="gap-3"
        >
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 has-data-[state=checked]:border-primary">
            <RadioGroupItem value="internal_only" className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium">Our staff only</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Only people whose email address ends in one of your own domains can send invoices in. Anything
                from outside is held for someone to look at instead of being turned into an invoice.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 has-data-[state=checked]:border-primary">
            <RadioGroupItem value="public" className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium">Anyone</span>
              {/* The consequence is stated here, at the point of choosing, not
                  in a help page. Clients understand the trade-off; they just
                  have to be told it plainly while they are making the choice. */}
              <span className="mt-1 block text-xs text-muted-foreground">
                <strong>Anyone on the internet can email invoices to this address</strong>, including your
                vendors directly and anyone who learns the address. Every message still becomes an invoice
                someone has to look at, so junk mail reaches your queue.
              </span>
            </span>
          </label>
        </RadioGroup>
      </div>

      {form.senderPolicy === 'internal_only' ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="intake-domains">Your email domains</Label>
          <Input
            id="intake-domains"
            value={form.internalDomains}
            placeholder="aurora.ca"
            onChange={(e) => setForm({ ...form, internalDomains: e.target.value })}
            onBlur={() => save(form)}
          />
          <p className="text-xs text-muted-foreground">
            The part of your staff email addresses after the @ sign. Separate several with a comma. Addresses
            like scanner.aurora.ca count too.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="intake-confidence">How sure a reading has to be</Label>
          <div className="flex items-center gap-2">
            <Input
              id="intake-confidence"
              type="number"
              min={0}
              max={100}
              step={5}
              className="w-24"
              value={form.confidencePercent}
              onChange={(e) => setForm({ ...form, confidencePercent: Number(e.target.value) })}
              onBlur={() => save(form)}
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Anything read less confidently than this is left blank for a person to fill in, rather than filled
            in with a guess.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="intake-tolerance">Allowed rounding on the amounts</Label>
          <Input
            id="intake-tolerance"
            type="number"
            min={0}
            step={0.01}
            className="w-24"
            value={form.amountTolerance}
            onChange={(e) => setForm({ ...form, amountTolerance: Number(e.target.value) })}
            onBlur={() => save(form)}
          />
          <p className="text-xs text-muted-foreground">
            If the amount before taxes plus the tax does not come to the total, and the gap is bigger than
            this, the invoice is marked for review. It is never refused.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => save(form)}>
          Save settings
        </Button>
      </div>
    </div>
  )
}

const CONNECTION_TOAST_ID = 'intake-connection'

/**
 * Starting and stopping the watch on the mailbox.
 *
 * Kept beside the mailbox settings because it is the same subject: the address
 * above is what this connects to. Nothing here shows a key, an identifier or a
 * technical status — only whether invoices are being collected, and when the
 * connection was last renewed.
 */
export function MailboxConnection({
  connected,
  expiresAt,
  lastNotificationAt,
  credentialsPresent,
}: {
  connected: boolean
  expiresAt: string | null
  lastNotificationAt: string | null
  credentialsPresent: boolean
}) {
  const [live, setLive] = useState(connected)
  const [renewsOn, setRenewsOn] = useState(expiresAt)
  const [busy, startTransition] = useTransition()

  function connect() {
    startTransition(async () => {
      try {
        const result = unwrap(await startMailboxWatch())
        setLive(true)
        setRenewsOn(result.expiresAt)
        toast.success('Connected — new invoices will start arriving', {
          id: CONNECTION_TOAST_ID,
          duration: 2000,
        })
      } catch (err) {
        setLive(connected)
        console.error('[intake] starting the mailbox watch failed', { err })
        toast.error(err instanceof Error ? err.message : 'Could not connect to the mailbox', {
          id: CONNECTION_TOAST_ID,
        })
      }
    })
  }

  function disconnect() {
    const previous = live
    setLive(false)
    startTransition(async () => {
      try {
        unwrap(await stopMailboxWatch())
        setRenewsOn(null)
        toast.success('Disconnected — nothing new will be collected', {
          id: CONNECTION_TOAST_ID,
          duration: 2000,
        })
      } catch (err) {
        setLive(previous)
        console.error('[intake] stopping the mailbox watch failed', { err })
        toast.error('Could not disconnect — change rolled back', { id: CONNECTION_TOAST_ID })
      }
    })
  }

  if (!credentialsPresent) {
    return (
      <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        This site has not been given permission to open your mailbox yet. Ask whoever set up the system to
        finish connecting it to your Microsoft 365 account, then come back to this page.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm">
        {live
          ? 'Invoices emailed to this mailbox are being collected.'
          : 'Nothing is being collected from this mailbox yet.'}
      </p>
      {live && renewsOn ? (
        <p className="text-xs text-muted-foreground">
          The connection renews itself automatically, next by {formatDate(renewsOn)}.
        </p>
      ) : null}
      {lastNotificationAt ? (
        <p className="text-xs text-muted-foreground">
          Last email picked up on {formatDate(lastNotificationAt)}.
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button size="sm" onClick={connect} disabled={busy || live}>
          Start collecting
        </Button>
        <Button size="sm" variant="outline" onClick={disconnect} disabled={busy || !live}>
          Stop collecting
        </Button>
      </div>
    </div>
  )
}
