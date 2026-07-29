# AP Invoice (base app) — Implementation Items for Dmitriy

Feedback from testing the base AP Invoice app. Not client-specific; these are changes to the base build that every client deployment inherits.

Status: open, items added as testing proceeds. Last updated 2026-07-28.

## Items

### 1. Email intake with OCR into To Be Assigned

A user forwards an invoice to a monitored AP mailbox. The attachment is run through OCR and a new invoice record is created in the To Be Assigned queue with header fields pre-populated from the extraction. Settings gets an OCR section where an admin controls which fields are extracted and where each extracted value lands in the app's field schema.

This is already assumed by the spec, not a new concept. `AP Invoice.md` defines To Be Assigned as "invoice received via email and OCR-extracted", and the Cancel rules say a cancelled invoice is re-introduced by forwarding the original email to the AP inbox again. The piece below is the part that was never specified.

**Platform:** Azure web app.

#### Mailbox and intake

- One shared mailbox per client, living in the client's own M365 tenant. The address is a setting, not a hardcoded value.
- Read via Microsoft Graph using a change subscription, not polling. Target is under 2 minutes from send to the invoice appearing in the queue.
- **Sender policy is a setting** with two options: internal domain only, or public. Public means the mailbox accepts invoices from any sender on the internet, and the Settings screen states that in plain language at the point of selection rather than leaving it implicit. Clients understand the tradeoff and it is their call.
- Messages rejected by the sender policy go to a quarantine list an admin can review and release. Nothing that arrives in the mailbox is ever silently discarded.

#### Attachment handling

- **One invoice record per attachment.** Each genuine attachment of an accepted file type becomes its own invoice. This follows the normal convention for AP inbox capture, and it fails in the safe direction: a cover memo attached as a PDF creates a junk record that Finance cancels in seconds, whereas rolling extra files up as "supporting documents" can bury a real second invoice that then never gets coded or paid.
- **Inline body images are discarded.** These are the images referenced by the HTML body, meaning logos and signature blocks. Testing whether an image was part of the email's presentation is more precise than testing its file size, and it will not eat a small legitimate scanned receipt.
- Accepted for extraction: PDF, JPG, PNG, TIFF, HEIC. Other file types attach to the record but are not sent to OCR.
- **A body-only email still creates an invoice**, with blank fields and no document, flagged so it is obvious. Finance finds these through the existing **no attachment** filter on All Requests. Records without documents are already a normal state in the app, since manually created Drafts start that way.
- **Do not run OCR on the email body.** Create the record blank. Extracting from body text is a different and far less reliable problem than reading a scanned invoice, and it is not worth solving in v1.
- A single PDF containing several invoices is treated as one invoice. Auto-splitting is a v2 problem.

#### OCR

- **Azure Document Intelligence, prebuilt-invoice model.** The client pays the per-page cost, not CivicFlow.
- **Header fields only in v1.** The model can return line items, but coders enter GL account and amount themselves, so line items are ignored.
- Amount Before Taxes, Total Tax Amount and Invoice Total are all extracted. If they do not reconcile, the record is flagged for Finance to review. A mismatch never blocks creation.
- **Vendor matching:** fuzzy-match the extracted vendor name against the vendor master. Auto-fill on a high-confidence single match. If there are two plausible candidates, leave Vendor blank rather than guessing, and let Finance pick. Vendor drives Payment Method, so a wrong match propagates.
- **No department or assignee prefill.** The invoice lands unassigned, which is the purpose of the To Be Assigned stage.
- **If OCR fails entirely** (bad scan, photo of a photo), still create the invoice in To Be Assigned with the attachment and blank fields.

#### Settings: OCR configuration

- A **mapping table**, not a simple on/off list: each row is an app field, the OCR source field it draws from, and a toggle. A bare toggle list cannot work here because the field schema is custom per client, so the OCR has no way to know where to put a value.
- **Prebuilt model fields only in v1.** Pointing OCR at a client-specific custom field the model has never seen would mean keyword-anchored extraction or a trained custom model. Out of scope for now.
- **One global confidence threshold**, admin-settable, default 80%. Below the threshold the field is left blank rather than filled with a bad guess.
- Values that came from OCR are visually marked in the invoice UI so Finance can tell extracted data from human-entered data at a glance.

