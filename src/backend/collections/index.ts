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
import { EmailSettings } from './EmailSettings'
import { CodingRules } from './CodingRules'
import { SavedViews } from './SavedViews'
import { ActionReasons } from './ActionReasons'
import { GlFormat } from './GlFormat'
import { DepartmentSegmentMap } from './DepartmentSegmentMap'
import { IntakeSettings } from './IntakeSettings'
import { OcrFieldMap } from './OcrFieldMap'
import { DuplicateRules } from './DuplicateRules'
import { IntakeQuarantine } from './IntakeQuarantine'
import { EmailSuppression } from './EmailSuppression'
import { IntakeEvents } from './IntakeEvents'

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
  // Settings that are stored as a single row each, because this project has no
  // Payload globals and adding the concept for one field at a time would be a
  // larger change than the settings themselves.
  EmailSettings,
  CodingRules,
  GlFormat,
  IntakeSettings,
  DuplicateRules,
  // Per-row configuration and operational records.
  ActionReasons,
  SavedViews,
  DepartmentSegmentMap,
  OcrFieldMap,
  EmailSuppression,
  IntakeQuarantine,
  IntakeEvents,
]
