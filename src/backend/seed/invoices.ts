import type { Payload } from 'payload'
import { computeLine } from '../lib/tax-math'
import { INVOICE_FIXTURES } from './fixtures/invoice-fixtures'
import type { Id, InvoiceSeed, SeedCtx } from './types'

type LineDoc = {
  order: number
  glAccount: Id
  costCenter?: Id | null
  project?: Id | null
  fund?: Id | null
  amount: number
  taxCode: Id
  taxAmount: number
  recoverable: number
  nonRecoverable: number
  description?: string
}

function buildLines(seed: InvoiceSeed, ctx: SeedCtx): { lines: LineDoc[]; subtotal: number; totalTax: number } {
  const lines: LineDoc[] = []
  let subtotal = 0
  let totalTax = 0

  for (let i = 0; i < seed.lines.length; i++) {
    const l = seed.lines[i]
    const gl = ctx.glAccounts.find((g) => g.code === l.glCode)!
    const tax = ctx.taxCodes.find((t) => t.code === l.taxCode)!
    const cc = l.costCenterCode ? ctx.dimensions.find((d) => d.code === l.costCenterCode) : null
    const proj = l.projectCode ? ctx.dimensions.find((d) => d.code === l.projectCode) : null
    const fund = l.fundCode ? ctx.dimensions.find((d) => d.code === l.fundCode) : null
    const computed = computeLine({ amount: l.amount, rate: tax.rate, recoverablePct: tax.recoverablePct })

    subtotal += computed.amount
    totalTax += computed.taxAmount

    lines.push({
      order: i + 1,
      glAccount: gl.id,
      costCenter: cc?.id ?? null,
      project: proj?.id ?? null,
      fund: fund?.id ?? null,
      amount: computed.amount,
      taxCode: tax.id,
      taxAmount: computed.taxAmount,
      recoverable: computed.recoverable,
      nonRecoverable: computed.nonRecoverable,
      description: l.description,
    })
  }

  return {
    lines,
    subtotal: Math.round(subtotal * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
  }
}

async function createInvoiceWithRelations(payload: Payload, ctx: SeedCtx, seed: InvoiceSeed) {
  const stageId = ctx.stages.find((s) => s.systemId === seed.stage)!.id
  const vendor = ctx.vendors[seed.vendorIdx]
  const { lines: lineDocs, subtotal, totalTax } = buildLines(seed, ctx)
  const grandTotal = Math.round((subtotal + totalTax) * 100) / 100

  const departmentIds = seed.departmentCodes.map((c) => ctx.departments.find((d) => d.code === c)!.id)
  const assigneeIds = seed.assigneeEmails.map((e) => ctx.users.find((u) => u.email === e)!.id)
  const batchId = seed.batchNumber ? ctx.batches.find((b) => b.number === seed.batchNumber)?.id : undefined

  const customFields: Record<string, unknown> = {}
  if (seed.priority) customFields.priority = seed.priority
  if (seed.confidential) customFields.confidential = true

  const invoice = await payload.create({
    collection: 'invoices',
    data: {
      invoiceNumber: seed.invoiceNumber,
      vendor: vendor.id as never,
      invoiceDate: seed.invoiceDate,
      dueDate: seed.dueDate,
      fiscalYear: '2026',
      poNumber: seed.poNumber,
      subtotal,
      totalTax,
      grandTotal,
      currentStage: stageId as never,
      departments: departmentIds as never,
      assignees: assigneeIds as never,
      batch: batchId as never,
      verified: seed.verified ?? false,
      verifiedAt: seed.verified ? new Date().toISOString() : undefined,
      confidential: !!seed.confidential,
      ocrConfidence: seed.ocrConfidence,
      createdVia: seed.createdVia ?? 'email',
      customFields,
      flags: {
        noAttachment: seed.flags?.noAttachment ?? false,
        ocrFailed: seed.flags?.ocrFailed ?? false,
        vendorSetupRequired: seed.flags?.vendorSetupRequired ?? false,
        possibleDuplicate: seed.flags?.possibleDuplicate ?? false,
        archiveFailed: seed.flags?.archiveFailed ?? false,
        archiveAttempts: seed.flags?.archiveFailed ? 5 : 0,
      },
    } as never,
  })

  for (const lineDoc of lineDocs) {
    await payload.create({
      collection: 'invoice-lines',
      data: { ...lineDoc, invoice: invoice.id } as never,
    })
  }

  for (const c of seed.comments ?? []) {
    const author = ctx.users.find((u) => u.email === c.authorEmail)!
    await payload.create({
      collection: 'invoice-comments',
      data: { invoice: invoice.id as never, author: author.id as never, body: c.body },
    })
  }

  await payload.create({
    collection: 'audit-events',
    data: {
      invoice: invoice.id as never,
      actor: ctx.users[0].id as never,
      action: 'created' as never,
      context: { via: seed.createdVia ?? 'email' } as never,
    },
  })

  return invoice
}

export async function seedInvoices(payload: Payload, ctx: SeedCtx) {
  const created = []
  for (const seed of INVOICE_FIXTURES) {
    created.push(await createInvoiceWithRelations(payload, ctx, seed))
  }
  return created
}
