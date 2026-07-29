import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getPayload } from '@/backend/lib/payload'
import { isDocumentIntelligenceConfigured } from '@/backend/lib/document-intelligence'
import { DEFAULT_AMOUNT_TOLERANCE } from '@/backend/lib/intake-amounts'
import {
  DEFAULT_CONFIDENCE_THRESHOLD,
  DEFAULT_FIELD_MAPPING,
} from '@/backend/lib/intake-field-mapping'
import { DEFAULT_DUPLICATE_RULE, DUPLICATE_KEY_FIELDS } from '@/backend/lib/duplicate-detection'
import {
  IntakeTestConsole,
  type CheckSetup,
} from '@/components/app/settings/intake-test-console'

export const dynamic = 'force-dynamic'

/**
 * Test invoice reading.
 *
 * The email pipeline cannot be shown to anybody until a mailbox exists. This
 * screen supplies the one thing the mailbox would have supplied — a document —
 * and runs everything after it for real against the live settings.
 */
export default async function IntakeTestPage() {
  const payload = await getPayload()
  const readingServiceOn = isDocumentIntelligenceConfigured()

  let setup: CheckSetup
  try {
    const [mapRes, settingsRes, ruleRes, vendorRes] = await Promise.all([
      payload.find({ collection: 'ocr-field-map', limit: 1, depth: 0 }),
      payload.find({ collection: 'intake-settings', limit: 1, depth: 0 }),
      payload.find({ collection: 'duplicate-rules', limit: 1, depth: 0 }),
      payload.find({ collection: 'vendors', where: { active: { equals: true } }, limit: 1, depth: 0 }),
    ])

    const settings = settingsRes.docs[0] as
      | { confidenceThreshold?: number; amountTolerance?: number }
      | undefined

    setup = {
      readingServiceOn,
      mappingIsConfigured: mapRes.totalDocs > 0,
      mappingRuleCount: mapRes.totalDocs > 0 ? mapRes.totalDocs : DEFAULT_FIELD_MAPPING.length,
      thresholdIsConfigured: typeof settings?.confidenceThreshold === 'number',
      confidenceThreshold: settings?.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD,
      amountTolerance: settings?.amountTolerance ?? DEFAULT_AMOUNT_TOLERANCE,
      duplicateRuleIsConfigured: ruleRes.totalDocs > 0,
      duplicateKeyLabels: DEFAULT_DUPLICATE_RULE.keyFields.map(
        (key) => DUPLICATE_KEY_FIELDS.find((f) => f.key === key)?.label ?? key,
      ),
      vendorCount: vendorRes.totalDocs,
    }
  } catch (err) {
    console.error('[intake-check] the current settings could not be loaded', {
      message: err instanceof Error ? err.message : 'unknown error',
    })
    return (
      <Card>
        <CardHeader>
          <CardTitle>Test invoice reading</CardTitle>
          <CardDescription>
            The current settings could not be loaded, so a check cannot be run right now. Try again in a
            moment; if it keeps happening, contact your administrator.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Test invoice reading</CardTitle>
          <CardDescription>
            Pick an invoice from your computer and watch, step by step, what the system would do with it if
            it had arrived by email. Nothing is added to your queue unless you press the button at the end
            and say so.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IntakeTestConsole setup={setup} />
        </CardContent>
      </Card>
    </div>
  )
}
