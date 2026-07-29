'use client'

import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PREBUILT_INVOICE_SOURCE_FIELDS } from '@/backend/lib/intake-field-mapping'
import { DUPLICATE_KEY_FIELDS } from '@/backend/lib/duplicate-detection'
import type { IntakeTestReport } from '@/backend/actions/intake-test-actions'
import { Step, formatMoney } from './step'

/**
 * The working, shown one step at a time.
 *
 * Everything here is read off the record the pipeline itself left behind as it
 * ran, not recalculated afterwards, so what the screen says and what the system
 * did cannot drift apart.
 */
export function ReadingSteps({ report }: { report: IntakeTestReport }) {
  const unit = report.trace.units[0]
  if (!unit) {
    return (
      <Step number={1} title="Nothing to check">
        <p>That file could not be treated as an invoice document, so there was nothing to work through.</p>
      </Step>
    )
  }

  const sourceLabel = (name: string) =>
    PREBUILT_INVOICE_SOURCE_FIELDS.find((f) => f.name === name)?.label ?? name
  const fieldLabel = (key: string) => report.fieldLabels[key] ?? key
  const rows = unit.mapping.filter((row) => row.enabled)
  const extra = Object.keys(unit.extraction?.fields ?? {}).filter(
    (name) => !rows.some((row) => row.sourceField === name),
  )

  return (
    <div className="space-y-5">
      <Step number={1} title="The file you gave us">
        <p>
          <strong>{report.file.name}</strong>
          {unit.sentForReading ? (
            report.readingSource === 'service' ? (
              <> — this kind of file can be read automatically, so it was sent to be read.</>
            ) : (
              <> — this kind of file can be read automatically, so the details you typed in were used in
              place of a machine reading.</>
            )
          ) : (
            <> — this kind of file is not read automatically. The invoice would still be created, with the
            file attached and every detail left blank for somebody to type in.</>
          )}
        </p>
        {unit.ocrFailure ? (
          <p className="text-amber-700">
            The document could not be read. The invoice is still created, with the file attached, so nobody
            has to chase the supplier for it again.
          </p>
        ) : null}
        <p className="text-muted-foreground">
          It would be recorded as having arrived from {report.senderAddress} with the subject
          &ldquo;{report.subject}&rdquo;, because a check like this has no real sender.
        </p>
      </Step>

      <Step number={2} title="What was read, and where each answer goes">
        <p>
          A reading has to be at least {Math.round(unit.confidenceThreshold * 100)}% certain before it is
          used. {report.mappingIsConfigured
            ? 'The list below is your own set of rules.'
            : 'The list below is the set the system starts with, because no rules have been set up yet.'}
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Read from the document</TableHead>
              <TableHead>What it says</TableHead>
              <TableHead className="w-24">How sure</TableHead>
              <TableHead>Fills in</TableHead>
              <TableHead className="w-56">Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const found = unit.extraction?.fields[row.sourceField]
              const used = unit.mapped.values[row.appField] !== undefined
              const doubtful = unit.mapped.belowThreshold.includes(row.appField)
              return (
                <TableRow key={`${row.appField}:${row.sourceField}`}>
                  <TableCell className="text-xs">{sourceLabel(row.sourceField)}</TableCell>
                  <TableCell className="text-xs">{found?.value?.trim() || '—'}</TableCell>
                  <TableCell className="text-xs">
                    {found ? `${Math.round(found.confidence * 100)}%` : '—'}
                  </TableCell>
                  <TableCell className="text-xs">{fieldLabel(row.appField)}</TableCell>
                  <TableCell className="text-xs">
                    {used ? (
                      <Badge variant="secondary">Filled in</Badge>
                    ) : doubtful ? (
                      <span className="text-amber-700">
                        Left blank — not certain enough to trust
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Nothing found on the document</span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        {extra.length > 0 ? (
          <p className="text-muted-foreground">
            Also read off the document but not used anywhere, because no rule says where it belongs:{' '}
            {extra.map(sourceLabel).join(', ')}.
          </p>
        ) : null}
      </Step>

      <Step number={3} title="Matching the supplier">
        <VendorOutcome report={report} />
      </Step>

      <Step number={4} title="Do the amounts add up?">
        {!unit.amounts.reconciliation.checked ? (
          <p>
            One of the three amounts is missing, so they could not be checked against each other. Whoever
            picks the invoice up will need to fill in the rest.
          </p>
        ) : unit.amounts.reconciliation.reconciles ? (
          <p>
            Yes. {formatMoney(unit.amounts.subtotal)} before taxes plus {formatMoney(unit.amounts.totalTax)}{' '}
            of tax comes to {formatMoney(unit.amounts.grandTotal)}.
          </p>
        ) : (
          <p className="text-amber-700">
            No — they are out by {formatMoney(unit.amounts.reconciliation.difference)}.{' '}
            {formatMoney(unit.amounts.subtotal)} plus {formatMoney(unit.amounts.totalTax)} does not come to{' '}
            {formatMoney(unit.amounts.grandTotal)}. The invoice is still created and marked so somebody
            looks at it — vendors do send invoices that do not add up.
          </p>
        )}
      </Step>

      <Step number={5} title="Has this invoice come in before?">
        <DuplicateOutcome report={report} />
      </Step>
    </div>
  )
}

function VendorOutcome({ report }: { report: IntakeTestReport }) {
  const unit = report.trace.units[0]
  const percent = Math.round(unit.vendorMatch.score * 100)

  if (unit.vendorName.trim() === '') {
    return <p>No supplier name was read off the document, so there was nothing to match.</p>
  }
  if (unit.vendorMatch.vendorId !== null) {
    return (
      <p>
        The document says <strong>{unit.vendorName}</strong>, and that was matched to{' '}
        <strong>{report.matchedVendorName ?? 'a supplier in your list'}</strong> — a {percent}% likeness,
        confident enough to fill in without asking you.
      </p>
    )
  }
  if (unit.vendorMatch.ambiguous) {
    return (
      <p className="text-amber-700">
        The document says <strong>{unit.vendorName}</strong>, and more than one supplier in your list looks
        like it. Rather than risk paying the wrong company, the supplier was left blank for you to pick.
      </p>
    )
  }
  return (
    <p className="text-amber-700">
      The document says <strong>{unit.vendorName}</strong>, and nothing in your supplier list is close
      enough to it. The supplier was left blank and the invoice is marked as needing a supplier added.
    </p>
  )
}

function DuplicateOutcome({ report }: { report: IntakeTestReport }) {
  const { duplicate } = report.trace.units[0]
  const compared = [...new Set(duplicate.rule.keyFields)]
    .map((key) => DUPLICATE_KEY_FIELDS.find((f) => f.key === key)?.label ?? key)
    .join(' and the ')

  if (duplicate.signature === null) {
    return (
      <p>
        Nothing could be compared. The rule looks at the {compared}, and none of those had a value on this
        document, so this invoice cannot be told apart from any other.
      </p>
    )
  }

  const identity = (
    <>
      It was identified by its {compared}, and compared against {duplicate.candidatesCompared}{' '}
      {duplicate.candidatesCompared === 1 ? 'invoice' : 'invoices'} already in the system.
    </>
  )

  if (duplicate.matches.length === 0) {
    return (
      <p>
        No, this one is new. {identity}
      </p>
    )
  }

  const list = duplicate.matches.map((m) => m.invoiceNumber).filter(Boolean).join(', ')
  return (
    <div className="space-y-1">
      <p className="text-amber-700">
        Yes — it looks like the same invoice as {list || 'one already in the system'}. {identity}
      </p>
      <p>
        {duplicate.blocked
          ? 'Your settings say a repeat should be refused, so no invoice would be created from this document.'
          : duplicate.flagged
            ? 'Your settings say a repeat should be marked and let through, so the invoice is created carrying a warning for whoever picks it up.'
            : 'Your settings say repeats should be let through without comment, so the invoice is created as normal.'}
      </p>
    </div>
  )
}