#### Settings: duplicate detection

- The **match key is admin-configurable**: the admin picks which fields form the duplicate signature and can add fields to that set. Expected combinations draw on invoice number, vendor name, invoice amount and PO number, but the picker is not limited to those four.
- Default match key is vendor plus invoice number.
- **Action is configurable**: flag in the queue (default), block creation, or allow silently. Flagging rather than blocking is the default because vendors emailing AP directly while Finance also forwards the same invoice is normal traffic, not an error.

#### Email confirmation

- New event and template, **E-08 Invoice Received**, joining the seven already in the template library. Replies to the forwarder with the invoice number and a link.
- A **failure notice** goes out only when no record was created at all, which now means one case: the message was quarantined by the sender policy.
- A body-only email gets the normal E-08 receipt, worded to say the invoice was created but no attachment was found, so the sender can send the document without re-sending the whole thing.
- **Admin-managed suppression list** in Settings → Email holding addresses or AD groups that never receive E-08. Finance Team goes in it so AP staff are not inundated by confirmations for their own forwards. Admin-managed rather than a per-user preference, so nobody has to go find and set it themselves.

#### Retention and audit

- Store sender, subject, received timestamp and the original message on the invoice record.
- Write an intake event to the per-invoice audit log. Note that the spec deliberately does not log field-level edits to OCR-extracted fields, so this intake event is the only record of what OCR originally produced.

#### Assumptions carried into build

Not separately confirmed, flag if any are wrong:

- Duplicate detection compares against all non-cancelled invoices, with no time window.
- Text fields in the match key are compared case-insensitively and with whitespace trimmed.
- The duplicate rule applies to manually created invoices as well as email intake, not just intake.

### 2. Reassign does nothing

Clicking Reassign currently has no visible effect. Treat the feature as unbuilt rather than as a bug to patch.

Required behaviour: Reassign opens a modal with an Active Directory people picker, captures a reason, confirms, sends the notification email to the person picked, and transfers ownership of the invoice to them at whatever stage it currently sits in. Bulk reassignment is also in scope, on the All Requests screen.

#### The single-invoice modal

- **One modal, not two.** Picker, reason and a plain-language summary of what is about to happen sit together above a single Reassign button. Reject uses a separate confirmation step because it destroys state such as batch numbers; Reassign destroys nothing, so a second click is friction with no payoff.
- **One person only.** No groups, no multi-select.
- **Stage and approvals are untouched.** The invoice does not move stage and no prior approvals are cleared. Only Assignee changes.
- Who can click it on a single invoice: the current assignee, Administrator, and Finance Team.
- The per-stage Reassign toggle already exists in the stage config matrix. Where it is off, the button is **hidden, not disabled**.

#### Reasons, as a configurable list

- The reason is an **admin-managed dropdown**, not free text. Selecting **Other** reveals a single line of text.
- Whether a reason is mandatory is itself a setting.
- **Reject and Cancel get the same treatment**, each with its own separate managed list. Build the reason-list mechanism once and reuse it across the three actions rather than building it three times. Reassign is the one to wire first.
- Assumed unless told otherwise: **Other** is a permanent built-in option admins cannot delete, and each list is global rather than per-stage.

#### Who appears in the people picker

- Filtered to users who hold the role that acts at the **current stage**. An unfiltered picker lets someone hand a Department Review invoice to a person with no Reviewer role, which strands it in a stage nobody can action, and the person who did it will not find out for days.
- **Administrators get a "show all users" override.** If an admin uses it and picks someone without the role, that is allowed, and **the assignment confers the ability to act on that one invoice**. Without that, the override would strand the invoice. This matches the existing pattern where deputies are "assigned ad-hoc via Reassign".
- **Confidential invoices:** the picker shows only users whose role carries the Confidential flag. A picker is a place a name can leak, and the spec already filters confidential invoices out of notification recipient slots.

