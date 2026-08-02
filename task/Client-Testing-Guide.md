# AP Invoice — What to test, and how

For the client testing the eleven items from the feedback list. Every button and field name below is the exact wording on screen.

**Where**: https://david-show.vercel.app
**Sign-in**: none. The link is the only key — anyone who has it can use the app. That is deliberate for this demo and is the first thing to change before real use.

Left-hand navigation, top to bottom: **Home**, **All Requests**, **New Invoice** (under *Queues*), then **Email**, **Settings**, **Trash**, **Alerts** (under *Admin*).

---

## 1. Email intake with OCR

An invoice emailed to the AP mailbox becomes a record in **To Be Assigned**, with the header fields filled in from the scan.

**Mailbox**: `invoices@civicflow.co`
**Currently accepts**: email from `@civicflow.co` addresses only. Anything else is held for review — see step 5.

### Test it

1. From an `@civicflow.co` address, email `invoices@civicflow.co` with an invoice attached. **PDF, JPG, PNG, TIFF or HEIC.** Other file types attach to the record but are not read.
2. Wait about a minute.
3. Open **All Requests**. Click the **To Be Assigned** tab.
4. A new row should be there. Open it.
5. On the **Header** tab, values the machine read from the document are marked so you can tell them from typed-in ones.
6. Where a field is empty, look underneath it. If the scan read something but wasn't sure enough to use it, you'll see *"Scan read X · 62% sure — left blank for you to check"*. The field is still yours to fill; the app is showing its working, not filling it in.
7. Click the **Files** tab. The attachment is listed. Click it — the document displays in the pane on the left.
8. Back on **All Requests**, click the arrow at the start of the invoice's row to expand it. The document previews there too, beside the coding lines.

### What should happen, and why

- **One invoice per attachment.** Two invoices in one email make two records. A cover letter attached as a PDF makes a junk record you cancel in seconds — that is the safe direction to fail in.
- **Logos and signature images are ignored.** They are part of the email's layout, not documents.
- **An email with no attachment still creates a record**, blank, so nothing is lost. Find these with the flag filter **No attachment** on All Requests.
- **If the scan cannot be read at all**, the record is still created with the file attached and the fields blank.
- **A field the machine is unsure about is left blank** rather than filled with a guess, and what it read is shown underneath as a suggestion for a person to confirm. The bar is set in **Settings → Invoice Reading (OCR)**, field **How sure a reading has to be**, default 80%.
- **An amount it could not read stays empty, never zero.** Zero is a real figure and would read as a genuine claim about the invoice.
- **Vendor is filled only on a confident single match** against your vendor list. Two plausible candidates and it stays blank for a person to choose — the vendor drives the payment method, so a wrong guess spreads.
- **Nothing is assigned to anybody.** That is what the To Be Assigned queue is for.

### Try a document that reads badly

Send a shop receipt rather than a supplier invoice. Only the total will be found, and the record gets a placeholder number like `EMAIL-20260731-1`. That is correct behaviour — the reading model expects an invoice layout — and it shows the app does not throw away what it cannot fully read.

### Assigning it to somebody

An invoice arriving by email belongs to nobody. That is the point of the To Be Assigned queue, and the next thing to do is give it to a person.

1. Open the invoice.
2. Click **Assign** at the bottom of the screen.
3. **Hand it to** lists the people who can code invoices. Someone with no coding role is not offered, because handing it to them would leave it in a queue nobody watches.
4. The sentence underneath states what will happen before you commit.
5. Click **Assign**. The invoice goes to that person and moves into **To Be Coded** in the same step.

A confidential invoice narrows the list to people cleared for confidential invoices.

### Settings to look at

**Settings → Invoice Reading (OCR)** — the mapping table. Each row is one field in the app and which reading it draws from, with a switch. This has to be a mapping rather than a list of switches, because every client's field set is different and the reader has no way to guess where a value belongs.

**Settings → Duplicate Detection** — which fields decide that two invoices are the same, and what happens on a match: flag it in the queue (the default), block it, or allow it silently. Flagging is the default because a vendor emailing AP directly while Finance forwards the same invoice is normal traffic, not an error.

**Settings → Email Intake** — mailbox address, and **Who may email invoices to this address**: *Our staff only*, or *Anyone*. Choosing *Anyone* shows the consequence in plain words on the screen, next to the choice.

**Settings → Held Emails** — anything the sender rule turned away, with **Why it was held** and a button **Accept this one**. Nothing that reaches the mailbox is ever silently dropped.

**Settings → Test invoice reading** — reads a file you hand it, without email. Press **Choose a file**, then **Run the check**. It shows every step and changes nothing. If the result looks right, **Create this invoice for real** puts it in the queue.

