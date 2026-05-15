# Municipal Accounts Payable (AP) Invoice Application — Functional Design

**Date:** 2026-05-13
**Status:** Draft for client + developer review

---

## 1. Overview

A workflow application for processing municipal AP invoices end-to-end: from receipt at a shared mailbox, through OCR/AI extraction, coding against the client's GL with full tax handling, configurable approvals, batch export to the client's financial system, treasurer spot-check, and archive to SharePoint with retention.

Functional requirements only. Platform decisions (custom Azure web app vs. Power Platform Canvas app) are out of scope for this document. Sections that depend on platform choice are flagged where they appear.

---

## 2. Scope (in)

- Email-based invoice intake with OCR/AI extraction (currently AI Builder)
- Manual invoice entry
- Multi-stage workflow with role-based, configurable assignment
- Coding with multiple GL lines, configurable dimensions (cost center, project, fund, etc.), and per-line tax allocations
- Configurable rule-based conditional approvals
- Batch handling and CSV export to the client's financial system
- Treasurer spot-check and batch close
- SharePoint archive with retention inheritance
- Configurable settings (statuses, fields, roles, rules, tax codes, etc.)
- Configurable role-based access control (RBAC)
- Audit log
- In-app PDF/image preview throughout
- Global search across all invoices

For the explicit out-of-scope list, see Section 13.

---

## 3. Glossary

- **Invoice / Request** — a single AP invoice and its lifecycle record in the application
- **Coding / Codification** — assigning GL accounts and dimensions to an invoice
- **Coded line** — a single row in the coding table representing one GL allocation
- **Batch** — a virtual grouping of invoices that share a batch number (free-form text); used to coordinate the export → import → treasurer-review cycle. Not a separate object — implicit grouping by shared batch number.
- **ERP / Financial System** — the client's authoritative system of record for vendors, GLs, posted financial transactions
- **OCR / AI Builder** — the AI extraction service that reads invoice attachments and pre-populates header fields
- **Tax code** — a configurable identifier mapping to a statutory rate, recoverable %, and GL postings (e.g., `HST-ON-PSB`)
- **PSB rebate** — Public Service Body rebate; the federal/provincial portion of HST/GST that a municipality can claim back per CRA rules

---

## 4. Lifecycle

```
[ Email arrives ]                              [ Manual Create Invoice ]
        |                                                  |
        v                                                  v
[ OCR / AI Builder ]                              [ Manual entry ]
        |                                                  |
        +----------------------+---------------------------+
                               |
                               v
                       [ To Be Assigned ]
                               |
                               v
              [ To Be Coded / Department Review ]
                               |
                               v
                  [ Conditional Approvals ]   <-- auto-skipped if no rules match
                               |
                               v
                        [ AP Review ]
                               |
                               v
                  [ Ready for Processing ]    <-- AP applies batch number
                               |
                               v
                        [ Processed ]         <-- after external CSV import to ERP
                               |
                               v
                   [ Treasurer Review ]       <-- spot-check + Approve/Close Batch
                               |
                               v
                        [ Completed ]         <-- auto-archive to SharePoint
```

**Stages are configurable per client** — see Section 4a. Three stages are *required* (cannot be disabled) because they hold core workflow actions: **To Be Assigned** (intake landing zone), **Ready for Processing** (where batch numbers are applied), and **Completed** (terminal state + archive trigger). All other stages can be turned off; invoices will skip past them.

### 4a. Per-Stage Configuration

Each stage exposes the following configuration in **Settings → Workflow**:

| Setting | Notes |
|---|---|
| **Active** | Enable/disable the stage. Required stages cannot be disabled. Disabled stages are skipped in the lifecycle. |
| **Label** | Display name shown to users (independent of system stage id) |
| **Bulk Assign** | Whether the queue view at this stage offers a Bulk Assign action |
| **Batch Assign** | Whether the batch number picker is available. Only `Ready for Processing` supports this in v1. |
| **Verify Flag** | Whether reviewers can mark individual invoices as **Verified** at this stage (single or bulk). On `Treasurer Review` this drives the spot-check workflow; can be enabled at other stages too if a client wants additional checkpoints. |
| **Reject** | Whether the Reject action is available at this stage |
| **Reassign** | Whether the Reassign action is available at this stage |
| **Fields Editable By** | List of roles allowed to edit invoice fields while in this stage. Per-stage, per-role (no per-field granularity in v1). |

**Auto-skip-if-no-rules-match** is a behavior of `Conditional Approvals` only and is not exposed as a per-stage configuration.

---

## 5. User Roles & Permissions

Roles are not hardcoded. The application provides a fully configurable RBAC system in Settings → Roles & Permissions.