#### Reassigning to yourself

Permitted, and audited, per the existing spec. It is how Finance takes over for someone out of office. But it is now gated: **a new role-level flag controls whether a role may reassign to itself**, sitting alongside the existing 🔐 Confidential and ⚙ Bypass Coding Restrictions flags rather than inventing a new permission surface. On by default for Finance Team and Administrator, off for Department Coder and Department Reviewer.

#### Stages with several approvers pending

Department Review can have multiple approvals outstanding at once, since CAO/Clerk is auto-added in parallel over the dollar threshold.

**Reassign moves a single pending slot, never the whole invoice.** If more than one slot is outstanding, the modal makes the user pick which one. Other approvers' pending slots, and any approvals already given, are left alone.

#### Bulk reassign

Lives on **All Requests**. The operation is always the same underneath: *move person X's pending slot to person Y*. Only the way the invoices get chosen differs, so this is one engine with two entry points, not two builds.

- **From-person (primary, gets the toolbar button).** Pick the person, optionally filter by stage or department, see their open work listed, untick anything to leave behind, commit.
- **Row selection (secondary).** Tick rows on All Requests and hit Reassign; the modal reads the current assignee from the rows. If the selection spans several assignees, it groups by assignee and shows that grouping before committing.

Defining the operation as "move X's slot" is what makes bulk work on multi-approver invoices. A pure row-selection model cannot tell which of three pending slots was meant, so it would have to skip those invoices, and those are exactly the ones over the dollar threshold with CAO/Clerk attached. Skipping would quietly leave the largest invoices behind.

Rules:

- **Restricted to Administrator and Finance Team.** Finance needs it: when a coder goes on leave, a Finance clerk should not have to move forty invoices one at a time or go hunting for an admin.
- **Stages with Reassign toggled off are excluded**, and said so in the result summary rather than silently dropped.
- **Picker shows anyone valid for at least one selected invoice**, then validates per invoice on commit. Showing only people valid for every selected row would hide a coder who could legitimately take most of them.
- **Partial failure commits what works.** The rest is reported with a reason. No all-or-nothing rollback.
- **One reason for the whole batch.**
- Cap of 100 invoices per operation.
- Confidential filtering applies exactly as it does for single reassign.

#### Email

- **E-07 Invoice Reassigned to You** already exists in the template library and fires to the new assignee on commit.
- **No email to the previous assignee.**
- Bulk sends **one consolidated email, not one per invoice**. New template **E-09**, with a token for the list of invoices.

### 3. Uploading a PDF invoice shows "Failed to load PDF document"

Uploading a PDF invoice produces the error "Failed to load PDF document" instead of the document rendering. Document preview does not work at all.

**Reproduction:** every PDF, no exceptions. Fails in every location that previews a document: the left preview pane on the Invoice and Coding screens, clicking a document on the Files tab, and the inline row expansion on All Requests.

**The file does not survive the round trip.** Downloading the attachment back out does not work either. That rules out the viewer as the cause: "Failed to load PDF document" is pdf.js's error string, so the obvious read is a broken viewer, but if the file cannot be retrieved at all then the problem is upstream in upload or storage and the viewer is only the messenger. Start there, not in the pdf.js integration.

**Expected:** uploading persists the file, preview renders it in all three locations, and downloading returns the original file byte-for-byte.

This blocks item 1. Email intake with OCR depends on storing an attachment and rendering it for Finance to check the extraction against, so none of that can be tested until document storage works.

### 4. Left nav is dead while an invoice is open

With an invoice page open, clicking any queue in the left hand navigation does nothing. The queue button takes the selected highlight, so the nav looks like it responded, but the page never changes. The user is stuck on the invoice and has to navigate back by other means.

The misleading highlight makes this worse than a button that simply did nothing, because the navigation is now reporting a location the user is not actually at.

