'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { sanitizeUrl } from '@/backend/lib/email-html-sanitize'

/**
 * Turns what a person types into a usable address: bare domains get https://,
 * a lone email address becomes a mailto: link, and `{{Link to invoice}}`
 * tokens pass through untouched so the address can be filled in per invoice.
 */
export function normalizeHref(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
  const candidate =
    /^(https?|mailto|tel):/i.test(trimmed) || trimmed.startsWith('{{') || trimmed.startsWith('#')
      ? trimmed
      : looksLikeEmail
        ? `mailto:${trimmed}`
        : `https://${trimmed}`
  return sanitizeUrl(candidate)
}

export function LinkDialog({
  open,
  onOpenChange,
  onApply,
  onRemove,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (href: string) => void
  onRemove: () => void
}) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit() {
    const href = normalizeHref(value)
    if (!href) {
      setError('That address will not work. Try something like aurora.ca/invoices.')
      return
    }
    setError(null)
    setValue('')
    onApply(href)
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setValue('')
          setError(null)
        }
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add a link</DialogTitle>
          <DialogDescription>
            Where should the selected words take the reader? You can also drop in the
            “Link to invoice” token so every email points at its own invoice.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5 py-1">
          <Label htmlFor="email-link-target">Address</Label>
          <Input
            id="email-link-target"
            value={value}
            autoFocus
            placeholder="aurora.ca/invoices"
            onChange={(e) => {
              setValue(e.target.value)
              setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submit()
              }
            }}
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onRemove()
              onOpenChange(false)
            }}
          >
            Remove link
          </Button>
          <Button type="button" onClick={submit}>
            Add link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
