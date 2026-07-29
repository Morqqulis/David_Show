'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveEmailWrapper } from '@/backend/actions/email-actions'
import type { EmailWrapper } from '@/backend/lib/email-render'
import { EmailPreview } from './email-preview'
import { RichHtmlEditor, type RichHtmlEditorHandle } from './rich-html-editor'
import { TokenPalette } from './token-palette'

/**
 * The one place the global header and footer are edited. Every template body
 * is delivered sandwiched between them, so this screen previews a stand-in
 * body rather than any particular template.
 */
const TOAST_ID = 'email-settings-save'

const SAMPLE_BODY =
  '<p>Each template supplies this middle part. The header above and the footer below are added to every email.</p>'

export function WrapperSettingsForm({ initial }: { initial: EmailWrapper }) {
  const [stored, setStored] = useState<EmailWrapper>(initial)
  const [draft, setDraft] = useState<EmailWrapper>(initial)
  const [editorSeq, setEditorSeq] = useState(0)
  const [saving, startTransition] = useTransition()
  const headerRef = useRef<RichHtmlEditorHandle>(null)
  const footerRef = useRef<RichHtmlEditorHandle>(null)
  const [target, setTarget] = useState<'header' | 'footer'>('header')

  const dirty = JSON.stringify(stored) !== JSON.stringify(draft)
  const patch = (next: Partial<EmailWrapper>) => setDraft((cur) => ({ ...cur, ...next }))

  function save() {
    const next = draft
    const previous = stored
    setStored(next)
    startTransition(async () => {
      try {
        await saveEmailWrapper(next)
        toast.success('Saved', { id: TOAST_ID, duration: 1500 })
      } catch (err) {
        console.error('[email-settings] save failed', { fromEmail: next.fromEmail, err })
        setStored(previous)
        setDraft(previous)
        setEditorSeq((seq) => seq + 1)
        toast.error('Could not save — your previous settings are still in place.', { id: TOAST_ID })
      }
    })
  }

  return (
    <div className="grid min-w-0 gap-4 2xl:grid-cols-2">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="text-base">Header and footer</CardTitle>
          <CardDescription>
            These wrap around every email this system sends, so you only write them once.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email-from-name">Sender name</Label>
              <Input
                id="email-from-name"
                value={draft.fromName}
                onChange={(e) => patch({ fromName: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email-from-address">From address</Label>
              <Input
                id="email-from-address"
                value={draft.fromEmail}
                onChange={(e) => patch({ fromEmail: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email-reply-to">Replies go to</Label>
              <Input
                id="email-reply-to"
                value={draft.replyTo}
                onChange={(e) => patch({ replyTo: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Top of every email</Label>
            <RichHtmlEditor
              key={`header:${editorSeq}`}
              ref={headerRef}
              label="Email header"
              value={draft.headerHtml}
              onFocus={() => setTarget('header')}
              onChange={(html) => patch({ headerHtml: html })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Bottom of every email</Label>
            <RichHtmlEditor
              key={`footer:${editorSeq}`}
              ref={footerRef}
              label="Email footer"
              value={draft.footerHtml}
              onFocus={() => setTarget('footer')}
              onChange={(html) => patch({ footerHtml: html })}
            />
          </div>

          <TokenPalette
            onInsert={(token) =>
              (target === 'header' ? headerRef : footerRef).current?.insertText(token)
            }
          />

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button
              variant="outline"
              disabled={!dirty || saving}
              onClick={() => {
                setDraft(stored)
                setEditorSeq((seq) => seq + 1)
              }}
            >
              Discard changes
            </Button>
            <Button onClick={save} disabled={!dirty || saving}>
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      <EmailPreview
        subject="Invoice {{InvoiceNumber}} needs your attention"
        bodyHtml={SAMPLE_BODY}
        wrapper={draft}
      />
    </div>
  )
}