**Expected:** clicking a queue in the left nav leaves the invoice and loads that queue, from anywhere in the app including an open invoice.

**For Dmitriy to check:** whether this reproduces from other screens or only from the invoice route. If navigation works everywhere else, the invoice screen is not releasing the route and this is scoped to that view rather than to the nav component.

### 5. An invoice that is not fully coded can be approved out of To Be Coded

An invoice can currently be approved out of To Be Coded without being fully coded. It should not be.

**This is already in the spec and is not being enforced.** Sum-match validation is defined in `AP Invoice.md` under Sum-match validation: configurable in Settings → Coding Table, matching against Amount Before Taxes by default, with Block as the default behaviour on mismatch and the message *"Invoice needs to be fully coded."* The setting exists; the gate does not fire.

**Expected:** leaving To Be Coded runs the configured sum-match rule and respects the configured behaviour. Block stops the transition and shows the configured message. Warn lets it through after an acknowledgement. Disabled skips the check. The rule is read from settings rather than hardcoded, since clients configure both the match target and the behaviour.

"Fully coded" means all three of these, not just the sum:

- At least one coding line exists. An invoice with an empty coding table cannot leave To Be Coded.
- Every coding line has a GL Account. A line carrying an amount with no GL is incomplete even when the totals happen to reconcile.
- The coding lines reconcile against the configured match target, which defaults to Amount Before Taxes.

Tax Code is deliberately excluded. Coders are trained not to enter tax codes; Finance enters them at AP Review, so a missing Tax Code must never block a coder.

**Multi-department invoices need a carve-out, or this deadlocks.** When more than one department codes the same invoice, no single coder can make the lines reconcile against the header on their own, so blocking every coder means nobody can ever submit. Per the Central Frontenac design: earlier coders submit their own department's lines without triggering the check, and **the rule is enforced only on the final coder's submit**, which stays blocked until the combined lines from all departments equal the header Amount Before Taxes.

**Assumptions carried into build**, flag if wrong:

- The check runs on every forward transition where coding lines exist, not only on the exit from To Be Coded. Later stages can edit fields depending on the Fields Editable By role configuration, so coding that was complete can be broken afterwards.
- The Approve button stays enabled and the block message appears on click, rather than the button being disabled with no explanation. A disabled button with no reason is the harder thing to troubleshoot for a coder who cannot see what is missing.
- Reject and Cancel are never blocked by this rule. An invoice that cannot be coded correctly has to be able to leave the stage backwards.

### 6. Remove the dead "Export" button

Both buttons sit on the **All Requests** screen. The stages are tabs on that one screen, not separate screens, so this is the only place either button appears.

- **Export** does nothing. Remove it.
- **Export CSV** works. Leave it alone.

No caveat on the removal. There is no prebuilt or fixed-shape export anywhere in the app, so nothing depends on this button. See item 8.

### 7. The View column picker only offers a subset of fields

Clicking **View** on the All Requests screen opens the picker for choosing which fields appear as columns in the table, but only a subset of the fields is listed.

**Expected:** every field eligible to be a column is offered.

**Confirmed as a defect, not a configuration problem.** The field schema gives every field an All Requests column toggle in Settings → Fields. Turning that toggle on does not add the field to the table and does not add it to the View picker either. So the toggle is not wired to anything on the All Requests screen. Both ends need fixing: the field should appear as an option in the View picker, and selecting it should put the column in the table.

### 8. Column filtering and saved personal views

Two related additions to the All Requests table. Depends on item 7, since neither is much use while the column picker only offers a subset of fields.

#### Column filtering

- Filter on the table columns.
- **Filters combine with AND across columns and OR within a column.** So Department is Public Works or Parks, and Vendor is Acme. Full boolean logic is a reporting feature, not a queue feature.
- Filtering runs **server-side against the full result set**, not in the browser against the loaded page. A filter that only searches what happens to be loaded will look correct and be wrong.
- Filter input follows the field type: contains for text, multi-select for choice, range for date, number and currency, people picker for user fields.

#### Saved personal views

