'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

const SAMPLE_VARS: Record<string, string> = {
  '{{InvoiceNumber}}': 'INV-77100',
  '{{Vendor}}': 'BlueRock Construction Inc.',
  '{{Amount}}': 'CA$4,861.00',
  '{{Status}}': 'Approved',
  '{{Stage}}': 'AP Review',
  '{{BatchNumber}}': 'BATCH-2026-W21',
  '{{Assignee}}': 'Jordan Lee',
  '{{Approver}}': 'Sarah Chen',
  '{{Rejecter}}': 'Sarah Chen',
  '{{RejectReason}}': 'Missing PO reference — please add and resubmit.',
  '{{InvoiceURL}}': 'https://auroraap.example.com/requests/INV-77100',
  '{{Department}}': 'Public Works',
  '{{Municipality}}': 'City of Aurora',
  '{{AppName}}': 'AuroraAP',
  '{{InvoiceDate}}': 'May 8, 2026',
  '{{DueDate}}': 'Jun 7, 2026',
  '{{Submitter}}': 'Marcus Patel',
}

function interpolate(s: string) {
  let out = s
  for (const [k, v] of Object.entries(SAMPLE_VARS)) {
    out = out.replaceAll(k, v)
  }
  return out
}

export function TemplatePreview({
  templates,
}: {
  templates: Array<{ id: string | number; name: string; subject: string; bodyHtml: string }>
}) {
  const [activeId, setActiveId] = useState(String(templates[0]?.id ?? ''))
  const active = templates.find((t) => String(t.id) === activeId)

  if (!active) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Live preview</CardTitle>
        <CardDescription>Tokens replaced with sample data.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Select value={activeId} onValueChange={setActiveId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {templates.map((t) => (
              <SelectItem key={String(t.id)} value={String(t.id)}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="rounded-md border border-border bg-background">
          <div className="border-b border-border bg-muted/40 px-3 py-2 text-xs">
            <div className="text-muted-foreground">From: City of Aurora — AP &lt;ap@aurora.ca&gt;</div>
            <div className="font-medium text-foreground">{interpolate(active.subject)}</div>
          </div>
          <div
            className="prose prose-sm max-w-none p-4 text-sm"
            dangerouslySetInnerHTML={{ __html: interpolate(active.bodyHtml) }}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {Object.keys(SAMPLE_VARS).slice(0, 8).map((token) => (
            <Badge key={token} variant="outline" className="font-mono text-[10px]">
              {token}
            </Badge>
          ))}
          <Badge variant="outline" className="font-mono text-[10px]">+more</Badge>
        </div>
      </CardContent>
    </Card>
  )
}
