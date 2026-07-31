'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { unwrap } from '@/lib/action-result'
import { deleteEmailTemplateById, saveEmailTemplate } from '@/backend/actions/email-actions'
import type { EmailWrapper } from '@/backend/lib/email-render'
import { EmailPreview } from './email-preview'
import { TemplateEditor, type TemplateDraft } from './template-editor'

/**
 * Templates screen: pick one on the left, edit it in the middle, watch the
 * finished email on the right.
 *
 * Saving follows the house optimistic contract — local state changes first,
 * the server action runs inside a transition, and a failure puts the previous
 * text back rather than leaving the screen lying about what was stored. One
 * toast id for the whole screen, so a burst of saves collapses into one pill.
 */
const TOAST_ID = 'email-templates-save'

const NEW_TEMPLATE: Omit<TemplateDraft, 'id'> = {
  name: 'New email',
  subject: 'Invoice {{InvoiceNumber}}',
  bodyHtml: '<p>Hi {{Assignee}},</p><p><br></p>',
  description: '',
  enabled: false,
}

const isPending = (id: string | number) => String(id).startsWith('tmp-')

export function TemplatesWorkshop({
  templates,
  wrapper,
}: {
  templates: TemplateDraft[]
  wrapper: EmailWrapper
}) {
  const [rows, setRows] = useState<TemplateDraft[]>(templates)
  const [activeId, setActiveId] = useState<string>(() => String(templates[0]?.id ?? ''))
  const [draft, setDraft] = useState<TemplateDraft | null>(() => templates[0] ?? null)
  // Bumping this remounts the body editor. It has to be uncontrolled — React
  // rewriting its HTML on every keystroke would throw the cursor to the start.
  const [editorSeq, setEditorSeq] = useState(0)
  const [saving, startTransition] = useTransition()
  const tmpCounter = useRef(0)

  const stored = rows.find((r) => String(r.id) === activeId) ?? null
  const dirty = Boolean(draft) && JSON.stringify(stored) !== JSON.stringify(draft)

  function leaveGuard(): boolean {
    return !dirty || confirm('You have unsaved changes to this email. Discard them?')
  }

  function open(id: string) {
    if (id === activeId || !leaveGuard()) return
    setActiveId(id)
    setDraft(rows.find((r) => String(r.id) === id) ?? null)
    setEditorSeq((seq) => seq + 1)
  }

  function add() {
    if (!leaveGuard()) return
    tmpCounter.current += 1
    const tmpId = `tmp-${tmpCounter.current}-${Math.random().toString(36).slice(2, 7)}`
    const row: TemplateDraft = { id: tmpId, ...NEW_TEMPLATE }
    const previous = rows
    setRows((cur) => [...cur, row])
    setActiveId(tmpId)
    setDraft(row)
    setEditorSeq((seq) => seq + 1)

    startTransition(async () => {
      try {
        const created = unwrap(await saveEmailTemplate(null, toInput(row)))
        const realId = String(created.id)
        setRows((cur) => cur.map((r) => (r.id === tmpId ? { ...r, id: created.id } : r)))
        setActiveId((cur) => (cur === tmpId ? realId : cur))
        setDraft((cur) => (cur && cur.id === tmpId ? { ...cur, id: created.id } : cur))
        toast.success('Template added', { id: TOAST_ID, duration: 1500 })
      } catch (err) {
        console.error('[email-templates] create failed', { name: row.name, err })
        setRows(previous)
        setActiveId(String(previous[0]?.id ?? ''))
        setDraft(previous[0] ?? null)
        setEditorSeq((seq) => seq + 1)
        toast.error('Could not add the template — nothing was changed.', { id: TOAST_ID })
      }
    })
  }

  function save() {
    if (!draft) return
    if (!draft.name.trim() || !draft.subject.trim()) {
      toast.error('Give the template a name and a subject line before saving.', { id: TOAST_ID })
      return
    }
    const target = draft
    const previous = rows
    setRows((cur) => cur.map((r) => (String(r.id) === String(target.id) ? target : r)))

    startTransition(async () => {
      try {
        // A template created moments ago may still be waiting for its real id;
        // saving it as an update would address a row that does not exist yet.
        unwrap(await saveEmailTemplate(isPending(target.id) ? null : target.id, toInput(target)))
        toast.success('Saved', { id: TOAST_ID, duration: 1500 })
      } catch (err) {
        console.error('[email-templates] save failed', { id: target.id, name: target.name, err })
        setRows(previous)
        setDraft(previous.find((r) => String(r.id) === String(target.id)) ?? target)
        setEditorSeq((seq) => seq + 1)
        toast.error('Could not save — your changes were put back.', { id: TOAST_ID })
      }
    })
  }

  function remove() {
    if (!draft) return
    if (isPending(draft.id)) {
      toast.error('Give the new template a moment to finish saving first.', { id: TOAST_ID })
      return
    }
    if (!confirm('Delete this email template? Any trigger using it will stop sending.')) return

    const target = draft
    const previous = rows
    const next = rows.filter((r) => String(r.id) !== String(target.id))
    setRows(next)
    setActiveId(String(next[0]?.id ?? ''))
    setDraft(next[0] ?? null)
    setEditorSeq((seq) => seq + 1)

    startTransition(async () => {
      try {
        unwrap(await deleteEmailTemplateById(target.id))
        toast.success('Template deleted', { id: TOAST_ID, duration: 1500 })
      } catch (err) {
        console.error('[email-templates] delete failed', { id: target.id, err })
        setRows(previous)
        setActiveId(String(target.id))
        setDraft(target)
        setEditorSeq((seq) => seq + 1)
        toast.error('Could not delete — the template is still there.', { id: TOAST_ID })
      }
    })
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="text-base">Templates</CardTitle>
          <CardAction>
            <Button size="icon-sm" variant="outline" aria-label="Add template" onClick={add}>
              <Plus />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-0.5">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No templates yet. Use the plus button to write your first one.
            </p>
          ) : null}
          {rows.map((row) => (
            <button
              key={String(row.id)}
              type="button"
              onClick={() => open(String(row.id))}
              className={cn(
                'flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors',
                String(row.id) === activeId
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-foreground/80 hover:bg-muted',
              )}
            >
              <span className="truncate">{row.name}</span>
              {row.enabled ? null : (
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  off
                </Badge>
              )}
            </button>
          ))}
        </CardContent>
      </Card>

      {draft ? (
        <div className="grid min-w-0 gap-4 2xl:grid-cols-2">
          <TemplateEditor
            draft={draft}
            editorKey={`${activeId}:${editorSeq}`}
            dirty={dirty}
            saving={saving}
            onChange={(patch) => setDraft((cur) => (cur ? { ...cur, ...patch } : cur))}
            onSave={save}
            onDiscard={() => {
              setDraft(stored)
              setEditorSeq((seq) => seq + 1)
            }}
            onDelete={remove}
          />
          <EmailPreview subject={draft.subject} bodyHtml={draft.bodyHtml} wrapper={wrapper} />
        </div>
      ) : (
        <Card className="min-w-0">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Pick a template on the left, or add a new one.
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function toInput(row: TemplateDraft) {
  return {
    name: row.name,
    subject: row.subject,
    bodyHtml: row.bodyHtml,
    description: row.description,
    enabled: row.enabled,
  }
}