- A **role** is a collection of permissions
- A **permission** is the tuple **(action × object × scope)**:
  - **Action:** view, edit, assign, code, approve, reject, reassign, post, archive, export, delete, configure
  - **Object:** invoice, document, batch, settings, audit log, role
  - **Scope:** own / department / all
- Permissions can additionally be **stage-scoped** (e.g., "edit allowed only while invoice is in `Department Review`")
- Each role also carries two role-level flags (separate from the action × object × scope matrix):
  - **Confidential** — grants access to confidential invoices (see Section 5b)
  - **Bypass Coding Restrictions** — grants the ability to code lines to any GL (or any restricted lookup) regardless of department coding rules (see Section 7.5)

Suggested defaults for a typical municipality (clients can rename / reshape):

| Role | Notes | Confidential | Bypass Coding |
|---|---|---|---|
| **Admin** | Full access; the only role permitted to delete records and edit settings | ✓ | ✓ |
| **AP Clerk** | View + edit + approve all invoices across all stages (excluding settings) | — | ✓ |
| **AP Supervisor** | Same as AP Clerk plus oversight | ✓ | ✓ |
| **Department Reviewer** | View + edit + approve invoices assigned to their department, only while in `Department Review` | — | — |
| **Conditional Approver** | View + approve / reject invoices routed to them by rules | — | — |
| **Treasurer** | View + verify + approve / reject across all stages | ✓ | ✓ |

---

## 5a. Field Management & Header Sections

The application's data model is field-driven. Every value captured on an invoice — every header field, every coded-line dimension, every custom addition — is defined in **Settings → Fields** and shapes the New Request form, the invoice Header tab, the coding table, the All Requests columns, and the CSV export.

### Field properties

Every field carries:

| Property | Notes |
|---|---|
| **Label** | Display name shown across the app |
| **Scope** | `Header` (one value per invoice) or `Coding Line` (one value per coded line) |
| **Section** | Header fields only — assigns the field to a named header section (see below) |
| **Type** | See list of supported types below |
| **Width** | Header fields only — `Full` / `1/2` / `1/3` / `1/4`, controls the field's column span on the New Request screen and the invoice Header tab |
| **Options** | Required for `Choice` and `Multi-select` types — admin maintains a list of selectable values. For `Lookup` types the values come from the synced ERP entity (read-only here). Not applicable to other types. |
| **Mandatory at stage(s)** | Per-stage list. Field is required to advance past any listed stage. Required-at-one carries forward: once a field is satisfied, it cannot become unfilled later. |
| **Show as column on All Requests** | Per-field opt-in |
| **Available for CSV export** | Per-field opt-in. Once enabled, the field becomes selectable from the Export Format field list (Section 6.7). |
| **Removable** | System fields: no. Custom fields: yes. |

### System vs. custom fields

- **System fields** are seeded with the install and are load-bearing for core workflow logic (duplicate detection, ERP matching, tax math). Examples: Invoice Number, Vendor, Invoice Date, Due Date, Subtotal, Total Tax, Grand Total, Fiscal Year, PO Number; on the line side: GL Account, Tax Code.
- System fields can be **relabeled, restyled, repositioned, and made mandatory at chosen stages** — but they cannot be removed.
- **Custom fields** can be added, edited, and removed freely by an admin.
- **Shipped-default custom fields** are custom fields installed by default that admins may keep, edit, or remove. The most important is the **Confidential** field (Yes/No, Header scope) — it pairs with the Confidential role permission to drive row-level access control. See Section 5b.

### Field types

