import type { Payload } from 'payload'
import { clearAll } from './clear'
import { seedStages } from './stages'
import { seedDepartments } from './departments'
import { seedRoles } from './roles'
import { seedUsers } from './users'
import { seedVendors } from './vendors'
import { seedGLAccounts } from './gl-accounts'
import { seedDimensions } from './dimensions'
import { seedTaxCodes } from './tax-codes'
import { seedSections } from './sections'
import { seedFields } from './fields'
import { seedApprovalRules } from './approval-rules'
import { seedGlDepartmentRouting } from './gl-department-routing'
import { seedCodingRules } from './coding-rules'
import { seedActionReasons } from './action-reasons'
import { seedEmailTemplates } from './email-templates'
import { seedEmailTriggers } from './email-triggers'
import { seedEmailSettings } from './email-settings'
import { seedIntake } from './intake'
import { seedBatches } from './batches'
import { seedInvoices } from './invoices'

export type SeedResult = {
  cleared: boolean
  counts: Record<string, number>
}

export async function seedAll(
  payload: Payload,
  { reset = true }: { reset?: boolean } = {},
): Promise<SeedResult> {
  if (reset) await clearAll(payload)

  // Order matters — later seeds reference earlier records.
  const stages = await seedStages(payload)
  const departments = await seedDepartments(payload)
  const roles = await seedRoles(payload, stages)
  const users = await seedUsers(payload, roles, departments)
  const vendors = await seedVendors(payload)
  const glAccounts = await seedGLAccounts(payload)
  const dimensions = await seedDimensions(payload)
  const taxCodes = await seedTaxCodes(payload, glAccounts)
  const sections = await seedSections(payload)
  const fields = await seedFields(payload, sections, stages)
  const approvalRules = await seedApprovalRules(payload, roles, departments)
  await seedGlDepartmentRouting(payload, departments)
  await seedCodingRules(payload)
  await seedActionReasons(payload)
  const emailTemplates = await seedEmailTemplates(payload)
  await seedEmailTriggers(payload, emailTemplates, stages, roles)
  await seedEmailSettings(payload)
  // Runs after the field schema, since the OCR mapping table points at app
  // fields by key.
  await seedIntake(payload)
  const batches = await seedBatches(payload, users)
  const invoices = await seedInvoices(payload, {
    stages,
    vendors,
    glAccounts,
    taxCodes,
    dimensions,
    users,
    departments,
    batches,
  })

  return {
    cleared: reset,
    counts: {
      stages: stages.length,
      departments: departments.length,
      roles: roles.length,
      users: users.length,
      vendors: vendors.length,
      glAccounts: glAccounts.length,
      dimensions: dimensions.length,
      taxCodes: taxCodes.length,
      sections: sections.length,
      fields: fields.length,
      approvalRules: approvalRules.length,
      emailTemplates: emailTemplates.length,
      batches: batches.length,
      invoices: invoices.length,
    },
  }
}
