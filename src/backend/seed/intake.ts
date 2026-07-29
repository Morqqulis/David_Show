import type { Payload } from 'payload'
import { DEFAULT_AMOUNT_TOLERANCE } from '../lib/intake-amounts'
import { DEFAULT_DUPLICATE_RULE } from '../lib/duplicate-detection'
import { DEFAULT_CONFIDENCE_THRESHOLD, DEFAULT_FIELD_MAPPING } from '../lib/intake-field-mapping'
import { DEFAULT_SENDER_POLICY } from '../lib/intake-sender-policy'

/**
 * Starting settings for email intake.
 *
 * Collecting is switched **off** and the mailbox address is left blank on
 * purpose: a seeded database must never start reaching into somebody's mail on
 * its own. An administrator turns it on once the address is right.
 *
 * Every value here is the same default the readers fall back to when the row is
 * missing, so seeding changes nothing about how the app behaves — it just makes
 * the settings visible and editable on the screens.
 */
export async function seedIntakeSettings(payload: Payload) {
  return payload.create({
    collection: 'intake-settings' as never,
    data: {
      enabled: false,
      mailboxAddress: null,
      senderPolicy: DEFAULT_SENDER_POLICY.mode,
      internalDomains: [{ domain: 'aurora.ca' }],
      confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
      amountTolerance: DEFAULT_AMOUNT_TOLERANCE,
    } as never,
  })
}

export async function seedOcrFieldMap(payload: Payload) {
  return Promise.all(
    DEFAULT_FIELD_MAPPING.map((row, order) =>
      payload.create({
        collection: 'ocr-field-map' as never,
        data: { ...row, order } as never,
      }),
    ),
  )
}

export async function seedDuplicateRule(payload: Payload) {
  return payload.create({
    collection: 'duplicate-rules' as never,
    data: {
      keyFields: DEFAULT_DUPLICATE_RULE.keyFields.map((field) => ({ field })),
      action: DEFAULT_DUPLICATE_RULE.action,
      ignoreCancelled: DEFAULT_DUPLICATE_RULE.ignoreCancelled,
      caseInsensitive: DEFAULT_DUPLICATE_RULE.caseInsensitive,
      appliesToManualEntry: DEFAULT_DUPLICATE_RULE.appliesToManualEntry,
      windowDays: DEFAULT_DUPLICATE_RULE.windowDays,
    } as never,
  })
}

/**
 * The AP team goes on the suppression list from the start: they forward
 * invoices all day, and a confirmation for each one is noise rather than
 * information. Matched against the role name, so one entry covers everyone
 * holding it.
 */
export async function seedEmailSuppression(payload: Payload) {
  return payload.create({
    collection: 'email-suppression' as never,
    data: {
      value: 'Finance Team',
      kind: 'group',
      note: 'Forwards invoices as part of the job, so confirmations would be noise.',
    } as never,
  })
}

export async function seedIntake(payload: Payload) {
  const [settings, mapping, rule, suppression] = await Promise.all([
    seedIntakeSettings(payload),
    seedOcrFieldMap(payload),
    seedDuplicateRule(payload),
    seedEmailSuppression(payload),
  ])
  return { settings, mapping, rule, suppression }
}
