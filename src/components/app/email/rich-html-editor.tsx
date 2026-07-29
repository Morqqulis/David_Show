'use client'

import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react'
import { Bold, Italic, Link2, List, Underline } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { sanitizeEmailHtml } from '@/backend/lib/email-html-sanitize'
import {
  applyLink,
  currentRange,
  insertSanitizedHtml,
  insertTextAtRange,
  pastedHtml,
  rangeAtEnd,
  removeLink,
  toggleBulletList,
  toggleInlineMark,
  type InlineMark,
} from './editor-commands'
import { EMAIL_BODY_CLASS } from './email-body-style'
import { LinkDialog } from './link-dialog'

export type RichHtmlEditorHandle = {
  /** Drops text in at the caret — how the token palette gets its work done. */
  insertText: (text: string) => void
  focus: () => void
}

type Props = {
  /** Starting markup. Read once: React must never rewrite the box under the caret. */
  value: string
  onChange: (html: string) => void
  onFocus?: () => void
  label: string
}

const SELECT_FIRST = 'Select the words you want to change, then choose a style.'

export const RichHtmlEditor = forwardRef<RichHtmlEditorHandle, Props>(function RichHtmlEditor(
  { value, onChange, onFocus, label },
  ref,
) {
  // Built once and never rebuilt. React's DOM update compares this prop by
  // object identity and then assigns `innerHTML` unconditionally, so handing it
  // a fresh `{ __html }` literal on every render would rewrite the box on every
  // keystroke and throw the cursor back to the start. Held in state (not a ref)
  // because it is read during render, and sanitised on the way in because
  // nothing unsanitised may reach dangerouslySetInnerHTML — not even markup we
  // saved ourselves a moment ago.
  const [initialHtml] = useState(() => ({ __html: sanitizeEmailHtml(value) || '<p><br></p>' }))
  const rootRef = useRef<HTMLDivElement>(null)
  const savedRange = useRef<Range | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  const remember = useCallback(() => {
    const root = rootRef.current
    if (!root) return
    const range = currentRange(root)
    savedRange.current = range ? range.cloneRange() : savedRange.current
  }, [])

  const emit = useCallback(() => {
    const root = rootRef.current
    if (root) onChange(root.innerHTML)
  }, [onChange])

  const run = useCallback(
    (command: (root: HTMLElement) => boolean) => {
      const root = rootRef.current
      if (!root) return
      root.focus()
      if (!command(root)) {
        setHint(SELECT_FIRST)
        return
      }
      setHint(null)
      remember()
      emit()
    },
    [emit, remember],
  )

  useImperativeHandle(
    ref,
    () => ({
      insertText(text: string) {
        const root = rootRef.current
        if (!root) return
        root.focus()
        const range = currentRange(root) ?? savedRange.current ?? rangeAtEnd(root)
        insertTextAtRange(range, text)
        remember()
        emit()
      },
      focus() {
        rootRef.current?.focus()
      },
    }),
    [emit, remember],
  )

  const mark = (tag: InlineMark) => () => run((root) => toggleInlineMark(root, tag))

  return (
    <div className="rounded-lg border border-input">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-input bg-muted/40 px-1.5 py-1">
        <ToolButton label="Bold" onPress={mark('strong')}>
          <Bold />
        </ToolButton>
        <ToolButton label="Italic" onPress={mark('em')}>
          <Italic />
        </ToolButton>
        <ToolButton label="Underline" onPress={mark('u')}>
          <Underline />
        </ToolButton>
        <ToolButton label="Bullet list" onPress={() => run(toggleBulletList)}>
          <List />
        </ToolButton>
        <ToolButton
          label="Add link"
          onPress={() => {
            remember()
            setLinkOpen(true)
          }}
        >
          <Link2 />
        </ToolButton>
      </div>

      <div
        ref={rootRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        spellCheck
        className={cn(
          'min-h-56 px-3 py-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
          EMAIL_BODY_CLASS,
        )}
        onInput={() => {
          setHint(null)
          emit()
        }}
        onKeyUp={remember}
        onMouseUp={remember}
        onFocus={onFocus}
        onBlur={() => {
          remember()
          emit()
        }}
        onPaste={(event) => {
          const root = rootRef.current
          if (!root) return
          // Pasting from Word or a browser drags in markup we would refuse to
          // save; clean it here so what is on screen is what gets stored.
          const safe = pastedHtml(event.clipboardData)
          event.preventDefault()
          const range = currentRange(root) ?? savedRange.current ?? rangeAtEnd(root)
          if (safe) insertSanitizedHtml(range, safe)
          remember()
          emit()
        }}
        dangerouslySetInnerHTML={initialHtml}
      />

      {hint ? <p className="border-t border-input px-3 py-1.5 text-xs text-muted-foreground">{hint}</p> : null}

      <LinkDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        onApply={(href) => {
          const root = rootRef.current
          if (!root) return
          root.focus()
          if (!applyLink(root, href, savedRange.current)) {
            setHint('Put the cursor where the link should go, then try again.')
            return
          }
          setHint(null)
          emit()
        }}
        onRemove={() => run(removeLink)}
      />
    </div>
  )
})

function ToolButton({
  label,
  onPress,
  children,
}: {
  label: string
  onPress: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      // Keeping the default here would move focus out of the editor and wipe
      // the selection before the click handler ever runs.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPress}
    >
      {children}
    </Button>
  )
}
