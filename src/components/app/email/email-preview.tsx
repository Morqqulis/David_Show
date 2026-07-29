'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { renderEmail, type EmailWrapper } from '@/backend/lib/email-render'
import { listUnknownTokens, sampleTokenValues } from '@/backend/lib/email-tokens'
import { EMAIL_BODY_CLASS } from './email-body-style'

/**
 * The finished email, not the template: the global header and footer are
 * included and every placeholder is filled with example information, because
 * "does this read correctly once the values are in" is the only question a
 * preview exists to answer.
 *
 * The HTML injected below is whatever `renderEmail` returns, and `renderEmail`
 * sanitises every part it composes. Nothing else may be passed here.
 */
export function EmailPreview({
  subject,
  bodyHtml,
  wrapper,
}: {
  subject: string
  bodyHtml: string
  wrapper: EmailWrapper
}) {
  const email = renderEmail({ subject, bodyHtml, wrapper, values: sampleTokenValues() })
  const unknown = listUnknownTokens(`${subject} ${bodyHtml} ${wrapper.headerHtml} ${wrapper.footerHtml}`)

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-base">Preview</CardTitle>
        <CardDescription>
          How this email arrives, with example information filled in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-hidden rounded-md border border-border bg-background">
          <div className="space-y-0.5 border-b border-border bg-muted/40 px-3 py-2 text-xs">
            <div className="text-muted-foreground">From: {email.fromLine}</div>
            {wrapper.replyTo && wrapper.replyTo !== wrapper.fromEmail ? (
              <div className="text-muted-foreground">Replies go to: {wrapper.replyTo}</div>
            ) : null}
            <div className="font-medium text-foreground">
              {email.subject || <span className="text-muted-foreground">(no subject yet)</span>}
            </div>
          </div>
          <div
            className={`px-4 py-3 ${EMAIL_BODY_CLASS}`}
            dangerouslySetInnerHTML={{ __html: email.html }}
          />
        </div>
        {unknown.length ? (
          <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            These do not match anything the system knows and will arrive exactly as written:{' '}
            <span className="font-medium text-foreground">{unknown.join(', ')}</span>. Pick one
            from the list above instead.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
