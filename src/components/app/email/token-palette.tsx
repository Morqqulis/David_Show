'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { EMAIL_TOKENS } from '@/backend/lib/email-tokens'
import { cn } from '@/lib/utils'

/**
 * The clickable placeholder list. Clicking a name drops it straight in at the
 * cursor; the small copy button is there for anyone who would rather paste it
 * somewhere else.
 *
 * Every button suppresses mousedown. Without that the browser moves focus out
 * of whatever the person was typing in, the text cursor is lost, and the
 * placeholder has nowhere to land.
 */
export function TokenPalette({ onInsert }: { onInsert: (token: string) => void }) {
  const [copied, setCopied] = useState<string | null>(null)
  const [copyFailed, setCopyFailed] = useState(false)

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(token)
      setCopyFailed(false)
      setCopied(token)
      window.setTimeout(() => setCopied((current) => (current === token ? null : current)), 1500)
    } catch (err) {
      console.error('[email-templates] clipboard copy failed', { token, err })
      setCopyFailed(true)
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">
        Click a detail to drop it in where your cursor is. It is replaced with the real
        information when the email goes out.
      </p>
      <div className="flex flex-wrap gap-1">
        {EMAIL_TOKENS.map((token) => (
          <span
            key={token.token}
            className="group inline-flex items-center overflow-hidden rounded-md border border-border bg-muted/40 text-xs"
          >
            <button
              type="button"
              title={`${token.description} Example: ${token.sample}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onInsert(token.token)}
              className="px-2 py-1 font-medium transition-colors hover:bg-primary/10 hover:text-primary"
            >
              {token.label}
            </button>
            <button
              type="button"
              aria-label={`Copy ${token.label}`}
              title="Copy"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => copy(token.token)}
              className={cn(
                'border-l border-border px-1.5 py-1 opacity-40 transition-opacity',
                'hover:bg-muted group-hover:opacity-100 focus-visible:opacity-100',
              )}
            >
              {copied === token.token ? (
                <Check className="size-3 text-primary" />
              ) : (
                <Copy className="size-3" />
              )}
            </button>
          </span>
        ))}
      </div>
      {copyFailed ? (
        <p className="text-xs text-muted-foreground">
          Copying is blocked in this browser. Click the name instead and it will be added
          where your cursor is.
        </p>
      ) : null}
    </div>
  )
}
