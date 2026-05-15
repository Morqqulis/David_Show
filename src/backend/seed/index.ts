import type { Payload } from 'payload'
import { REQUIRED_STAGE_IDS, STAGE_LABELS, STAGE_ORDER, STAGE_TONE, type StageId } from '../lib/stage-ids'
import { computeLine } from '../lib/tax-math'

type Id = string | number

type SeedResult = {
  cleared: boolean
  counts: Record<string, number>
}

const COLLECTIONS_TO_CLEAR = [
  'audit-events',
  'invoice-comments',
  'invoice-lines',
  'documents',
  'invoices',
  'batches',
  'email-triggers',
  'email-templates',
  'coding-restrictions',
  'approval-rules',
  'fields',
  'sections',
  'stages',
  'tax-codes',
  'dimensions',
  'gl-accounts',
  'vendors',
  'roles',
  'departments',
] as const

export async function seedAll(payload: Payload, { reset = true }: { reset?: boolean } = {}): Promise<SeedResult> {
  if (reset) await clearAll(payload)

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
  await seedCodingRestrictions(payload, departments)
  const emailTemplates = await seedEmailTemplates(payload)
  await seedEmailTriggers(payload, emailTemplates, stages, roles)
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

async function clearAll(payload: Payload) {
  for (const slug of COLLECTIONS_TO_CLEAR) {
    try {
      await payload.delete({ collection: slug as never, where: { id: { exists: true } } as never })
    } catch (e) {
      console.warn(`[seed] could not clear ${slug}:`, (e as Error).message)
    }
  }
}

async function seedStages(payload: Payload) {
  const docs = []
  for (let i = 0; i < STAGE_ORDER.length; i++) {
    const systemId = STAGE_ORDER[i]
    const doc = await payload.create({
      collection: 'stages',
      data: {
        systemId,
        label: STAGE_LABELS[systemId],
        order: i + 1,
        tone: STAGE_TONE[systemId] as never,
        active: true,
        required: REQUIRED_STAGE_IDS.includes(systemId),
        bulkAssign: systemId === 'to_be_assigned' || systemId === 'ap_review',
        batchAssign: systemId === 'ready_for_processing',
        verifyFlag: systemId === 'treasurer_review',
        allowReject: systemId !== 'completed',
        allowReassign: systemId !== 'completed',
      },
    })
    docs.push(doc)
  }
  return docs
}

async function seedDepartments(payload: Payload) {
  const data = [
    { name: 'Public Works', code: 'PW' },
    { name: 'Information Technology', code: 'IT' },
    { name: 'Parks & Recreation', code: 'PR' },
    { name: 'Library', code: 'LIB' },
    { name: 'Fire', code: 'FIRE' },
    { name: 'Finance / AP', code: 'AP' },
    { name: 'Administration', code: 'ADM' },
  ]
  return Promise.all(data.map((d) => payload.create({ collection: 'departments', data: d })))
}

async function seedRoles(payload: Payload, stages: { id: Id; systemId: string }[]) {
  const apReview = stages.find((s) => s.systemId === 'ap_review')!
  const data: Array<Parameters<Payload['create']>[0]['data']> = [
    {
      name: 'Admin',
      description: 'Full access — only role permitted to delete records and edit settings',
      confidential: true,
      bypassCodingRestrictions: true,
      isSystem: true,
      permissions: [
        { action: 'view', object: 'invoice', scope: 'all' },
        { action: 'edit', object: 'invoice', scope: 'all' },
        { action: 'configure', object: 'settings', scope: 'all' },
        { action: 'delete', object: 'invoice', scope: 'all' },
      ],
    },
    {
      name: 'AP Clerk',
      description: 'View, edit, approve invoices across all stages',
      confidential: false,
      bypassCodingRestrictions: true,
      isSystem: false,
      permissions: [
        { action: 'view', object: 'invoice', scope: 'all' },
        { action: 'edit', object: 'invoice', scope: 'all' },
        { action: 'approve', object: 'invoice', scope: 'all' },
        { action: 'assign', object: 'invoice', scope: 'all' },
        { action: 'export', object: 'invoice', scope: 'all' },
      ],
    },
    {
      name: 'AP Supervisor',
      description: 'AP Clerk + oversight + confidential access',
      confidential: true,
      bypassCodingRestrictions: true,
      isSystem: false,
      permissions: [
        { action: 'view', object: 'invoice', scope: 'all' },
        { action: 'edit', object: 'invoice', scope: 'all' },
        { action: 'approve', object: 'invoice', scope: 'all' },
        { action: 'reject', object: 'invoice', scope: 'all' },
        { action: 'reassign', object: 'invoice', scope: 'all' },
      ],
    },
    {
      name: 'Department Reviewer',
      description: 'Code/approve invoices assigned to their department in Department Review',
      confidential: false,
      bypassCodingRestrictions: false,
      isSystem: false,
      permissions: [
        { action: 'view', object: 'invoice', scope: 'department', stages: [apReview.id] as never },
        { action: 'code', object: 'invoice', scope: 'department' },
        { action: 'approve', object: 'invoice', scope: 'department' },
      ],
    },
    {
      name: 'Conditional Approver',
      description: 'View + approve / reject invoices routed by rules',
      confidential: false,
      bypassCodingRestrictions: false,
      isSystem: false,
      permissions: [
        { action: 'view', object: 'invoice', scope: 'own' },
        { action: 'approve', object: 'invoice', scope: 'own' },
        { action: 'reject', object: 'invoice', scope: 'own' },
      ],
    },
    {
      name: 'Treasurer',
      description: 'View, verify, approve / reject across stages',
      confidential: true,
      bypassCodingRestrictions: true,
      isSystem: false,
      permissions: [
        { action: 'view', object: 'invoice', scope: 'all' },
        { action: 'verify', object: 'invoice', scope: 'all' },
        { action: 'reject', object: 'invoice', scope: 'all' },
        { action: 'approve', object: 'invoice', scope: 'all' },
      ],
    },
  ]
  return Promise.all(data.map((d) => payload.create({ collection: 'roles', data: d as never })))
}

async function seedUsers(
  payload: Payload,
  roles: { id: Id; name: string }[],
  departments: { id: Id; code: string }[],
) {
  const r = (n: string) => roles.find((x) => x.name === n)!.id
  const d = (c: string) => departments.find((x) => x.code === c)!.id

  const data: Array<{ name: string; email: string; role: Id; department: Id; password: string }> = [
    { name: 'David Ayele', email: 'david@aurora.ca', role: r('Admin'), department: d('ADM'), password: 'demo1234' },
    { name: 'Sarah Chen', email: 'sarah.chen@aurora.ca', role: r('AP Supervisor'), department: d('AP'), password: 'demo1234' },
    { name: 'Marcus Patel', email: 'marcus.patel@aurora.ca', role: r('AP Clerk'), department: d('AP'), password: 'demo1234' },
    { name: 'Lena Brooks', email: 'lena.brooks@aurora.ca', role: r('AP Clerk'), department: d('AP'), password: 'demo1234' },
    { name: 'Jordan Lee', email: 'jordan.lee@aurora.ca', role: r('Department Reviewer'), department: d('PW'), password: 'demo1234' },
    { name: 'Priya Kumar', email: 'priya.kumar@aurora.ca', role: r('Department Reviewer'), department: d('IT'), password: 'demo1234' },
    { name: 'Tomás Garcia', email: 'tomas.garcia@aurora.ca', role: r('Department Reviewer'), department: d('PR'), password: 'demo1234' },
    { name: 'Aisha Mohamed', email: 'aisha.mohamed@aurora.ca', role: r('Department Reviewer'), department: d('LIB'), password: 'demo1234' },
    { name: 'Liam O\'Connor', email: 'liam.oconnor@aurora.ca', role: r('Department Reviewer'), department: d('FIRE'), password: 'demo1234' },
    { name: 'Hannah Wright', email: 'hannah.wright@aurora.ca', role: r('Conditional Approver'), department: d('ADM'), password: 'demo1234' },
    { name: 'Robert Klein', email: 'robert.klein@aurora.ca', role: r('Treasurer'), department: d('ADM'), password: 'demo1234' },
  ]
  // Upsert by email — Payload doesn't let us delete the currently authed user, so we have to handle existing rows.
  const out: Array<{ id: Id; email: string }> = []
  for (const u of data) {
    const existing = await payload.find({
      collection: 'users',
      where: { email: { equals: u.email } } as never,
      limit: 1,
      depth: 0,
    })
    if (existing.docs[0]) {
      // Preserve password on existing user; just refresh profile data + role/department wiring.
      const patch = { name: u.name, role: u.role, department: u.department }
      const updated = await payload.update({
        collection: 'users',
        id: (existing.docs[0] as { id: Id }).id as never,
        data: patch as never,
      })
      out.push(updated as never)
    } else {
      const created = await payload.create({ collection: 'users', data: u as never })
      out.push(created as never)
    }
  }
  return out
}

async function seedVendors(payload: Payload) {
  const data = [
    { vendorNumber: 'V-0001', name: 'Northern Office Supplies Ltd.', email: 'ar@northernoffice.ca', city: 'Aurora', province: 'ON' },
    { vendorNumber: 'V-0002', name: 'BlueRock Construction Inc.', email: 'billing@bluerock.ca', city: 'Newmarket', province: 'ON' },
    { vendorNumber: 'V-0003', name: 'Aurora Hydro', email: 'invoices@aurorahydro.ca', city: 'Aurora', province: 'ON' },
    { vendorNumber: 'V-0004', name: 'CityFleet Vehicles', email: 'ap@cityfleet.ca', city: 'Toronto', province: 'ON' },
    { vendorNumber: 'V-0005', name: 'GreenLeaf Landscaping', email: 'greenleaf@example.ca', city: 'Vaughan', province: 'ON' },
    { vendorNumber: 'V-0006', name: 'TechBridge Solutions', email: 'finance@techbridge.io', city: 'Toronto', province: 'ON' },
    { vendorNumber: 'V-0007', name: 'PaperTrail Print Co.', email: 'billing@papertrail.ca', city: 'Markham', province: 'ON' },
    { vendorNumber: 'V-0008', name: 'Aurora Plumbing & Heating', email: 'aurora.pnh@example.ca', city: 'Aurora', province: 'ON' },
    { vendorNumber: 'V-0009', name: 'Frostline Snow Removal', email: 'ap@frostline.ca', city: 'Richmond Hill', province: 'ON' },
    { vendorNumber: 'V-0010', name: 'Metro Legal Services LLP', email: 'billing@metrolegal.ca', city: 'Toronto', province: 'ON' },
    { vendorNumber: 'V-0011', name: 'BookSource Library Suppliers', email: 'ar@booksource.ca', city: 'Mississauga', province: 'ON' },
    { vendorNumber: 'V-0012', name: 'Apex Safety Equipment', email: 'ap@apexsafety.ca', city: 'Brampton', province: 'ON' },
    { vendorNumber: 'V-0013', name: 'Pinewood IT Services', email: 'billing@pinewoodit.ca', city: 'Aurora', province: 'ON' },
    { vendorNumber: 'V-0014', name: 'CertaCloud Hosting', email: 'finance@certacloud.io', city: 'Toronto', province: 'ON' },
    { vendorNumber: 'V-0015', name: 'Pacific Janitorial', email: 'ar@pacjan.ca', city: 'North York', province: 'ON' },
  ]
  return Promise.all(data.map((v) => payload.create({ collection: 'vendors', data: v })))
}

async function seedGLAccounts(payload: Payload) {
  const accts = [
    { code: '01-1100-PW-5210', description: 'Public Works — Materials & Supplies' },
    { code: '01-1100-PW-5410', description: 'Public Works — Equipment Maintenance' },
    { code: '01-1100-PW-5610', description: 'Public Works — Snow Removal Services' },
    { code: '01-1200-IT-5110', description: 'IT — Software Licenses' },
    { code: '01-1200-IT-5120', description: 'IT — Cloud Services' },
    { code: '01-1200-IT-5310', description: 'IT — Hardware' },
    { code: '01-1300-PR-5210', description: 'Parks & Rec — Materials' },
    { code: '01-1300-PR-5510', description: 'Parks & Rec — Contracted Services' },
    { code: '01-1400-LIB-5410', description: 'Library — Books & Media' },
    { code: '01-1400-LIB-5210', description: 'Library — Supplies' },
    { code: '01-1500-FIRE-5210', description: 'Fire — Safety Equipment' },
    { code: '01-1500-FIRE-5310', description: 'Fire — Vehicle Maintenance' },
    { code: '01-1900-ADM-5110', description: 'Administration — Legal Fees' },
    { code: '01-1900-ADM-5210', description: 'Administration — Office Supplies' },
    { code: '02-2100-UTIL-5710', description: 'Utilities — Hydro' },
    { code: '02-2100-UTIL-5720', description: 'Utilities — Water' },
    { code: '03-3100-CAPEX-5910', description: 'Capital — Vehicles' },
    { code: '03-3100-CAPEX-5920', description: 'Capital — Equipment' },
    { code: '05-9100-CTRL-2010', description: 'AP Control Account' },
    { code: '05-9100-CTRL-1450', description: 'HST Recoverable (PSB)' },
  ]
  return Promise.all(
    accts.map((a) =>
      payload.create({
        collection: 'gl-accounts',
        data: {
          ...a,
          segments: a.code.split('-').map((value) => ({ value })),
        } as never,
      }),
    ),
  )
}

async function seedDimensions(payload: Payload) {
  const data: Array<{ kind: string; code: string; description: string }> = [
    { kind: 'cost_center', code: 'CC-PW01', description: 'Roads & Sidewalks' },
    { kind: 'cost_center', code: 'CC-PW02', description: 'Fleet Operations' },
    { kind: 'cost_center', code: 'CC-IT01', description: 'Helpdesk' },
    { kind: 'cost_center', code: 'CC-IT02', description: 'Infrastructure' },
    { kind: 'cost_center', code: 'CC-PR01', description: 'Town Park' },
    { kind: 'cost_center', code: 'CC-PR02', description: 'Recreation Centre' },
    { kind: 'cost_center', code: 'CC-LIB01', description: 'Main Library Branch' },
    { kind: 'cost_center', code: 'CC-FIRE01', description: 'Station 1' },
    { kind: 'cost_center', code: 'CC-ADM01', description: 'Town Hall' },
    { kind: 'project', code: 'P-2026-001', description: 'Hwy 404 Salt Storage Upgrade' },
    { kind: 'project', code: 'P-2026-007', description: 'Library Annex Renovation' },
    { kind: 'project', code: 'P-2026-015', description: 'M365 E5 Rollout' },
    { kind: 'fund', code: 'F-GEN', description: 'General Fund' },
    { kind: 'fund', code: 'F-CAP', description: 'Capital Reserve Fund' },
    { kind: 'fund', code: 'F-WTR', description: 'Water Reserve Fund' },
  ]
  return Promise.all(data.map((d) => payload.create({ collection: 'dimensions', data: d as never })))
}

async function seedTaxCodes(payload: Payload, gls: { id: Id; code: string }[]) {
  const apControl = gls.find((g) => g.code === '05-9100-CTRL-2010')!.id
  const recoverable = gls.find((g) => g.code === '05-9100-CTRL-1450')!.id
  const data = [
    { code: 'HST-ON-PSB', label: 'HST Ontario — PSB Rebate', rate: 0.13, recoverablePct: 0.78, recoverableGl: recoverable, apControlGl: apControl },
    { code: 'HST-ON-FULL', label: 'HST Ontario — Fully Recoverable', rate: 0.13, recoverablePct: 1.0, recoverableGl: recoverable, apControlGl: apControl },
    { code: 'HST-ON-NONE', label: 'HST Ontario — Non Recoverable', rate: 0.13, recoverablePct: 0, recoverableGl: recoverable, apControlGl: apControl },
    { code: 'EXEMPT', label: 'Tax Exempt', rate: 0, recoverablePct: 0, recoverableGl: recoverable, apControlGl: apControl },
  ]
  return Promise.all(data.map((t) => payload.create({ collection: 'tax-codes', data: t as never })))
}

async function seedSections(payload: Payload) {
  const data = [
    { name: 'Details', order: 1 },
    { name: 'Amounts', order: 2 },
    { name: 'Workflow', order: 3 },
    { name: 'Custom', order: 4 },
  ]
  return Promise.all(data.map((s) => payload.create({ collection: 'sections', data: s })))
}

async function seedFields(
  payload: Payload,
  sections: { id: Id; name: string }[],
  stages: { id: Id; systemId: string }[],
) {
  const sec = (n: string) => sections.find((s) => s.name === n)!.id
  const stg = (s: string) => stages.find((x) => x.systemId === s)!.id

  type FieldSeed = {
    fieldKey: string
    label: string
    scope: 'header' | 'line'
    section?: Id
    type: string
    width?: string
    isSystem: boolean
    removable?: boolean
    showAsColumn?: boolean
    exportable?: boolean
    mandatoryAtStages?: Id[]
    options?: Array<{ value: string }>
    lookupEntity?: string
    order: number
  }

  const seeds: FieldSeed[] = [
    { fieldKey: 'invoiceNumber', label: 'Invoice Number', scope: 'header', section: sec('Details'), type: 'text', width: 'half', isSystem: true, removable: false, showAsColumn: true, exportable: true, mandatoryAtStages: [stg('ap_review')], order: 1 },
    { fieldKey: 'vendor', label: 'Vendor', scope: 'header', section: sec('Details'), type: 'lookup', lookupEntity: 'vendors', width: 'half', isSystem: true, removable: false, showAsColumn: true, exportable: true, mandatoryAtStages: [stg('ap_review')], order: 2 },
    { fieldKey: 'invoiceDate', label: 'Invoice Date', scope: 'header', section: sec('Details'), type: 'date', width: 'third', isSystem: true, removable: false, showAsColumn: true, exportable: true, mandatoryAtStages: [stg('ap_review')], order: 3 },
    { fieldKey: 'dueDate', label: 'Due Date', scope: 'header', section: sec('Details'), type: 'date', width: 'third', isSystem: true, removable: false, exportable: true, order: 4 },
    { fieldKey: 'fiscalYear', label: 'Fiscal Year', scope: 'header', section: sec('Details'), type: 'text', width: 'third', isSystem: true, removable: false, exportable: true, order: 5 },
    { fieldKey: 'poNumber', label: 'PO Number', scope: 'header', section: sec('Details'), type: 'text', width: 'half', isSystem: true, removable: false, exportable: true, order: 6 },
    { fieldKey: 'subtotal', label: 'Subtotal', scope: 'header', section: sec('Amounts'), type: 'currency', width: 'third', isSystem: true, removable: false, showAsColumn: false, exportable: true, mandatoryAtStages: [stg('ap_review')], order: 7 },
    { fieldKey: 'totalTax', label: 'Total Tax', scope: 'header', section: sec('Amounts'), type: 'currency', width: 'third', isSystem: true, removable: false, exportable: true, order: 8 },
    { fieldKey: 'grandTotal', label: 'Grand Total', scope: 'header', section: sec('Amounts'), type: 'currency', width: 'third', isSystem: true, removable: false, showAsColumn: true, exportable: true, mandatoryAtStages: [stg('ap_review')], order: 9 },
    { fieldKey: 'confidential', label: 'Confidential', scope: 'header', section: sec('Workflow'), type: 'yesno', width: 'half', isSystem: false, removable: true, order: 10 },
    { fieldKey: 'projectCode', label: 'Project Code', scope: 'header', section: sec('Custom'), type: 'choice', width: 'half', isSystem: false, removable: true, options: [{ value: 'P-2026-001' }, { value: 'P-2026-007' }, { value: 'P-2026-015' }], exportable: true, order: 11 },
    { fieldKey: 'priority', label: 'Priority', scope: 'header', section: sec('Custom'), type: 'choice', width: 'half', isSystem: false, removable: true, options: [{ value: 'Low' }, { value: 'Normal' }, { value: 'High' }, { value: 'Urgent' }], showAsColumn: true, order: 12 },
    { fieldKey: 'glAccount', label: 'GL Account', scope: 'line', type: 'lookup', lookupEntity: 'gl-accounts', isSystem: true, removable: false, exportable: true, order: 1 },
    { fieldKey: 'costCenter', label: 'Cost Center', scope: 'line', type: 'lookup', lookupEntity: 'cost_center', isSystem: false, removable: true, exportable: true, order: 2 },
    { fieldKey: 'project', label: 'Project', scope: 'line', type: 'lookup', lookupEntity: 'project', isSystem: false, removable: true, exportable: true, order: 3 },
    { fieldKey: 'fund', label: 'Fund', scope: 'line', type: 'lookup', lookupEntity: 'fund', isSystem: false, removable: true, exportable: true, order: 4 },
    { fieldKey: 'amount', label: 'Amount', scope: 'line', type: 'currency', isSystem: true, removable: false, exportable: true, order: 5 },
    { fieldKey: 'taxCode', label: 'Tax Code', scope: 'line', type: 'lookup', lookupEntity: 'tax-codes', isSystem: true, removable: false, exportable: true, order: 6 },
  ]
  return Promise.all(seeds.map((f) => payload.create({ collection: 'fields', data: f as never })))
}

async function seedApprovalRules(
  payload: Payload,
  roles: { id: Id; name: string }[],
  departments: { id: Id; code: string }[],
) {
  const conditional = roles.find((r) => r.name === 'Conditional Approver')!.id
  const apSup = roles.find((r) => r.name === 'AP Supervisor')!.id
  const itDept = departments.find((d) => d.code === 'IT')!.id

  const rules = [
    {
      name: 'Amount over $10,000',
      order: 1,
      enabled: true,
      conditions: { operator: 'and', conditions: [{ fieldKey: 'grandTotal', operator: 'greaterThan', value: 10000 }] },
      approvers: [{ type: 'role', role: apSup }],
      mode: 'parallel',
    },
    {
      name: 'IT spend over $5,000 → IT Head',
      order: 2,
      enabled: true,
      conditions: {
        operator: 'and',
        conditions: [
          { fieldKey: 'department', operator: 'equals', value: itDept },
          { fieldKey: 'grandTotal', operator: 'greaterThan', value: 5000 },
        ],
      },
      approvers: [{ type: 'department_head', department: itDept }],
      mode: 'parallel',
    },
    {
      name: 'Conditional Approver for $25k+',
      order: 3,
      enabled: true,
      conditions: { operator: 'and', conditions: [{ fieldKey: 'grandTotal', operator: 'greaterThanOrEqual', value: 25000 }] },
      approvers: [{ type: 'role', role: conditional }],
      mode: 'parallel',
    },
  ]
  return Promise.all(rules.map((r) => payload.create({ collection: 'approval-rules', data: r as never })))
}

async function seedCodingRestrictions(payload: Payload, departments: { id: Id; code: string; name: string }[]) {
  const restrictions = [
    { department: departments.find((d) => d.code === 'PW')!, value: 'PW' },
    { department: departments.find((d) => d.code === 'IT')!, value: 'IT' },
    { department: departments.find((d) => d.code === 'PR')!, value: 'PR' },
    { department: departments.find((d) => d.code === 'LIB')!, value: 'LIB' },
    { department: departments.find((d) => d.code === 'FIRE')!, value: 'FIRE' },
  ]
  for (const r of restrictions) {
    await payload.create({
      collection: 'coding-restrictions',
      data: {
        department: r.department.id as never,
        departmentLabel: r.department.name,
        rules: [{ segmentIndex: 3, operator: 'equals', value: r.value }] as never,
      },
    })
  }
}

async function seedEmailTemplates(payload: Payload) {
  const data = [
    {
      name: 'Coding Assignment',
      subject: 'Invoice {{InvoiceNumber}} ready for coding',
      bodyHtml:
        '<p>Hi {{Assignee}},</p><p>Invoice <strong>{{InvoiceNumber}}</strong> from {{Vendor}} for {{Amount}} is ready for coding.</p><p><a href="{{InvoiceURL}}">Open invoice →</a></p>',
      enabled: true,
    },
    {
      name: 'Approval Notification',
      subject: 'Invoice {{InvoiceNumber}} approved',
      bodyHtml:
        '<p>Invoice <strong>{{InvoiceNumber}}</strong> ({{Vendor}}, {{Amount}}) has been approved by {{Approver}}.</p><p><a href="{{InvoiceURL}}">Open invoice →</a></p>',
      enabled: true,
    },
    {
      name: 'Rejection Notice',
      subject: 'Invoice {{InvoiceNumber}} rejected',
      bodyHtml:
        '<p>Invoice <strong>{{InvoiceNumber}}</strong> was rejected by {{Rejecter}}.</p><p><strong>Reason:</strong> {{RejectReason}}</p><p><a href="{{InvoiceURL}}">Open invoice →</a></p>',
      enabled: true,
    },
    {
      name: 'Batch Applied — Treasurer Heads-up',
      subject: 'Batch {{BatchNumber}} ready for treasurer review',
      bodyHtml:
        '<p>Batch <strong>{{BatchNumber}}</strong> has been applied and invoices are entering treasurer review.</p>',
      enabled: true,
    },
    {
      name: 'Archive Failure',
      subject: '[Action required] Archive failed for {{InvoiceNumber}}',
      bodyHtml:
        '<p>The SharePoint archive operation failed for invoice <strong>{{InvoiceNumber}}</strong> after multiple retries. Please investigate.</p>',
      enabled: true,
    },
  ]
  return Promise.all(data.map((t) => payload.create({ collection: 'email-templates', data: t })))
}

async function seedEmailTriggers(
  payload: Payload,
  templates: { id: Id; name: string }[],
  stages: { id: Id; systemId: string }[],
  roles: { id: Id; name: string }[],
) {
  const t = (n: string) => templates.find((x) => x.name === n)!.id
  const s = (n: string) => stages.find((x) => x.systemId === n)!.id
  const r = (n: string) => roles.find((x) => x.name === n)!.id

  const data = [
    {
      name: 'Coding assignment → assignee',
      event: 'submission',
      stage: s('to_be_coded'),
      template: t('Coding Assignment'),
      recipients: [{ type: 'dynamic', dynamicKey: 'assignee' }],
      enabled: true,
    },
    {
      name: 'Approval @ AP Review → AP Clerk team',
      event: 'approval',
      stage: s('ap_review'),
      template: t('Approval Notification'),
      recipients: [{ type: 'role', role: r('AP Clerk') }],
      enabled: true,
    },
    {
      name: 'Rejection → submitter + AP supervisor',
      event: 'rejection',
      template: t('Rejection Notice'),
      recipients: [
        { type: 'dynamic', dynamicKey: 'submitter' },
        { type: 'role', role: r('AP Supervisor') },
      ],
      enabled: true,
    },
    {
      name: 'Batch applied → treasurer',
      event: 'batch_applied',
      template: t('Batch Applied — Treasurer Heads-up'),
      recipients: [{ type: 'role', role: r('Treasurer') }],
      enabled: true,
    },
    {
      name: 'Archive failed → admins',
      event: 'archive_failed',
      template: t('Archive Failure'),
      recipients: [{ type: 'role', role: r('Admin') }],
      enabled: true,
    },
  ]
  return Promise.all(data.map((d) => payload.create({ collection: 'email-triggers', data: d as never })))
}

async function seedBatches(payload: Payload, users: { id: Id; email: string }[]) {
  const marcus = users.find((u) => u.email === 'marcus.patel@aurora.ca')!.id
  const data = [
    { number: 'BATCH-2026-W19', createdBy: marcus, note: 'Weekly AP cycle' },
    { number: 'BATCH-2026-W20', createdBy: marcus, note: 'Weekly AP cycle' },
    { number: 'BATCH-2026-W21', createdBy: marcus, note: 'Weekly AP cycle — in progress' },
  ]
  return Promise.all(data.map((b) => payload.create({ collection: 'batches', data: b as never })))
}

type SeedCtx = {
  stages: { id: Id; systemId: string }[]
  vendors: { id: Id; vendorNumber: string; name: string }[]
  glAccounts: { id: Id; code: string }[]
  taxCodes: { id: Id; code: string; rate: number; recoverablePct: number }[]
  dimensions: { id: Id; kind: string; code: string }[]
  users: { id: Id; email: string }[]
  departments: { id: Id; code: string }[]
  batches: { id: Id; number: string }[]
}

type InvoiceSeed = {
  invoiceNumber: string
  vendorIdx: number
  invoiceDate: string
  dueDate: string
  poNumber?: string
  stage: StageId
  departmentCodes: string[]
  assigneeEmails: string[]
  confidential?: boolean
  flags?: Partial<{
    noAttachment: boolean
    ocrFailed: boolean
    vendorSetupRequired: boolean
    possibleDuplicate: boolean
    archiveFailed: boolean
  }>
  priority?: 'Low' | 'Normal' | 'High' | 'Urgent'
  ocrConfidence?: number
  createdVia?: 'email' | 'manual'
  batchNumber?: string
  verified?: boolean
  lines: Array<{
    glCode: string
    costCenterCode?: string
    projectCode?: string
    fundCode?: string
    amount: number
    taxCode: string
    description?: string
  }>
  comments?: Array<{ authorEmail: string; body: string }>
}

async function seedInvoices(payload: Payload, ctx: SeedCtx) {
  const today = new Date('2026-05-13')
  const iso = (offsetDays: number) => {
    const d = new Date(today)
    d.setDate(d.getDate() + offsetDays)
    return d.toISOString().slice(0, 10)
  }

  const seeds: InvoiceSeed[] = [
    // To Be Assigned (4)
    {
      invoiceNumber: 'INV-77123',
      vendorIdx: 0,
      invoiceDate: iso(-2),
      dueDate: iso(28),
      stage: 'to_be_assigned',
      departmentCodes: [],
      assigneeEmails: [],
      ocrConfidence: 0.94,
      createdVia: 'email',
      lines: [{ glCode: '01-1900-ADM-5210', amount: 246.5, taxCode: 'HST-ON-PSB' }],
    },
    {
      invoiceNumber: 'INV-77124',
      vendorIdx: 2,
      invoiceDate: iso(-1),
      dueDate: iso(29),
      stage: 'to_be_assigned',
      departmentCodes: [],
      assigneeEmails: [],
      flags: { noAttachment: true },
      createdVia: 'email',
      lines: [{ glCode: '02-2100-UTIL-5710', amount: 8420.32, taxCode: 'HST-ON-PSB' }],
    },
    {
      invoiceNumber: 'INV-77125',
      vendorIdx: 5,
      invoiceDate: iso(-3),
      dueDate: iso(27),
      stage: 'to_be_assigned',
      departmentCodes: [],
      assigneeEmails: [],
      flags: { ocrFailed: true },
      createdVia: 'email',
      lines: [{ glCode: '01-1200-IT-5120', amount: 1200, taxCode: 'HST-ON-PSB' }],
    },
    {
      invoiceNumber: 'INV-77126',
      vendorIdx: 8,
      invoiceDate: iso(-4),
      dueDate: iso(26),
      stage: 'to_be_assigned',
      departmentCodes: [],
      assigneeEmails: [],
      flags: { possibleDuplicate: true },
      createdVia: 'email',
      lines: [{ glCode: '01-1100-PW-5610', amount: 4500, taxCode: 'HST-ON-PSB' }],
    },
    // To Be Coded (3)
    {
      invoiceNumber: 'INV-77100',
      vendorIdx: 1,
      invoiceDate: iso(-5),
      poNumber: 'PO-22-141',
      dueDate: iso(25),
      stage: 'to_be_coded',
      departmentCodes: ['PW'],
      assigneeEmails: ['jordan.lee@aurora.ca'],
      priority: 'High',
      lines: [
        { glCode: '01-1100-PW-5410', costCenterCode: 'CC-PW02', amount: 3200, taxCode: 'HST-ON-PSB', description: 'Plow truck repair' },
        { glCode: '01-1100-PW-5210', costCenterCode: 'CC-PW01', amount: 1100, taxCode: 'HST-ON-PSB', description: 'Replacement parts' },
      ],
      comments: [
        { authorEmail: 'sarah.chen@aurora.ca', body: 'Assigning to PW — Jordan please code by Friday.' },
      ],
    },
    {
      invoiceNumber: 'INV-77101',
      vendorIdx: 5,
      invoiceDate: iso(-6),
      dueDate: iso(24),
      stage: 'to_be_coded',
      departmentCodes: ['IT'],
      assigneeEmails: ['priya.kumar@aurora.ca'],
      priority: 'Normal',
      lines: [
        { glCode: '01-1200-IT-5110', costCenterCode: 'CC-IT02', amount: 7200, taxCode: 'HST-ON-PSB', description: 'M365 E5 quarterly license fee' },
      ],
    },
    {
      invoiceNumber: 'INV-77102',
      vendorIdx: 10,
      invoiceDate: iso(-4),
      dueDate: iso(26),
      stage: 'to_be_coded',
      departmentCodes: ['LIB'],
      assigneeEmails: ['aisha.mohamed@aurora.ca'],
      lines: [
        { glCode: '01-1400-LIB-5410', costCenterCode: 'CC-LIB01', amount: 2840, taxCode: 'EXEMPT', description: 'New release books — May' },
      ],
    },
    // Conditional Approvals (2)
    {
      invoiceNumber: 'INV-77080',
      vendorIdx: 1,
      invoiceDate: iso(-8),
      dueDate: iso(22),
      poNumber: 'PO-22-138',
      stage: 'conditional_approvals',
      departmentCodes: ['PW'],
      assigneeEmails: ['hannah.wright@aurora.ca'],
      priority: 'High',
      lines: [
        { glCode: '01-1100-PW-5610', costCenterCode: 'CC-PW01', amount: 12500, taxCode: 'HST-ON-PSB', description: 'Hwy 404 salt storage' },
      ],
    },
    {
      invoiceNumber: 'INV-77081',
      vendorIdx: 13,
      invoiceDate: iso(-7),
      dueDate: iso(23),
      stage: 'conditional_approvals',
      departmentCodes: ['IT'],
      assigneeEmails: ['hannah.wright@aurora.ca'],
      priority: 'Normal',
      lines: [
        { glCode: '01-1200-IT-5120', costCenterCode: 'CC-IT02', amount: 6400, taxCode: 'HST-ON-PSB' },
      ],
    },
    // AP Review (3)
    {
      invoiceNumber: 'INV-77050',
      vendorIdx: 4,
      invoiceDate: iso(-10),
      dueDate: iso(20),
      stage: 'ap_review',
      departmentCodes: ['PR'],
      assigneeEmails: ['marcus.patel@aurora.ca'],
      lines: [
        { glCode: '01-1300-PR-5510', costCenterCode: 'CC-PR01', amount: 4280, taxCode: 'HST-ON-PSB' },
      ],
    },
    {
      invoiceNumber: 'INV-77051',
      vendorIdx: 11,
      invoiceDate: iso(-11),
      dueDate: iso(19),
      stage: 'ap_review',
      departmentCodes: ['FIRE'],
      assigneeEmails: ['marcus.patel@aurora.ca'],
      priority: 'High',
      lines: [
        { glCode: '01-1500-FIRE-5210', costCenterCode: 'CC-FIRE01', amount: 9800, taxCode: 'HST-ON-PSB', description: 'SCBA upgrade kit' },
      ],
    },
    {
      invoiceNumber: 'INV-77052',
      vendorIdx: 9,
      invoiceDate: iso(-12),
      dueDate: iso(18),
      stage: 'ap_review',
      confidential: true,
      departmentCodes: ['ADM'],
      assigneeEmails: ['sarah.chen@aurora.ca'],
      priority: 'Urgent',
      lines: [
        { glCode: '01-1900-ADM-5110', amount: 14500, taxCode: 'HST-ON-PSB', description: 'M&A advisory — confidential' },
      ],
      comments: [
        { authorEmail: 'sarah.chen@aurora.ca', body: '@robert.klein please prep treasurer review for this one.' },
      ],
    },
    // Ready for Processing (3)
    {
      invoiceNumber: 'INV-77000',
      vendorIdx: 6,
      invoiceDate: iso(-14),
      dueDate: iso(16),
      stage: 'ready_for_processing',
      departmentCodes: ['ADM'],
      assigneeEmails: ['lena.brooks@aurora.ca'],
      batchNumber: 'BATCH-2026-W21',
      lines: [
        { glCode: '01-1900-ADM-5210', amount: 1280, taxCode: 'HST-ON-PSB' },
      ],
    },
    {
      invoiceNumber: 'INV-77001',
      vendorIdx: 14,
      invoiceDate: iso(-15),
      dueDate: iso(15),
      stage: 'ready_for_processing',
      departmentCodes: ['ADM'],
      assigneeEmails: ['lena.brooks@aurora.ca'],
      batchNumber: 'BATCH-2026-W21',
      lines: [
        { glCode: '01-1900-ADM-5210', amount: 3450, taxCode: 'HST-ON-PSB' },
      ],
    },
    {
      invoiceNumber: 'INV-77002',
      vendorIdx: 7,
      invoiceDate: iso(-13),
      dueDate: iso(17),
      stage: 'ready_for_processing',
      departmentCodes: ['PW'],
      assigneeEmails: ['marcus.patel@aurora.ca'],
      batchNumber: 'BATCH-2026-W21',
      lines: [
        { glCode: '01-1100-PW-5410', amount: 2100, taxCode: 'HST-ON-PSB' },
      ],
    },
    // Processed (2)
    {
      invoiceNumber: 'INV-76900',
      vendorIdx: 3,
      invoiceDate: iso(-22),
      dueDate: iso(8),
      stage: 'processed',
      departmentCodes: ['PW'],
      assigneeEmails: ['marcus.patel@aurora.ca'],
      batchNumber: 'BATCH-2026-W20',
      lines: [{ glCode: '03-3100-CAPEX-5910', amount: 38500, taxCode: 'HST-ON-PSB', description: 'Two new pickup trucks' }],
    },
    {
      invoiceNumber: 'INV-76901',
      vendorIdx: 12,
      invoiceDate: iso(-21),
      dueDate: iso(9),
      stage: 'processed',
      departmentCodes: ['IT'],
      assigneeEmails: ['lena.brooks@aurora.ca'],
      batchNumber: 'BATCH-2026-W20',
      lines: [{ glCode: '01-1200-IT-5310', amount: 5600, taxCode: 'HST-ON-PSB', description: 'Workstation refresh — 8 units' }],
    },
    // Treasurer Review (3)
    {
      invoiceNumber: 'INV-76800',
      vendorIdx: 2,
      invoiceDate: iso(-30),
      dueDate: iso(0),
      stage: 'treasurer_review',
      departmentCodes: ['ADM'],
      assigneeEmails: ['robert.klein@aurora.ca'],
      batchNumber: 'BATCH-2026-W19',
      verified: true,
      lines: [{ glCode: '02-2100-UTIL-5710', amount: 6840, taxCode: 'HST-ON-PSB' }],
    },
    {
      invoiceNumber: 'INV-76801',
      vendorIdx: 5,
      invoiceDate: iso(-31),
      dueDate: iso(-1),
      stage: 'treasurer_review',
      departmentCodes: ['IT'],
      assigneeEmails: ['robert.klein@aurora.ca'],
      batchNumber: 'BATCH-2026-W19',
      lines: [{ glCode: '01-1200-IT-5110', amount: 4800, taxCode: 'HST-ON-PSB' }],
    },
    {
      invoiceNumber: 'INV-76802',
      vendorIdx: 4,
      invoiceDate: iso(-32),
      dueDate: iso(-2),
      stage: 'treasurer_review',
      departmentCodes: ['PR'],
      assigneeEmails: ['robert.klein@aurora.ca'],
      batchNumber: 'BATCH-2026-W19',
      verified: true,
      lines: [{ glCode: '01-1300-PR-5510', amount: 2150, taxCode: 'HST-ON-PSB' }],
    },
    // Completed (4)
    {
      invoiceNumber: 'INV-76700',
      vendorIdx: 1,
      invoiceDate: iso(-45),
      dueDate: iso(-15),
      stage: 'completed',
      departmentCodes: ['PW'],
      assigneeEmails: [],
      batchNumber: 'BATCH-2026-W19',
      lines: [{ glCode: '01-1100-PW-5410', amount: 4280, taxCode: 'HST-ON-PSB' }],
    },
    {
      invoiceNumber: 'INV-76701',
      vendorIdx: 0,
      invoiceDate: iso(-50),
      dueDate: iso(-20),
      stage: 'completed',
      departmentCodes: ['ADM'],
      assigneeEmails: [],
      batchNumber: 'BATCH-2026-W19',
      lines: [{ glCode: '01-1900-ADM-5210', amount: 540, taxCode: 'HST-ON-PSB' }],
    },
    {
      invoiceNumber: 'INV-76702',
      vendorIdx: 8,
      invoiceDate: iso(-48),
      dueDate: iso(-18),
      stage: 'completed',
      departmentCodes: ['LIB'],
      assigneeEmails: [],
      batchNumber: 'BATCH-2026-W19',
      lines: [{ glCode: '01-1400-LIB-5210', amount: 980, taxCode: 'EXEMPT' }],
      flags: { archiveFailed: true },
    },
    {
      invoiceNumber: 'INV-76703',
      vendorIdx: 14,
      invoiceDate: iso(-52),
      dueDate: iso(-22),
      stage: 'completed',
      departmentCodes: ['FIRE'],
      assigneeEmails: [],
      batchNumber: 'BATCH-2026-W19',
      lines: [{ glCode: '01-1500-FIRE-5310', amount: 1720, taxCode: 'HST-ON-PSB' }],
    },
  ]

  const created = []
  for (const seed of seeds) {
    const stageId = ctx.stages.find((s) => s.systemId === seed.stage)!.id
    const vendor = ctx.vendors[seed.vendorIdx]
    const lineDocs = []
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
      lineDocs.push({
        order: i + 1,
        glAccount: gl.id,
        costCenter: cc?.id,
        project: proj?.id,
        fund: fund?.id,
        amount: computed.amount,
        taxCode: tax.id,
        taxAmount: computed.taxAmount,
        recoverable: computed.recoverable,
        nonRecoverable: computed.nonRecoverable,
        description: l.description,
      })
    }
    subtotal = Math.round(subtotal * 100) / 100
    totalTax = Math.round(totalTax * 100) / 100
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

    created.push(invoice)
  }
  return created
}
