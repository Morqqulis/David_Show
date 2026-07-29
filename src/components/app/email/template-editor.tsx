'use client'

import { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { RichHtmlEditor, type RichHtmlEditorHandle } from './rich-html-editor'
import { TokenPalette } from './token-palette'

export type TemplateDraft = {
  id: string | number
  name: string
  subject: string
  bodyHtml: string
  description: string
  enabled: boolean
}

export function TemplateEditor({
  draft,
  editorKey,
  dirty,
  saving,
  onChange,
  onSave,
  onDiscard,
  onDelete,
}: {
  draft: TemplateDraft
  /** Changes when a different template is opened, forcing a fresh editor. */
  editorKey: string
  dirty: boolean
  saving: boolean
  onChange: (patch: Partial<TemplateDraft>) => void
  onSave: () => void
  onDiscard: () => void
  onDelete: () => void
}) {
  const bodyRef = useRef<RichHtmlEditorHandle>(null)
  const subjectRef = useRef<HTMLInputElement>(null)
  // Which box the person was last typing in decides where a clicked detail lands.
  const [target, setTarget] = useState<'subject' | 'body'>('body')

  function insertToken(token: string) {
    if (target === 'subject') {
      const input = subjectRef.current
      if (!input) return
      const start = input.selectionStart ?? draft.subject.length
      const end = input.selectionEnd ?? start
      onChange({ subject: draft.subject.slice(0, start) + token + draft.subject.slice(end) })
      // The value lands on the next render, so move the cursor after that.
      window.requestAnimationFrame(() => {
        const at = start + token.length
        input.focus()
        input.setSelectionRange(at, at)
      })
      return
    }
    bodyRef.current?.insertText(token)
  }

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-base">Edit template</CardTitle>
        <CardDescription>
          Write the message the way you want it read. Formatting is applied as you go — there is
          no code to type.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-name">Template name</Label>
            <Input
              id="template-name"
              value={draft.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="Coding Assignment"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-note">What it is for</Label>
            <Input
              id="template-note"
              value={draft.description}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Goes to whoever the invoice was just assigned to."
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="template-subject">Subject line</Label>
          <Input
            id="template-subject"
            ref={subjectRef}
            value={draft.subject}
            onFocus={() => setTarget('subject')}
            onChange={(e) => onChange({ subject: e.target.value })}
            placeholder="Invoice ready for coding"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Message</Label>
          <RichHtmlEditor
            key={editorKey}
            ref={bodyRef}
            label="Email message"
            value={draft.bodyHtml}
            onFocus={() => setTarget('body')}
            onChange={(html) => onChange({ bodyHtml: html })}
          />
        </div>

        <TokenPalette onInsert={insertToken} />

        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={draft.enabled}
              onCheckedChange={(checked) => onChange({ enabled: checked })}
            />
            <span>Send this email when its trigger fires</span>
          </label>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" aria-label="Delete template" onClick={onDelete}>
              <Trash2 className="text-destructive" />
            </Button>
            <Button variant="outline" onClick={onDiscard} disabled={!dirty || saving}>
              Discard changes
            </Button>
            <Button onClick={onSave} disabled={!dirty || saving}>
              Save
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
