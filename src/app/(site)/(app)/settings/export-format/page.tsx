import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getPayload } from '@/backend/lib/payload'

export const dynamic = 'force-dynamic'

export default async function ExportFormatPage() {
  const payload = await getPayload()
  const fields = await payload.find({
    collection: 'fields',
    where: { exportable: { equals: true } } as never,
    limit: 100,
    depth: 0,
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Export Format</CardTitle>
        <CardDescription>
          Fields available for CSV export. Driven by Settings → Fields (toggle "Available for CSV export" on each field).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {(fields.docs as unknown as Array<{ id: string | number; fieldKey: string; label: string; scope: string }>).map((f) => (
            <Badge key={String(f.id)} variant="outline" className="font-mono text-xs">
              {f.label} <span className="ml-1 text-muted-foreground">/ {f.fieldKey}</span>
            </Badge>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          CSV file name pattern: <code className="rounded bg-muted px-1.5 py-0.5">aurora_ap_export_{`{date}`}_{`{batch}`}.csv</code>
        </p>
      </CardContent>
    </Card>
  )
}
