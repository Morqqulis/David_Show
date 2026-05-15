import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function ConfigStub({
  title,
  description,
  fields,
}: {
  title: string
  description: string
  fields: Array<{ label: string; value: string; hint?: string }>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="divide-y divide-border rounded-md border border-border">
          {fields.map((f) => (
            <div key={f.label} className="grid grid-cols-3 gap-4 px-4 py-3 text-sm">
              <dt className="text-muted-foreground">{f.label}</dt>
              <dd className="col-span-2 flex items-center gap-2">
                <span className="font-medium">{f.value}</span>
                {f.hint ? <Badge variant="outline" className="text-[10px] font-normal">{f.hint}</Badge> : null}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">
          Demo defaults shown. Editing UI is wired in Payload Admin (<a className="text-primary hover:underline" href="/admin">/admin</a>).
        </p>
      </CardContent>
    </Card>
  )
}