---

## 2. Reassign

Previously the button did nothing. It is now built, single and in bulk.

### One invoice

1. Open any invoice from **All Requests**.
2. In the row of buttons, click **Reassign**.
3. The dialog is titled **Reassign this invoice**.
   - If more than one person is being waited on, **Whose turn are you moving?** appears first. Pick one.
   - **Hand it to** — the person taking it over.
   - **Reason** — a dropdown, not free text. It reads *(required)* or *(optional)* depending on the setting. Choosing **Other** reveals a single line to type in.
4. Below the fields, a sentence in plain words states exactly what is about to happen.
5. Click **Reassign**.

**What to check**: the invoice does not move stage, and approvals already given are still there. Only who it is waiting on changes.

**Who is listed**: only people who hold a role that acts at this stage. An unfiltered list would let you hand a Department Review invoice to somebody with no reviewer role, and it would sit there for days before anyone noticed. An administrator gets a switch, **Show everyone, not only people who work at this stage** — using it is allowed, and the person picked can act on that one invoice.

**Confidential invoices** list only people whose role carries the confidential flag.

**Several people pending at once**: reassigning moves one person's turn. Everyone else keeps theirs.

### Several invoices at once

1. On **All Requests**, click **Reassign someone's work**.
2. Pick the person who is away. Their open work is listed.
3. Untick anything to leave behind.
4. Give one reason for the whole batch and commit.

**What to check**: if some invoices cannot be moved, the rest still are, and the ones left behind are listed with the reason. No all-or-nothing. Cap is 100 per operation.

Available to Administrator and Finance Team. A Finance clerk should not have to move forty invoices one at a time when a coder goes on leave.

### Reasons are managed lists

**Settings → Reasons** holds three separate lists — **Reassigning**, **Rejecting**, **Cancelling**. Each row has a **Reason** and a **Position**. **In use** switches one off without deleting it. **Other** is permanent and cannot be removed. Whether a reason is compulsory is a setting per list.

### ⚠ The notification email is not sent

The message is composed and recorded. **It does not leave the building** — this application has no mail sender yet. See *Known gaps* at the end.

---

## 3. PDF preview

Previously every PDF failed with "Failed to load PDF document", and downloads came back empty.

1. Open an invoice, click the **Files** tab, then **Upload** and pick a PDF.
2. The document should display in the pane on the left of the screen.
3. Click the download icon on the file row. The file that comes back should open normally and match what you uploaded.
4. Check the same preview on the coding screen (item 5 below) and by clicking a document on the Files tab.

The cause was storage, not the viewer — the file was not surviving the round trip, so the viewer had nothing to show.

---

## 4. Left-hand navigation while an invoice is open

Previously, with an invoice open, clicking a queue on the left highlighted it but the page never changed.

1. Open any invoice.
2. Click **All Requests** on the left.
3. The invoice should close and the list should open.
4. Repeat from the coding screen, from **Settings**, and from **Trash**.

---

## 5. An invoice that is not fully coded cannot be approved

This is the item with the most moving parts. Set the rule first, then test it.

### Set the rule

Open **Settings → Coding Table**. Four controls:

- **Coding lines must add up to** — *Amount Before Taxes* (the default), *Invoice Total*, or *Do not check the totals*
- **When an invoice is not fully coded** — *Stop the approval* (the default), *Warn, then let it through once confirmed*, or *Skip the check entirely*
- **Message shown to the user** — the exact words a coder sees. Default: *Invoice needs to be fully coded.* It is saved when you click away from the box.
- **Rounding allowance** — how far off the totals may be and still count as matching

### Test *Stop the approval*

1. Set **When an invoice is not fully coded** to **Stop the approval**.
2. Open an invoice sitting in **To Be Coded**.
3. Click the **Coding** tab. It opens a separate screen, document on the left, table on the right.
4. Delete every coding line, or leave one line without a **GL Account**.
5. Go back to the invoice and click **Approve & advance**.
6. **Expected**: your message from Settings appears, and the invoice does not move.

Change the message in Settings to something you will recognise, then repeat. The words on screen should be yours.

### Test *Warn*

1. Set the behaviour to **Warn, then let it through once confirmed**.
2. Try to approve the same incomplete invoice.
3. A confirmation appears listing exactly what is missing, with **Go back and finish coding** and **Approve anyway**.
4. **Approve anyway** lets it through, and the fact that you overrode it is written into the invoice's **Log** tab.

### What "fully coded" means

All three, not just the sum:

