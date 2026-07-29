import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getPayload } from '@/backend/lib/payload'
import { isDocumentIntelligenceConfigured } from '@/backend/lib/document-intelligence'
import {
  BUILT_IN_INVOICE_FIELDS,
  DEFAULT_CONFIDENCE_THRESHOLD,
  DEFAULT_FIELD_MAPPING,
} from '@/backend/lib/intake-field-mapping'
import {
  OcrMappingTable,
  type AppFieldOption,
  type MappingRow,
} from '@/components/app/settings/ocr-mapping-table'

export const dynamic = 'force-dynamic'

export default async function OcrPage() {
  const payload = await getPayload()

  let rows: MappingRow[] = []
  let appFields: AppFieldOption[] = [...BUILT_IN_INVOICE_FIELDS]
  let threshold = DEFAULT_CONFIDENCE_THRESHOLD
  try {
    const [mapRes, fieldRes, settingsRes] = await Promise.all([
      payload.find({ collection: 'ocr-field-map' as never, limit: 200, depth: 0, sort: 'order' }),
      payload.find({
        collection: 'fields',
        where: { scope: { equals: 'header' } } as never,
        limit: 200,
        depth: 0,
        sort: 'order',
      }),
      payload.find({ collection: 'intake-settings' as never, limit: 1, depth: 0 }),
    ])

    rows = (
      mapRes.docs as Array<{
        id: string | number
        appField: string
        sourceField: string
        enabled?: boolean
        order?: number
      }>
    ).map((doc, index) => ({
      id: doc.id,
      appField: doc.appField,
      sourceField: doc.sourceField,
      enabled: doc.enabled !== false,
      order: doc.order ?? index,
    }))

    // The picker offers what ships with the app plus whatever header fields
    // this municipality has added of its own, which is exactly why a mapping
    // table is needed rather than a list of switches.
    const custom = (fieldRes.docs as Array<{ fieldKey: string; label: string }>)
      .filter((f) => !BUILT_IN_INVOICE_FIELDS.some((b) => b.key === f.fieldKey))
      .map((f) => ({ key: f.fieldKey, label: f.label }))
    appFields = [...BUILT_IN_INVOICE_FIELDS, ...custom]

    const settings = settingsRes.docs[0] as { confidenceThreshold?: number } | undefined
    threshold = settings?.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD
  } catch (err) {
    console.error('[intake] could not load the reading rules', { message: (err as Error).message })
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reading invoices</CardTitle>
          <CardDescription>
            These settings could not be loaded right now. Try again in a moment; if it keeps happening,
            contact your administrator.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const usingDefaults = rows.length === 0

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Reading invoices</CardTitle>
          <CardDescription>
            When an invoice arrives by email, the document is read and the details are filled in for you.
            Set out below which reading fills which field.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isDocumentIntelligenceConfigured() ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              Invoice reading has not been switched on for this site yet, so nothing is filled in
              automatically. Ask whoever set up the system to finish connecting it. You can still set the
              rules below ready for when it is.
            </p>
          ) : null}

          {usingDefaults ? (
            <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              No rules have been set, so the sensible starting set is being used:{' '}
              {DEFAULT_FIELD_MAPPING.length} readings covering the invoice number, vendor, dates, purchase
              order number and the three amounts. Adding a rule below replaces that starting set.
            </p>
          ) : null}

          <p className="text-xs text-muted-foreground">
            A reading has to be at least {Math.round(threshold * 100)}% certain before it is used. Anything
            less confident is left blank for a person to fill in. Change that on the Email Intake page.
          </p>

          <OcrMappingTable rows={rows} appFields={appFields} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What is not read</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <p>
            The individual coding lines on an invoice are not read. Coders enter the account and the amount
            themselves, so anything read there would be replaced anyway.
          </p>
          <p>
            The department and the person responsible are never guessed. An emailed invoice always lands in
            To Be Assigned for somebody to hand out.
          </p>
          <p>
            The wording of the email itself is never read — only the document attached to it. If an email
            arrives with no attachment, an invoice is still created, marked so you can find it.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
