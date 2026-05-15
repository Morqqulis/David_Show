import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getPayload } from '@/backend/lib/payload'
import { TemplatePreview } from '@/components/app/email/template-preview'

export const dynamic = 'force-dynamic'

export default async function TemplatesPage() {
  const payload = await getPayload()
  const res = await payload.find({ collection: 'email-templates', limit: 50, depth: 0 })
  const templates = res.docs as Array<{
    id: string | number
    name: string
    subject: string
    bodyHtml: string
    enabled: boolean
  }>
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_400px]">
      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
          <CardDescription>
            Named HTML bodies with token interpolation. Tokens: <code className="font-mono text-xs">{`{{InvoiceNumber}}`}</code>, <code className="font-mono text-xs">{`{{Vendor}}`}</code>, <code className="font-mono text-xs">{`{{Amount}}`}</code>, <code className="font-mono text-xs">{`{{Approver}}`}</code>, <code className="font-mono text-xs">{`{{InvoiceURL}}`}</code>, etc.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Enabled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => (
                <TableRow key={String(t.id)}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-muted-foreground">{t.subject}</TableCell>
                  <TableCell>{t.enabled ? <Badge>on</Badge> : <Badge variant="secondary">off</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <TemplatePreview templates={templates as never} />
    </div>
  )
}