A user arranges the table, saves it, and picks it later from a dropdown of their own views.

- **A view captures** the visible columns and their order, the filters, and the sort.
- **Stage is a filter dimension, not separate from the view.** A view created while on All applies to All. A view created while on To Be Assigned applies to To Be Assigned.
- **Personal only in v1.** No shared views, no role default views.
- **A view can be marked as the user's default**, and the screen opens on it. This persists between sessions, otherwise the user re-picks from the dropdown every morning and most of the benefit is gone.
- **Rename, duplicate and delete.** Cap of 10 views per user in v1.

**Open decision, personal-only versus shared views.** Dropping the prebuilt ERP export means the ERP column layout now lives in somebody's saved view. If views stay personal-only, that layout belongs to one person, and when they are on vacation nobody else can produce the ERP file without rebuilding it from memory. Shared views were parked as a v2 nice-to-have; this decision makes them load-bearing. Smallest fix that closes it is letting an Administrator publish a view to a role, which keeps ownership simple and does not require the full sharing model.

#### Export CSV follows the current view, and is the only export

**Export CSV always exports exactly what is on screen:** the current filters, the current columns, the current column order, the current sort. It covers every row matching the filter, not just the page that happens to be loaded.

**There is no prebuilt ERP export.** The earlier design had a second, fixed-shape export at Ready for Processing for the ERP handoff. That is dropped. A client who knows what their ERP needs builds a view shaped to it and exports that view. One export mechanism, no special cases.

**Remove the per-field CSV export toggle from the field schema.** It existed only to define the fixed export's column set. With that export gone, the toggle governs nothing, and a setting that appears to control exports but does not is worse than no setting at all.

This changes `AP Invoice.md` in two places: the Field schema section lists the CSV export toggle as a per-field property, and the Ready for Processing stage is described as feeding the ERP via CSV export.

#### Confidential invoices are unaffected

Row-level security is independent of views and filters. A confidential invoice is invisible to a user without the Confidential flag no matter what view or filter is applied. Views change what a user chooses to look at, never what they are allowed to see.

### 9. Email template editing

On the Email tab, the template body must be editable as **rich HTML**, not raw markup.

- **Tokens are clickable.** Clicking a token puts it in the body.
- **The preview renders the finished email**, not the raw template.

Two details that decide whether this is actually usable:

- The preview must include the **global HTML header and footer**, since those wrap every email body. A preview showing the body alone is not showing the email anyone receives.
- The preview must **resolve tokens against sample data** rather than displaying `{{InvoiceNumber}}` literally. Otherwise it cannot answer the question people open a preview to answer, which is whether the wording reads correctly once the values are in.

On clicking tokens: the spec already calls for one-click **insertion at the cursor**, which is fewer steps than copy-then-paste and puts the token where the user is typing. Build insertion as the click action, and offer copy on hover for anyone who wants to paste it elsewhere.

### 10. Coding restrictions: GL format, department mapping, and who can code where

The base app needs to express a client's GL account format, work out which department owns any given GL, and restrict coders accordingly.

**This model is taken from the Central Frontenac design rather than invented.** Section 4.2 GL-to-Department Routing in `Central Frontenac AP Invoice Functional Design V0.6.docx` is a sign-off draft that has already been through a client, and it solves several cases a simpler model gets wrong. Build the base app to match it.

#### GL account format

- The format is a **mask** with a label per segment, for example `XX-XXX-XXXX-XXXXX` labelled Fund, Function, Sub-department, Object.
- **Segments are different lengths.** Central Frontenac's GLs look like `10-000-0000-10116`. Any model assuming uniform segment width is wrong.
- The mask gives length validation, so a malformed GL can be rejected rather than accepted.
- **Nominate which segment carries the department.** At Central Frontenac that is the third segment, the sub-department.

#### Department mapping, by range

Map **ranges** of the department segment to departments, not individual values.

