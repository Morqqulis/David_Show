'use client'

import { CheckCircle2, Info } from 'lucide-react'
import type { CheckSetup } from '../intake-test-console'

/**
 * What a finance clerk needs to know before running a check: which of the
 * settings this depends on have actually been filled in, and which are still
 * running on the values the system ships with. Every table behind this screen
 * is empty on a fresh install, so saying nothing would leave the screen looking
 * broken rather than unconfigured.
 */
export function SetupSummary({ setup }: { setup: CheckSetup }) {
  const lines: string[] = [
    setup.mappingIsConfigured
      ? `Your own rules decide which reading fills which field — ${setup.mappingRuleCount} of them.`
      : `Nobody has set up rules for which reading fills which field yet, so the starting set of ${setup.mappingRuleCount} is being used (invoice number, supplier, both dates, purchase order number and the three amounts).`,
    setup.thresholdIsConfigured
      ? `A reading must be at least ${Math.round(setup.confidenceThreshold * 100)}% certain before it is used.`
      : `Nobody has chosen how certain a reading has to be, so the starting value of ${Math.round(setup.confidenceThreshold * 100)}% is being used. Anything less certain is left blank for you to fill in.`,
    setup.duplicateRuleIsConfigured
      ? 'Your own rule decides what counts as the same invoice arriving twice.'
      : `Nobody has set up a rule for repeated invoices yet, so the starting rule is being used: an invoice counts as a repeat when the ${setup.duplicateKeyLabels.join(' and the ')} both match, and a repeat is marked rather than refused.`,
    setup.vendorCount > 0
      ? `Supplier names on the document are matched against the ${setup.vendorCount} suppliers in your list.`
      : 'There are no suppliers in your list, so no supplier can be matched and the field will always be left blank.',
    `Amounts are treated as adding up if they are within ${formatMoney(setup.amountTolerance)} of each other.`,
  ]

  return (
    <div className="space-y-3">
      <div
        className={
          setup.readingServiceOn
            ? 'flex gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900'
            : 'flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900'
        }
      >
        {setup.readingServiceOn ? (
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        ) : (
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        )}
        {setup.readingServiceOn ? (
          <p>
            Automatic invoice reading is switched on for this site. The file you choose will genuinely be
            read, and what it finds is used for everything that follows.
          </p>
        ) : (
          <p>
            <strong>Automatic invoice reading has not been switched on for this site yet.</strong> You can
            still run the whole check: type in below what the invoice says, as if it had been read off the
            page, and everything after that — matching the supplier, checking the amounts, looking for a
            repeat, creating the invoice — happens for real against your live settings.
          </p>
        )}
      </div>

      <div className="rounded-md bg-muted/50 p-3">
        <p className="pb-1.5 text-xs font-medium">What is set up right now</p>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {lines.map((line) => (
            <li key={line}>· {line}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value)
}