- at least one coding line exists
- every line has a **GL Account**
- the lines add up to the target you chose

**Tax Code is deliberately not required.** Coders are trained not to enter it; Finance adds it at AP Review. A missing tax code must never block a coder.

### Points worth confirming

- **The Approve button stays clickable** and the reason appears when you press it. A greyed-out button with no explanation is harder for a coder to act on than a message that says what is missing.
- **Reject and Delete are never blocked by this rule.** An invoice that cannot be coded correctly still has to be able to go backwards. Test this: on a completely uncoded invoice, **Reject** and the delete button both still work.
- **The check runs on every forward step from To Be Coded onwards**, not only when leaving that stage — later stages can edit fields, so coding that was complete can be broken afterwards.
- **Several departments coding one invoice**: earlier departments submit their own lines without triggering the check. Only the last one is held to the total. Otherwise no single coder could ever make the lines reconcile and the invoice would deadlock.

### Correcting the amounts

If the scan misread the figures, the coder would be measured against a wrong number with no way to fix it. So: on the **Header** tab, **Correct amounts** opens the three amounts for editing, with **Save** and **Cancel**. The correction is recorded in the **Log** tab against what the machine originally read.

---

## 6. The dead Export button

On **All Requests** there used to be two buttons. **Export** did nothing and has been removed. **Export CSV** is the working one and is still there, top right.

Confirm there is only one export button.

---

## 7. The View column picker

Previously it offered only some fields.

1. On **All Requests**, click **View** (top right of the table).
2. The list is headed **Columns**. Every field eligible to be a column should be there.
3. Tick one that is currently off. The column appears in the table.
4. Use the small up and down arrows beside a name to change the column order.

To confirm the toggle in the field schema is now connected: open **Settings → Fields**, switch on the All Requests column option for a field, then come back to **All Requests** and open **View**. The field should now be in the list.

---

## 8. Column filtering, saved views, and CSV export

### Filtering

1. Hover over a column heading. A small funnel appears. Click it.
2. The panel is headed **Filter by <column name>**. What it offers depends on the field: a **Contains…** box for text, **From** and **To** for dates and numbers, a tick list for choices.
3. Applied filters appear as chips above the table. Each chip has an × to remove it. **Clear filters** removes them all.

**What to check:**

- **Two values in one column** find rows matching either. **Filters on two different columns** find rows matching both.
- **Filtering searches everything, not just the page you can see.** Filter to something you know is on page three and confirm it is found.
- **The tab counts and the table agree** — they count the same thing.

