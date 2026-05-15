import type { CollectionConfig } from 'payload'
import { Users } from './Users'
import { Departments } from './Departments'
import { Roles } from './Roles'
import { Vendors } from './Vendors'
import { GLAccounts } from './GLAccounts'
import { Dimensions } from './Dimensions'
import { TaxCodes } from './TaxCodes'
import { Stages } from './Stages'
import { Sections } from './Sections'
import { Fields } from './Fields'
import { Documents } from './Documents'
import { Batches } from './Batches'
import { Invoices } from './Invoices'
import { InvoiceLines } from './InvoiceLines'
import { InvoiceComments } from './InvoiceComments'
import { AuditEvents } from './AuditEvents'
import { ApprovalRules } from './ApprovalRules'
import { CodingRestrictions } from './CodingRestrictions'
import { EmailTemplates } from './EmailTemplates'
import { EmailTriggers } from './EmailTriggers'

export const collections: CollectionConfig[] = [
  Users,
  Departments,
  Roles,
  Vendors,
  GLAccounts,
  Dimensions,
  TaxCodes,
  Stages,
  Sections,
  Fields,
  Documents,
  Batches,
  Invoices,
  InvoiceLines,
  InvoiceComments,
  AuditEvents,
  ApprovalRules,
  CodingRestrictions,
  EmailTemplates,
  EmailTriggers,
]
