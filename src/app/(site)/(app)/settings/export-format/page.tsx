import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getColumnFieldDocs } from '@/backend/lib/queries'
import { resolveInvoiceColumns } from '@/backend/lib/invoice-filters'

export const dynamic = 'force-dynamic'

/**
 * There is no separate export configuration any more. Export CSV on All
 * Requests writes exactly what is on screen, so this page explains that and
 * lists which columns are available to put on screen in the first place.
 */
export default async function ExportFormatPage() {
  const columns = resolveInvoiceColumns(await getColumnFieldDocs())

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export Format</CardTitle>
        <CardDescription>
          Export CSV on the All Requests screen writes exactly what you are looking at — the same
          filters, the same columns, in the same order, sorted the same way — and it covers every
          matching invoice, not just the page on screen. To change the shape of an export, arrange
          the table the way you want it and save it as a view.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mb-2 text-sm font-medium">Columns available on All Requests</p>
        <div className="flex flex-wrap gap-2">
          {columns.map((column) => (
            <Badge key={column.id} variant="outline" className="text-xs">
              {column.label}
            </Badge>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Add more by turning on “Show as column on All Requests” for a field in Settings → Fields.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          File name pattern:{' '}
          <code className="rounded bg-muted px-1.5 py-0.5">aurora_ap_{`{stage}`}_{`{date}`}.csv</code>
        </p>
      </CardContent>
    </Card>
  )
}