- Rows accept either a range (`0001 to 0099` is Facilities) or a single value (`0100` is Financial Services). Both live in the same table.
- **A department holds several discontiguous rows.** Fire is `0400 to 0414`, plus `0450`, plus `4001 to 4099`.
- **Individual values override the range they sit inside.** Sub-dept `1645`, the Swim Program, falls inside `1600 to 1649` which is Facilities, but routes to Clerking. Exceptions win over ranges.
- The Administrator maintains ranges and overrides in Settings.

Ranges rather than values because of the scale involved: Central Frontenac's 544 sub-departments are covered by about 24 rows. An exact-value map would mean 544 rows and a maintenance job every year.

#### Unmapped values go to a nominated catch-all department

Anything not covered by a range or an override routes to a **configurable catch-all department**. Central Frontenac uses Financial Services.

This is deliberately fail-closed rather than fail-open. Facilities and Public Works create new sub-departments every year for capital projects, and those codes appear in the GL master before anyone maps them. Routing them to a nominated department means Finance sees them and maps them. The alternative, treating unmapped as open to everyone, would silently make each year's new capital accounts codeable by the entire organisation.

**Settings should list the values currently hitting the catch-all**, so an admin can see what has appeared and needs mapping. That list is the mechanism by which new sub-departments get noticed.

#### What the map controls

Both coding and approval, not just visibility:

- A coder sees only GLs whose department segment maps to a department they belong to. Finance Team and Administrator see all GLs.
- The map routes **approval** to the owning department's reviewer.
- **Coding a line to another department's GL auto-adds that department's reviewer** as a parallel approver.

#### GLs reachable by more than one department

No mechanism is needed in the map for this. It is already covered twice over:

- **Role permissions.** Finance Team, Treasurer and Administrator carry Bypass Coding Restrictions and see every GL. This is how Central Frontenac's "Financial Services backstop" ranges work: Clerking signs off, and the Treasurer and Deputy Treasurer reach those GLs through their existing roles.
- **Reviewer auto-add**, above, which pulls the affected department's approver onto any invoice coded across departments.

There is no "may also code to" list in v1, and none is required.

#### This replaces the existing per-department rule builder

The current spec has a rule builder where each department carries rules of the form "Segment N matches value" with Equals, Starts with and In list, OR'd together. **Replace it with the range table.** One screen instead of one per department, and it matches how an admin actually thinks about a chart of accounts.

Nothing is foreclosed by this. The range table is a constrained case of the same underlying data, so if a client ever needs Starts with or a restriction spanning two segments, that is added later as an advanced mode with no migration.

#### Enforcement

Unchanged from the current spec. The GL dropdown filters live, the app re-validates on submit rather than trusting the filtered list, the Bypass Coding Restrictions role flag still overrides everything, and a coder whose department has no mapping is blocked.

#### Related confirmations

- Coding access follows the **coder's own department membership**, not the invoice's Department field.
- The invoice's Primary Department is used for grouping and reporting only, and is independent of the coding-line GL selections.

### 11. Match the revamped City Connections look and feel

The AP Invoice UI should match the **revamped City Connections design**: the current version, which Dmitriy has and will recognise. Not any earlier redesign package.

**This supersedes the app's current visual direction.** `AP Invoice.md` describes a Microsoft Fluent / Power Platform aesthetic, with vivid blue hero headers on every screen, dark slate primary buttons, stat cards with mini-square icons and dot motifs, and it points at the 2026-05-13 City of Aurora mockup as the visual reference for new engagements. That section also ends with "don't redesign the look unless asked". This item is the asking, so treat the Aurora mockup as superseded for UI purposes rather than as a second source of truth to reconcile against.

Carry over the interface principles already agreed for City Connections, since they are the substance of the revamp:

- **Inline editing wherever possible.** Where a modal is genuinely required, make it large.
- **Use more of the screen.** Expand the components rather than leaving the layout boxed in.
- **White input boxes**, no monochromatic fields, to actually meet WCAG 2.2 AA.

**The brand tokens and the .docx document conventions are unaffected.** Those govern client-facing deliverables, not the application interface, and the brand colours carry across regardless.