The search box above the table (**Search by invoice #, vendor, batch…**) is a different tool: it looks across those three at once rather than filtering one column.

Beside it are the flag filters: **Amounts do not add up**, **No attachment**, **Possible duplicate**, **OCR failed**, **Archive failed**, **Vendor setup required**, and **Reset**.

### Saved views

The button at the top right shows **Standard list** until you pick a view.

1. Arrange the table — pick columns, order them, filter, sort.
2. Click the button, then **Save current arrangement…**, and name it.
3. Change something. The button shows **(edited)** beside the name. **Save changes to this view** commits it.
4. **Open this view first** makes it the one that opens when you arrive. Close the browser, come back, and confirm.
5. **Rename…**, **Duplicate** and **Delete** do what they say. **Share with a role…** publishes it so a whole role can open it — they can use it but not change it.

**A view remembers** the visible columns and their order, the filters, and the sort. The stage tab is part of it: a view made on **To Be Assigned** applies to that tab.

Cap of 10 views per person. Views are personal unless you publish one to a role.

### Export CSV

**Export CSV** exports exactly what is on screen — your filters, your columns, in your order, in your sort — for every matching row, not just the page loaded.

Test: filter to a handful of rows, remove a column, export, open the file. It should match the screen.

**There is no second, fixed-shape export.** A client who knows what their ERP needs builds a view shaped to it and exports that. One mechanism, no special cases.

### Confidential invoices

Row-level security does not care about views or filters. An invoice marked confidential stays invisible to anyone without the confidential flag, whatever view is applied. Views change what you choose to look at, never what you are allowed to see.

---

## 9. Email template editing

1. Open **Email** on the left, then **Templates**.
2. Pick a template from the list, or click **Add template**.
3. The body is edited as formatted text — bold, lists, links — not as raw markup.
4. Below the editor is a row of details in brackets, like `{{InvoiceNumber}}`. **Click one and it drops in where your cursor is.** Hovering gives you a **Copy** option if you would rather paste it elsewhere.
5. The **Preview** on the right shows the finished email:
   - wrapped in the header and footer from **Email → Settings**, because those wrap every message that goes out
   - with the details replaced by sample values, not left as `{{InvoiceNumber}}`

   A preview showing the body alone, with raw placeholders, cannot answer the question people open a preview to answer — whether the wording reads right once the values are in.
6. **Save** commits. **Discard changes** throws away your edits. **Delete template** removes it.

Check the header and footer separately at **Email → Settings**: change the footer, come back to a template, and the preview should show the new one.

---

## 10. Coding restrictions — GL format, departments, who codes what

Open **Settings → Coding Restrictions**.

### The account format

- **Account code format** — the shape of your GL codes, written as X's with separators, for example `XX-XXX-XXXX-XXXXX`. Parts can be different lengths; that is normal and expected.
- **Part that names the sub-department** — which section of the code says which department owns it.
- **Department for unmapped sub-departments** — where anything not yet mapped goes.
- **Save format**.

The format also gives length checking, so a malformed GL code can be refused rather than quietly accepted.

### The department map

Below is a table of ranges. **Add range** adds a row. Each row has **Sub-departments**, **Department**, how many **GL accounts** fall in it, and a **Note**.

- A row is a **range** (`0001` to `0099` is Facilities) or a **single value** (`0100` is Financial Services). Both live in the same table.
- **One department can hold several separate rows** — Fire might be `0400`–`0414`, plus `0450`, plus `4001`–`4099`.
- **A single value beats the range it sits inside.** Sub-department `1645` inside `1600`–`1649` can route somewhere else entirely.

Ranges rather than individual values because of scale: 544 sub-departments are covered by roughly 24 rows. A value-by-value map would mean 544 rows and an annual maintenance job.

### Unmapped codes

Anything not covered goes to the catch-all department you nominated. This is deliberately closed rather than open: departments create new sub-departments every year for capital projects, and those codes appear in the GL master before anyone maps them. Sending them to a nominated department means Finance sees them. Treating them as open to everyone would quietly make each year's new capital accounts codeable by the whole organisation.

The panel headed **Not mapped yet** lists what is currently landing in the catch-all. That list is how new sub-departments get noticed.

### Test the restriction

1. Map a range to a department the test user does not belong to.
2. Open an invoice, go to **Coding**, and open the **GL Account** dropdown.
3. Only accounts owned by the coder's own department should be listed.
4. Confirm the same rule holds on save, not just in the dropdown — the app re-checks when the line is saved, so bypassing the list does not work.

**Coding access follows the coder's own department**, not the invoice's department field.

Finance Team, Treasurer and Administrator carry a bypass on their role and see every GL. Coding a line to another department's GL pulls that department's reviewer onto the invoice as a parallel approver.

---

## 11. Look and feel

The interface follows the revamped City Connections design.

Worth looking at specifically:

- **Editing happens in place** wherever possible. Where a dialog is genuinely needed, it is large.
- **The layout uses the width of the screen** rather than sitting in a narrow box.
- **Input boxes are white with a visible edge**, not grey-on-grey.

Three colours deliberately differ from the design source, because those three fail the WCAG 2.2 AA contrast standard the revamp exists to meet: the pale grey used for body text, the coral behind white text, and the very light line used around input boxes. Each was measured, not estimated. If the app looks slightly darker than the mockup in those three places, that is why.

---

## Known gaps — please read before demonstrating

### No sign-in

There is no login. Anyone with the address can open the app and do anything in it. Nothing is per-user, so "who did this" in the audit trail is a single stand-in account. This is the first thing to build before real use.

### No email actually leaves the system

Every email in the app — the reassignment notice, the intake confirmation, the rejection notice — is **composed and recorded but never sent**. There is no mail sender wired up. You will see the message contents in the app; the recipient will not receive anything.

This affects, from the feedback list:
- **Item 1** — the *Invoice Received* confirmation to whoever forwarded the invoice
- **Item 2** — the *Reassigned to You* notice to the person taking over, and the consolidated one for a batch

The templates, the sample data, the header and footer and the preview are all built and working. What is missing is the last step that hands a finished message to Microsoft 365 to deliver. It needs one additional permission on the app registration (`Mail.Send`) and an administrator's approval, then the sending code.

### Three settings screens do not save

**ERP Sync**, **Archive** and **Audit Retention** display their settings but do not store changes.

### Email triggers are read-only

**Email → Triggers** lists which event fires which template but cannot be edited. The feedback item covered template editing, which is done.

### Settings changes are not audited

Invoice actions are fully recorded in each invoice's **Log** tab. Changes to settings are not.

### Two people editing at once

There is no conflict detection anywhere. If two people change the same thing, the last save wins silently.