- **Single Line Text**
- **Multiple Lines of Text** (textarea)
- **Rich Text** (WYSIWYG)
- **Number**
- **Currency**
- **Date**
- **Choice (dropdown)** — single-select from an option list maintained on the field itself (Options property)
- **Multi-select** — multi-select from an option list maintained on the field itself (Options property)
- **Yes / No** (boolean)
- **Lookup** — values pulled from synced ERP reference data: Vendors, GL Accounts, Cost Centers, Projects, Funds, Tax Codes
- **User Picker** — single user from the directory
- **Group Picker** — single group from RBAC
- **File Attachment** — file upload bound to a single field (separate from the request's main Documents collection)

### Header Sections

Header fields are grouped into named **Sections** displayed as labeled card-style groups on the New Request screen and the invoice Header tab.

- Each section has a name and an order
- Default sections shipped: `Details`, `Amounts`, `Workflow`, `Custom`
- Admins may rename, reorder, add, or remove sections in Settings → Fields → Sections
- When a section is removed, its fields are automatically reassigned to the first remaining section
- **Coding-line fields do not use sections** — they live in the coding table

### How fields propagate across the app

| Surface | Driven by |
|---|---|
| New Request screen | All Header fields, grouped by Section, in section order, laid out by Width |
| Invoice screen — Header tab | Same as New Request |
| Coding table (Section 7.1) | All Coding Line fields marked visible |
| All Requests columns (Section 8.8) | All fields with "Show as column on All Requests" enabled |
| CSV Export field list (Section 6.7) | All fields with "Available for CSV export" enabled |
| Approval rule conditions (Section 6.5) | Any field — Header or Line |

---

## 5b. Confidential Invoices

Some invoices need restricted visibility (HR-related vendor payments, legal matters, M&A advisory, settlements, etc.). The application supports this through two coupled concepts:

1. **The Confidential field** — a Yes/No header field shipped as a default custom field (Settings → Fields). It's editable and deletable like any custom field; clients who don't need confidentiality can remove it. AP staff toggle it at intake or anytime thereafter.
2. **The Confidential role permission** — a per-role flag in Settings → Roles & Permissions, independent of the action/object/scope matrix.

**Filtering behavior:** when an invoice has `Confidential = Yes`, it is **hidden** from any user whose role does not have the Confidential flag set. Hidden specifically means:

- It does not appear in queues, the All Requests screen, search results, or exports
- A direct URL to the invoice returns a not-found response (no leaking via existence)
- Notifications and email triggers do not deliver to recipients without Confidential access (the recipient slot is silently skipped)
- Audit log entries on a confidential invoice are visible only to users who can see the invoice itself

Users with the Confidential role flag see confidential invoices everywhere, blended with non-confidential ones (no separate "Confidential" view). A small lock indicator on the invoice row/header marks them as confidential for those who can see them.

---

## 6. Detailed Stage Requirements

### 6.1 Intake — Email

- Invoices arrive as attachments to a shared AP mailbox (e.g., `ap@city.com`)
- Each email creates one invoice request
- **Multi-attachment emails:** all attachments are captured against the single request in the Documents section; the email body itself is not retained
- **OCR / AI Builder** runs on each attachment and pre-populates header fields
  - The **list of fields the OCR attempts to extract is configurable per client** (Settings → OCR Fields), so different clients can capture different metadata without code changes
  - Typical default field set: invoice number, vendor, invoice date, due date, fiscal year, subtotal, total taxes, total amount
- **Vendor matching:** OCR's best-guess vendor is auto-populated from the synced vendor list. If AI Builder returns a confidence score below the configured threshold, the request is also auto-flagged for AP attention.
- **Edge cases:**
  - **No attachment** → request created and held in `To Be Assigned` with a "No Attachment" flag
  - **OCR failure** (corrupt PDF, image too poor) → request still created in `To Be Assigned` with an "OCR Failed" flag; no fields pre-populated; AP enters data manually
- **No auto-acknowledgement reply** is sent to the vendor

### 6.2 Intake — Manual Create Invoice

- A "Create Invoice" screen is available to authorized users
- All header fields are entered manually; **no OCR runs against manually attached files**
- Same lifecycle and validation rules apply from `To Be Assigned` onward

### 6.3 To Be Assigned

- Initial status for every newly created invoice (email or manual)
- A **queue / inbox view** monitored by AP staff
- AP can:
  - View invoices, edit OCR'd header fields if incorrect
  - Manually flag a request as **"Vendor Setup Required"** (blocks advancement)
  - **Assign** single or in bulk to one or more users and/or departments (assignment target type configurable per client)
- **Duplicate detection:**
  - Default match rule: invoice number + vendor + amount
  - Match rule is configurable per client
  - Action on match is configurable per client:
    - **Warn** — the request is created normally; AP sees a non-blocking warning banner when they open it indicating a possible duplicate; they can dismiss and proceed
    - **Flag** — the request is created with a persistent "Possible Duplicate" flag visible in queues and on the record itself; does not block any action, but is more prominent than a one-time warning and persists until cleared
    - **Block** — the request is **not created**; the inbound email is diverted to a "Blocked Duplicates" view for admin review, so nothing is silently lost
- **Vendor Setup Required behavior:**
  - When set, the request cannot advance until either:
    - An existing vendor is selected from the synced list, or
    - The vendor is added in the ERP, synced over, and selected on the request

### 6.4 To Be Coded / Department Review

- Status transition: `To Be Assigned` → `To Be Coded` (label configurable)
- **Notification:** assigned recipients receive notification that an invoice is ready for coding (in-app + initial email)
- **Multi-recipient behavior:** all assigned recipients must **approve** the invoice; only one needs to fully complete the coding table
  - Example: of two assignees, one fully codes the invoice and the second reviews and marks approved
- **Coding table:** see Section 7
- Reviewers can edit any OCR'd header field if incorrect
- **Reject:** any reviewer can reject back to a chosen prior stage with reason (see Section 8.4)
- **Reassign:** any user assigned to a request, and any admin, can reassign it to another user/department

### 6.5 Conditional Approvals (Rules-based Routing)

- Sits between `To Be Coded` and `AP Review`
- The system evaluates configured rules against the invoice on entry
- **If no rules match → auto-skip directly to `AP Review`** (no empty queue)
- **If one or more rules match,** all matching approvers are routed in (rules are additive, deduplicated)
- Each rule, configured in Settings → Approval Rules, has:
  - **Conditions:** amount thresholds, departments involved, vendor, GL, cost center, fund, project, etc., combinable with AND/OR
  - **Actions:** route to one or more named users, or role-based ("department head of [dept]")
- **Multiple required approvers per rule:** configurable per rule, default **parallel** (both notified at once, either order, both must approve)
- Each routed approver can **approve**, **reject** (back to a chosen prior stage), or **reassign**

### 6.6 AP Review

- Final finance review gate before processing
- AP can:
  - **Edit any field** (header and coding)
  - **Reject** back to one or more **specific upstream reviewers** (granular targeting — e.g., return to one bad coder without disturbing the good one) with reason
  - **Approve** to advance to `Ready for Processing`

### 6.7 Ready for Processing

- AP **assigns a batch number** (free-form text) to one or more invoices, single or bulk
- Batch number typically aligned with the client's ERP batch ID — they choose the scheme
- **Uniqueness:** the system **warns** when a batch number is being reused and requires AP confirmation to proceed
- AP runs an **Export** action from the All Requests screen against any active filter (status, batch #, date range, vendor, department, etc.) — exports a CSV
- CSV field list is configured per client (Settings → Export Format)
- Export is read-only; **no status change is triggered by exporting**, so re-export is safe (the export action itself is captured in the audit log per Section 8.2)
- AP imports the CSV externally into the financial system
- On batch number assignment, the invoice's status moves to `Processed`

### 6.8 Processed

- Represents "in the system" — the invoice has been imported into the ERP
- AP reviews each invoice in this stage and **approves** (single or bulk) once the import is confirmed successful
- Approval here is a final check-in confirming readiness for treasurer
- On approval, status moves to `Treasurer Review`

### 6.9 Treasurer Review

- Treasurer (or configured equivalent role) reviews **batches** of posted invoices
- Treasurer can open any invoice in split view, review document and metadata, and mark individual invoices as **Verified** as they spot-check (single or **bulk** via the checkbox column + Bulk Verify action)
- Verification is a tracking marker per invoice; not all invoices in a batch need to be verified — it's a spot-check, not full re-review
- Verification can be cleared per invoice with **Unverify**
- The Verify Flag is a per-stage configurable behavior (see Section 4a) — defaults to enabled on `Treasurer Review`; can be enabled at other stages if a client wants additional checkpoints
- Treasurer can **reject** an invoice with reason; rejecter chooses the destination stage (default: `AP Review`)
- On reject:
  - The rejected invoice's batch number is **wiped**
  - Other invoices in the same batch are unaffected
  - **AP is notified** in-app (so they can correct the batch on the ERP side)
  - All actions audited
- Treasurer takes an explicit **Approve / Close Batch** action when spot-check is complete
- On batch close, all remaining invoices in the batch move to `Completed`

### 6.10 Completed (Terminal)

- Terminal lifecycle state
- **Auto-archive to SharePoint** triggers on entering `Completed`:
  - System creates a **Document Set** in the configured SharePoint library containing all documents associated with the invoice
  - Document Set name follows a configurable token-based pattern (e.g., `{Vendor}_{InvoiceNumber}_{InvoiceDate}`)
  - Document Set inherits any **retention label** applied to the library
- **Failure handling:** archive runs in the background with **retry + exponential backoff** (1 min, 5 min, 30 min, 1 hr, 6 hr)
- After **5 failed attempts**, the invoice is flagged "Archive Failed" and an admin is notified for manual retry

---

## 7. Coding Table & Tax Handling

### 7.1 Coding Table Structure

A single invoice may be split across **multiple coded lines**. The shipped default columns are:

| Field | Source | Editable |
|---|---|---|
| GL Account *(system)* | Synced from ERP | Yes |
| Cost Center, Project, Fund, Job Code (typical custom dimensions) | Synced from ERP; admin chooses which to expose | Yes |
| Amount (subtotal portion of the line) | User entry | Yes |
| Tax Code *(system)* | From configured tax codes | Yes |
| Tax $ | Computed | No |
| Recoverable $ | Computed | No |
| Non-Recoverable $ | Computed | No |

- Visible columns are **driven by Section 5a** — every field with `Scope = Coding Line` appears as a column; admins manage which fields exist and their labels in Settings → Fields
- **Locally-defined columns** (not from ERP) are supported alongside ERP-sourced fields; whether they appear in the CSV export is determined entirely by the configured export field list (Settings → Export Format), not by where the field originates
- Computed columns visibility (Tax $, Recoverable, Non-Recoverable) is configurable: full visibility, "Tax $ only" (default), or all hidden (still computed under the hood for posting)

### 7.2 Tax Calculation

For each coded line, given `rate` and `recoverable_pct` from the tax code configuration and `amount` from the line:

```
tax            = amount × rate
recoverable    = tax × recoverable_pct
non_recoverable = tax − recoverable
```

Posting behavior reflected in the CSV export:

- The **expense GL** (the line's GL) receives `amount + non_recoverable`
- The **recoverable GL** (mapped on the tax code) receives `recoverable`
- The **AP control GL** receives the grand total payable to the vendor

#### Worked example

Invoice: $1,000 subtotal, $130 HST, $1,130 total. Tax code `HST-ON-PSB` configured with rate 13%, recoverable 78% (illustrative). Coder splits 60/40 across two GLs:

| # | GL | Cost Center | Amount | Tax Code | Tax $ | Recoverable $ | Non-Recoverable $ |
|---|---|---|---|---|---|---|---|
| 1 | 1500 — IT Equipment | Admin | 600.00 | HST-ON-PSB | 78.00 | 60.84 | 17.16 |
| 2 | 1500 — IT Equipment | Library | 400.00 | HST-ON-PSB | 52.00 | 40.56 | 11.44 |
| **Σ** | | | **1,000.00** | | **130.00** | **101.40** | **28.60** |

Posting:
- GL 1500/Admin: $617.16 ($600 + $17.16 non-recoverable)
- GL 1500/Library: $411.44 ($400 + $11.44 non-recoverable)
- Recoverable GL (per tax code): $101.40
- AP Control GL: $1,130.00

### 7.3 Tax Code Configuration

Each tax code in Settings → Tax Codes carries:
- Code identifier (e.g., `HST-ON-PSB`)
- Display label
- Rate %
- Recoverable %
- GL mappings (recoverable GL, AP control GL)

**Sourcing:**
- **Tax codes themselves:** synced from the ERP if it exposes them via API; otherwise maintained locally in Settings
- **Rates and recoverable %s:** maintained locally in Settings (most ERPs don't expose recoverable %s; clients tune these per code based on policy and CRA PSB rebate rules)
- **Calculation logic:** fixed in code; only the inputs (rate, recoverable %, GL mappings) are configurable

**Onboarding process:** the client's finance lead supplies rate, recoverable %, and GL mappings for each tax code in a one-time setup workshop. Codes can be added/edited later by an admin.

### 7.4 Validation

System enforces on submission:

- **Sum-match check** — the sum of coded-line `Amount` values must reconcile to a chosen header field. Configured in Settings → Coding Table:
  - **Match against:** `Subtotal` (default — most muni AP, lines pre-tax) / `Grand Total` (lines coded tax-inclusive) / `Disabled` (no check)
  - **On mismatch:** `Block` (default — must reconcile before Approve) / `Warn` (banner shown; advance allowed)
- **Tax reconciliation** — Σ computed tax must equal the invoice header tax; variance flagged on mismatch (configurable: warn / block, same model)
- Σ line totals (with tax) = invoice grand total

### 7.5 Coding Restrictions (Department-to-GL Access)

Many municipalities want **departments restricted to coding only against their own GLs**. The application supports this through a segment-based rules engine in **Settings → Coding Restrictions**.

#### GL segment format

GL account strings are split into named segments. Configured globally:
- **Delimiter** — `-` (default), `.`, `_`, `/`, or fixed-width
- **Number of segments** — typically 4 in muni charts of accounts (e.g., `1111-2222-3333-4444`)
- **Segment labels** (optional, for clarity in the rule editor) — e.g., `Fund - Function - Department - Object`

#### Department coding rules

For each department, an admin defines one or more rules of the form:

> Segment **N** matches **`<value>`**

Where the match operator is one of:
- **Equals** — segment exactly matches the value (e.g., `Segment 3 = 3300` → Fire)
- **Starts with** — segment begins with the value (e.g., `Segment 4 starts with 15` → IT object codes)
- **In list** — segment matches any value in a list (e.g., `Segment 3 ∈ {2200, 2210}` → Public Works)

Multiple rules per department combine with **OR**. A coder may select a GL only if at least one of their department's rules matches that GL.

#### Behavior in the coding screen

- The GL dropdown for a coder is **filtered live** to only matching values
- On submit, validation re-checks each coded line's GL against the coder's department rules
- Coders without a matching rule see no GLs to pick from for that line and are blocked from submitting
- Roles with the **Bypass Coding Restrictions** permission (see Section 5) ignore these rules entirely

#### Cross-department invoices

When an invoice spans multiple departments, multiple coders are typically assigned (one per department, the existing multi-recipient pattern from Section 6.4). Two policies for what each coder may enter, configurable in Settings → Coding Restrictions:

- **Strict:** each coder may only enter lines for their own department; AP redistributes lines from other departments
- **Permissive (default):** each coder may enter lines for any department they belong to; AP/admin (bypass roles) may code any line

#### Scope (v1)

Coding restrictions apply to the **GL Account** field only in v1. Extending the same segment-based rule pattern to other coding-line lookups (Cost Center, Project, Fund) is on the roadmap.

---

## 8. Cross-Cutting Requirements

### 8.1 Document Management & PDF Viewer

- All attachments live in a **Documents collection** on the invoice request
- **Allowed file types:** PDF, Word (.doc/.docx), images (JPG/PNG/TIFF)
- **Per-file size limit:** 50 MB (sensible cap that works on both Power Platform and an Azure/SQL build)
- **Per-request attachment count:** capped at 10 attachments
- **Delete:** admins only; **soft delete** (record retained in storage, hidden from default views, recoverable, fully audited)
- **Inline PDF / image viewer** is required across the Invoice screen, the Coding screen, and the All Requests inline-expansion preview (see Section 8.8a)

#### Invoice screen layout

- **Two-column** layout: invoice preview on the left, **right-pane tabs** on the right
- Right-pane tabs (single row): `Header` (default) · `Coding` · `Files` · `Notes` · `Log`
- The Coding tab shows the invoice's coded lines inline using the same coding table component as the dedicated Coding screen — there is no separate "Open Coding" navigation button on the Invoice screen
- The **invoice preview pane is collapsible** — a toggle in the pane header collapses it to a thin (~44px) vertical strip showing only the doc name, freeing the right pane to take the full width. Click the strip or toggle again to expand.
- The 8-step workflow stepper sits above the split, full-width

#### Coding screen layout

- Same two-column pattern with a wider right pane (1fr / 1.4fr)
- Same right-pane tab set, with **Coding as the default** for this screen: `Coding` (default) · `Header` · `Files` · `Notes` · `Log`
- Same collapsible invoice preview behavior

The Invoice and Coding screens share the same right-pane tab set; they differ only in column proportion and which tab is default. The Coding screen remains a dedicated route for users who want to land directly in the coding view (e.g., from the To Be Coded queue).

#### Files tab — multi-document handling

- Lists every attachment on the request with name, size, and uploader
- **Clicking a document swaps the left-pane preview** to that document, updating the preview header label
- Upload control allows admins/clerks to add new attachments (subject to file-type and size limits above)

#### Per-invoice activity (Files / Notes / Log)

- The **Log** tab is the per-invoice audit log — see Section 8.2 for what events are captured
- The **Notes** tab is the per-invoice comment thread — see Section 8.5
- The **Files** tab is the per-invoice document list, as above

There is no global Audit Log screen; audit history is always viewed in context on the invoice's Log tab.

### 8.2 Audit Log

- Captures **action-based** events only — not field-level edits
- Tracked actions include (non-exhaustive):
  - Approve, Reject (with reason + target stage), Reassign
  - Upload document, Delete document
  - Batch number applied, Batch number wiped
  - Export, Archive (with success/failure + retry attempts)
  - Treasurer Verify, Close Batch
- Each entry stores: actor, timestamp, action, and relevant context (e.g., from-stage → to-stage, target user, batch #)
- **Retention:** **configurable per client** (default proposed: 7 years to align with municipal records-retention bylaws)

### 8.3 Notifications & Email

#### In-app notifications

- `@mentions` in comments and assignment events trigger **in-app notifications**
- Notifications surface in a parent **workflow engine / shell application** (the parent app is out of scope for this document; the AP app emits the notification events)
- **No per-user notification preferences** in v1; notifications are workflow-critical and always sent

#### Email — overview

The application includes a full email subsystem with three configurable surfaces, accessible under the **Email** sidebar item:

- **Templates** — a library of named, reusable HTML templates with token interpolation
- **Triggers** — mappings of `(Event × Stage) → Template + Recipients + CC` that decide when emails fire and to whom
- **Settings** — app-wide sender, header, footer, and delivery configuration

#### Templates

- Each template carries: **Name**, **Subject**, **Body (HTML, WYSIWYG)**
- Tokens supported (interpolated at send time):
  - `{{InvoiceNumber}}`, `{{Vendor}}`, `{{InvoiceDate}}`, `{{DueDate}}`, `{{Amount}}`
  - `{{Status}}`, `{{Stage}}`, `{{BatchNumber}}`
  - `{{Assignee}}`, `{{Approver}}`, `{{Rejecter}}`, `{{RejectReason}}`
  - `{{InvoiceURL}}` (deep link back into the app)
  - `{{Department}}`, `{{Municipality}}`, `{{AppName}}`
- Token chips inserted via one click while subject or body is focused
- Body is automatically wrapped by the global header and footer (see Settings)
- "Send test" allows admin to send the rendered template to themselves

#### Triggers

- Each trigger maps a system **Event** firing at a specific **Stage** (or "any stage") to a single **Template** plus a list of recipients
- **Events** supported in v1: `Submission`, `Approval`, `Rejection`, `Reassignment`, `Conditional Routing`, `Treasurer Routing`, `Batch Applied`, `Archive Failed`
- **Per-stage triggers:** the same event can fire different templates depending on which stage it happens at (e.g., `Approval @ To Be Coded` uses one template, `Approval @ AP Review` uses another)
- Triggers can be **enabled or disabled** without deleting them

#### Recipients

Each trigger has a primary **Recipients** list and an optional **CC** list. Each entry in either list can be one of four types, picked from a four-tab picker:

| Type | Resolved at send time? | Example |
|---|---|---|
| **Dynamic role** | Yes | "the Assignee", "the Approver", "the Rejecter", "the AP Supervisor for the dept" |
| **Group** | No | "All AP Clerks", "All Treasurers", "Admins" (defined in RBAC, see Section 5) |
| **Person** | No | A single named user from the directory |
| **Email** | No | A literal email address (e.g., `finance-supervisor@aurora.ca`) |

If a Dynamic role resolves to nobody at send time, that recipient slot is silently skipped — other recipients on the trigger are unaffected.

#### Settings (app-wide)

- **From email address** — single sender for all outgoing email (no per-template override)
- **From display name** — e.g., "City of Aurora — Accounts Payable"
- **Reply-To address** — typically the AP team mailbox
- **Global Header (HTML)** — wraps the top of every email; common use: logo, banner, branding
- **Global Footer (HTML)** — wraps the bottom of every email; common use: contact info, automated-message disclaimer
- **SMTP relay** — Microsoft 365 / SendGrid / Amazon SES / Custom
- **Daily send cap** and **retry attempts on send failure**
- **Bounce notification address**

#### Out of scope (email, v1)

- Per-user notification preferences (suppressing or routing personal email)
- Per-template sender override
- Inbound email parsing beyond the existing AP mailbox intake (see Section 6.1)

### 8.4 Reject & Reassign (consistent pattern across stages)

**Reject:**
- Reason is required
- Rejecter chooses the destination stage from any prior stage
- At multi-recipient stages, the rejecter can target **specific recipients** at the destination stage (not just the stage as a whole) — e.g., reject back to one specific coder while leaving the other coder's work intact
- All rejections audited

**Reassign:**
- Available to admins, and to any user currently assigned to the request
- Single button used by everyone (no separate "delegate" concept)
- All reassignments audited

### 8.5 Comments

- Per-invoice comment thread; each entry is date/time-stamped with author
- Users can `@mention` other users (triggers in-app notification)

### 8.6 Bulk Actions

Supported on the All Requests screen: **assign, batch # apply, approve, reassign, export.** Treasurer Review additionally supports **Bulk Verify** (with per-row Verify / Unverify) on the batch table — see Section 6.9.

### 8.7 Global Search

From the All Requests screen, searchable across:
- Invoice number
- Vendor
- Batch number
- Date range
- Amount
- Free text in comments and notes

### 8.8 All Requests Screen

- Master list view of every invoice
- **Stage pill bar** at the top — one pill per stage (`All`, `To Be Assigned`, `To Be Coded`, `Conditional Approvals`, `AP Review`, `Ready for Processing`, `Processed`, `Treasurer Review`, `Completed`), each with a live count. Clicking a pill scopes the table to that stage.
- The same stage pill bar is also rendered at the top of every individual queue screen so users can move between stages without going back to the sidebar
- **Configurable columns** driven by Section 5a (any field with "Show as column on All Requests" enabled appears as a column); per-user show/hide; no saved views in v1
- Filterable by vendor, department, date range, batch, etc.
- Drives both the global search and the export action

### 8.8a All Requests — inline row expansion

- Each row has an **expand chevron**; clicking it reveals an inline two-pane card directly under the row showing:
  - **Invoice preview** (left) — the same PDF/image preview component used on the dedicated Invoice screen
  - **Codification table** (right) — the existing coded lines, editable inline if the user has edit permission at the current stage
- Each row also has an **Open ↗** action that navigates to the dedicated Invoice screen (Section 8.1) for the full split-view, activity card, and full-feature editing
- Inline expansion is intentionally lightweight — designed for AP staff scanning the queue; the full Invoice screen remains the home for deep work

---

## 9. ERP Integration

The application syncs the following from the client's ERP (cloud or on-premise):

- **Vendors**
- **GL accounts** (with descriptions)
- **Coding dimensions** (cost centers, projects, funds, job codes, etc.)
- **Tax codes** (only if exposed by the ERP; otherwise maintained locally)

**Sync frequency:**

- **Cloud ERP:** real-time
- **On-prem ERP:** scheduled nightly

**Source-of-truth principle:** the ERP is authoritative for vendor and GL master data. New vendors must be added in the ERP first, then synced; the AP app does not create vendors locally.

**Outbound:** CSV export only in v1. No live API push, no webhook firehose.

---

## 10. Authentication

- Users authenticate via **Entra ID Single Sign-On** (Microsoft 365 identity)
- Role assignment is managed inside the application (configurable RBAC, see Section 5)

---

## 11. Configuration / Settings

A dedicated Settings area exposes everything tunable without code changes:

- **Workflow (per-stage configuration matrix):** active toggle (with required-stage locks), label, Bulk Assign, Batch Assign, Verify Flag, Reject, Reassign, Fields Editable By role (see Section 4a)
- **Fields:** every header and coding-line field — label, scope, section assignment (Header only), type, width, mandatory-by-stage, All Requests column toggle, Export toggle (see Section 5a)
- **Header Sections:** named, ordered groups for header fields (Section 5a)
- **Assignment:** target type (user / department / both)
- **Duplicate detection:** match rule, on-match action (warn / flag / block)
- **Coding table:** computed-column visibility; sum-match validation (match field + on-mismatch behavior, see Section 7.4); visible coding-line fields are driven by Settings → Fields
- **Coding restrictions:** GL segment format, per-department segment-based GL access rules, cross-department invoice handling (strict / permissive). v1 covers GL Account only. (See Section 7.5)
- **Tax codes:** code, label, rate %, recoverable %, GL mappings
- **Approval rules:** conditions and actions for the conditional approvals stage
- **Roles & permissions:** role definitions, action × object × scope, stage scoping
- **Export format:** CSV field list (drawn from Fields with "Available for CSV export" enabled)
- **Archive:** SharePoint library, Document Set name pattern
- **Audit log retention:** retention period
- **OCR:** list of fields the OCR attempts to extract; vendor confidence threshold for auto-flagging
- **ERP integration:** sync mode (real-time / nightly), connection settings

The **Email** subsystem has its own top-level area (separate from Settings):

- **Email → Templates:** library of named HTML templates with token interpolation
- **Email → Triggers:** event × stage → template + recipient list + CC
- **Email → Settings:** sender (From / display name / Reply-To), global HTML header & footer, SMTP relay, send cap, retry, bounce address

See Section 8.3 for full detail.

---

## 12. Admin Operations

- **Soft-delete invoice:** admin only; reason required; record retained, hidden from default views, fully audited (e.g., for spam, mistaken creations, missed duplicates)
- **Manual archive retry:** admin can re-trigger SharePoint archive on flagged "Archive Failed" invoices
- **Reassign on behalf of users:** admin can reassign anyone's work
- **Manage settings:** admin-only, see Section 11

---

## 13. Out of Scope (v1)

The following are explicitly not included in this build:

- PO matching (2-way / 3-way)
- Recurring / scheduled invoices
- Credit notes / negative invoices
- Reporting and dashboards beyond queue counts
- Mobile / responsive optimization
- Vendor self-service portal (status checking by vendors)
- Multi-currency / FX handling
- Historical / legacy invoice migration
- Live API push to the ERP (CSV export only in v1)
- Webhook integrations to third parties (beyond parent workflow engine notification events)
- Payment status tracking (lifecycle ends at posting; payment lives in the ERP)
- Per-user notification preferences
- Approver out-of-office auto-routing (manual reassign covers this)
- Aging / overdue indicators (will be revisited with reporting & metrics)
- Saved views on the All Requests screen
- Auto-acknowledgement email reply to invoicing vendors
- Per-template sender override (single app-wide sender only)
- Inbound email parsing beyond the existing AP mailbox intake
- Regex-based coding restriction patterns (segment-based only in v1; regex flagged for future power-user need)
- Coding restrictions on Cost Center / Project / Fund (v1 covers GL Account only)

---

## 14. Open Items

- **Platform decision** (custom Azure web app vs. Power Platform Canvas app) — deferred; affects attachment handling specifics, Power BI eligibility for future reporting, and identity model implementation details
- **Defaults to confirm with client during onboarding:**
  - Audit log retention (proposed default: 7 years)
  - SharePoint archive retry attempts (proposed: 5)
  - Attachment size cap (proposed: 50 MB)
  - Attachment count cap (proposed: 10)
  - OCR vendor confidence threshold (proposed: TBD with AI Builder telemetry once piloted)
- **Tax-code source per client:** confirm at onboarding whether ERP exposes tax codes (sync) or they're maintained locally
