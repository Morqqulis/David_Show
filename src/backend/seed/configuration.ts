import type { Payload } from 'payload'
import { EMAIL_TEMPLATE_SEEDS } from './email-templates'
import { seedEmailSettings } from './email-settings'
import { seedCodingRules } from './coding-rules'
import { seedActionReasons } from './action-reasons'
import { seedGlDepartmentRouting } from './gl-department-routing'
import {
  seedDuplicateRule,
  seedEmailSuppression,
  seedIntakeSettings,
  seedOcrFieldMap,
} from './intake'

/**
 * Fills in configuration WITHOUT touching operational data.
 *
 * `seedAll` clears and rebuilds the whole database, which is right for a fresh
 * environment and wrong for one that already holds invoices somebody cares
 * about. This entry point exists for the second case: the configuration tables
 * arrive empty when new collections are pushed, every reader falls back to
 * documented defaults, and the result is a set of finished features that quietly
 * do nothing visible. This puts real rows behind them and leaves invoices,
 * coding lines, documents, users, vendors, GL accounts, departments, stages,
 * fields and batches exactly as they were.
 *
 * Every step is skip-if-present rather than replace, so running it twice is
 * safe and it will never overwrite a setting an administrator has since edited.
 */

type StepResult = { name: string; action: 'created' | 'already configured' }

async function isEmpty(payload: Payload, collection: string): Promise<boolean> {
  const res = await payload.find({ collection: collection as never, limit: 1, depth: 0 })
  return res.totalDocs === 0
}

export async function seedConfiguration(payload: Payload): Promise<{ steps: StepResult[] }> {
  const steps: StepResult[] = []

  const step = async (name: string, collection: string, run: () => Promise<unknown>) => {
    if (!(await isEmpty(payload, collection))) {
      steps.push({ name, action: 'already configured' })
      return
    }
    await run()
    steps.push({ name, action: 'created' })
  }

  // GL format + sub-department ranges. Needs the departments that already exist
  // — this is configuration ABOUT them, not a rebuild of them.
  const departments = await payload.find({ collection: 'departments', limit: 200, depth: 0 })
  await step('GL format and department ranges', 'gl-format', () =>
    seedGlDepartmentRouting(payload, departments.docs as never),
  )

  await step('Coding table rules', 'coding-rules', () => seedCodingRules(payload))
  await step('Reason lists for reassign, reject and cancel', 'action-reasons', () =>
    seedActionReasons(payload),
  )
  await step('Email sender, header and footer', 'email-settings', () => seedEmailSettings(payload))

  // Each intake table is guarded on ITSELF, not on a sibling. The bundled
  // `seedIntake` covers four collections at once; calling it behind a single
  // check on `intake-settings` added a second duplicate-rules row on a table
  // another screen had already created a row in, and a settings collection read
  // with `limit: 1` cannot tolerate two rows — an administrator would edit one
  // and the app would keep reading the other.
  await step('Mailbox and sender policy', 'intake-settings', () => seedIntakeSettings(payload))
  await step('Invoice reading field map', 'ocr-field-map', () => seedOcrFieldMap(payload))
  await step('Duplicate detection rule', 'duplicate-rules', () => seedDuplicateRule(payload))
  await step('Confirmation suppression list', 'email-suppression', () =>
    seedEmailSuppression(payload),
  )

  // Email templates are the one collection that is already partly populated:
  // five shipped before the reassignment and intake notices were written. Add
  // only what is missing, matched on the name, because the name is what the
  // sending code looks a template up by.
  const existingTemplates = await payload.find({
    collection: 'email-templates',
    limit: 200,
    depth: 0,
  })
  const haveNames = new Set(
    (existingTemplates.docs as Array<{ name?: string }>).map((d) => d.name ?? ''),
  )
  const missing = EMAIL_TEMPLATE_SEEDS.filter((t) => !haveNames.has(t.name))
  for (const template of missing) {
    await payload.create({ collection: 'email-templates', data: { ...template } as never })
  }
  steps.push({
    name: `Email templates (${missing.length} added, ${haveNames.size} already present)`,
    action: missing.length > 0 ? 'created' : 'already configured',
  })

  return { steps }
}
