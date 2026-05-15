# IA Fill Tool — Design

**Status:** Draft for review (rev 2 — single-file PowerShell, Excel COM)
**Date:** 2026-04-27
**Owner:** dayele@stoneshare.com

## Problem

When designing a SharePoint Information Architecture for a client, a consultant must inventory the client's existing file share and translate every top-level folder ("library") into a row in a multi-tab Excel template (the IA workbook). The mapping is rule-based but tedious, error-prone, and currently done by hand. Multiple consultants on the team produce inconsistent results.

## Goals

- Eliminate the manual cell-by-cell population for each library.
- Apply the team's IA mapping rules deterministically — same file share always produces the same rows.
- Run inside a client-provided VM with no internet, no installs, no external services.
- Deliverable is a **single PowerShell script** the team can read, audit, edit, and share without supporting files.

## Non-Goals

- Crawling SharePoint via Microsoft Graph. The tool walks a local file path only.
- Multi-site automation in one run. Each invocation populates one site/sheet.
- Auto-organizing the source file share. The user pre-organizes the share to fit the conventions; the tool only reads.
- Touching the human-managed Comments columns (`IA Review`, `Configuration`, `StoneShare`).

## User Workflow

1. Consultant organizes the client file share so it follows team conventions (top-level libraries with class-code prefixes; metadata folders use `(Field=Value)` syntax).
2. Copies `Invoke-IAFill.ps1` and the IA workbook onto the client VM.
3. Runs `.\Invoke-IAFill.ps1 -SitePath <site-folder> -Workbook <ia-workbook.xlsm>`.
4. Answers a short series of prompts (site name, header block values, types of any unknown metadata fields encountered).
5. The tool adds a new sheet, or rewrites the data area of an existing sheet, then saves.
6. Consultant reviews the result in Excel and lightly edits any judgment cells (URL slug, Grouping word) where the deterministic default isn't ideal.
7. If new field types were discovered, the script prints a "please add to script" reminder; the consultant updates the embedded hashtable at the top of `Invoke-IAFill.ps1` and commits the change so the next teammate's run benefits.

## Architecture

A single PowerShell script — `Invoke-IAFill.ps1`. No supporting files, no modules folder, no config directory. Reference data (existing site columns, known field types) is embedded as PowerShell hashtables near the top of the script.

Excel I/O uses the built-in **Excel COM automation** (`New-Object -ComObject Excel.Application`). This requires Microsoft Excel to be installed on the machine — true for any client VM the team uses, since the consultant opens the IA workbook in Excel as part of their normal workflow.

The File Plan mapping is read from a tab inside the IA workbook itself.

### Process flow

1. Validate inputs: site folder exists, workbook exists.
2. Launch Excel COM, open workbook (read/write), locate the `File Plan` tab.
3. Build an in-memory dict from File Plan: `class_code → (content_type, trigger, retention)`.
4. Determine the target sheet name (prompt for site name, default = site folder name). If the sheet exists, confirm overwrite. Otherwise clone from a `TEMPLATE` tab (or whichever the user names).
5. Prompt for header block fields (Organization, Department, Branch, Site Type, Team Site URL). When overwriting, default each prompt to the value already in the sheet.
6. Walk the site folder one level deep to enumerate libraries. For each library, walk the **full** subtree to classify it and collect metadata fields.
7. For each library, derive columns A–T per the rules below.
8. If any metadata field encountered is not in the embedded existing-columns list **and** not in the embedded field-types lookup, prompt the user for its type (`text` / `choice` / `date`). Hold the answer in memory for the rest of the run.
9. Make a `.bak` copy of the workbook beside the original.
10. Write/overwrite the data area of the target sheet (preserving Comments columns and the trailing template row).
11. Save and close via Excel COM. Release COM objects cleanly so no `EXCEL.EXE` process lingers.
12. Print a summary: rows written, fields auto-classified, any class codes missing from File Plan, **plus a reminder block** listing the new fields and their types so the user can paste them into the script's embedded `$FieldTypes` hashtable for next time.

### Stack

- PowerShell 5.1+ (Windows built-in; PS 7 also fine)
- Excel COM (requires Microsoft Excel installed locally)
- [Pester](https://pester.dev/) for the unit tests covering pure functions (walk, classify, derive). The COM-touching code is verified by manual smoke runs against a fixture workbook — Pester not used there.

## Folder Structure Conventions (assumed)

A library may take any of these shapes — the walker handles all of them by inspecting the full subtree.

```
SiteFolder/
  ClassCode - Library Name - d/                   ← one library = one row
    files...                                       ← files-only (scenario 1)
    NormalFolder/                                  ← document set (scenarios 2, 4)
      files
    (Field=Value)/                                 ← inner doc-level metadata (scenarios 3, 5)
      files
    (Field=Value)/                                 ← outer doc-set-level metadata
      (Field2=Value)/                              ← multiple outer levels supported
        DocSetFolder/                              ← the document set itself
          (Field3=Value)/                          ← inner doc-level metadata
            (Field4=Value)/                        ← multiple inner levels supported
              files
```

Class codes are opaque strings (e.g., `E07`, `A09`, `E11`, `E11.1`). The tool extracts a code by taking the substring before the first ` - ` separator in the library folder name and looks it up in the File Plan.

### Walk algorithm

For each library, walk the entire subtree depth-first. Maintain two ordered lists per library:

- **OuterMetadata** — `(Field=Value)` folders encountered on the way *down* before the first normal folder is reached on a given path.
- **InnerMetadata** — `(Field=Value)` folders encountered *after* the first normal folder on a given path.

A folder is "normal" if its name does not match `^\([^=]+=[^)]+\)$`. Files are ignored for classification but their presence at any depth is fine.

A library is a **document set library** (column E = `Yes`) if **any normal folder exists anywhere in the subtree** (other than the library root itself). Otherwise `No`.

OuterMetadata and InnerMetadata are accumulated across all paths in the subtree, deduplicated, and ordered by their first appearance during the depth-first walk.

For each metadata field, the tool also collects the **set of distinct values** seen across all matching `(Field=Value)` folders, used for column K (`New Choice Columns`).

## Column Rules (A–T)

For each library folder under the site folder, build a row with these 20 columns. The tool maps each derived value to the actual workbook column by matching the column-header label, so positional ordering can vary between client templates.

| Col | Header | Rule |
|---|---|---|
| A | Class Code | Substring of library folder name before first ` - `. |
| B | Library Name | Full library folder name, as-is. |
| C | Library URL | `/` + lowercased library name with class code prefix and trailing ` - d` / ` - tbc` removed, spaces, hyphens, and ampersands stripped. Best-effort default; user shortens in Excel where a more readable slug exists (e.g., `/wastemanagementclosedlandfillsites` → `/WMClosed`). |
| D | Description | Empty string. |
| E | Document Sets | `Yes` if any normal folder exists anywhere in the library's subtree; otherwise `No`. |
| F | Document Set name | If E=Yes: `{ClassCode} - {ContentType} Document Set` where ContentType comes from File Plan lookup. Else `N/A`. |
| G | Document Set Grouping | If E=Yes: last whitespace-separated word of the library name (after trimming class code prefix and ` - d`/` - tbc`), lowercased, with trailing `s` stripped if the word ends in a single `s` (e.g., `Consultants` → `consultant`). Best-effort default; user overrides in Excel for cases like `Conferences and Seminars` → `conference/seminar`. Else `N/A`. |
| H | (same as F minus " Document Set") | If E=Yes: `{ClassCode} - {ContentType}`. Else `N/A`. |
| I | Existing Site Columns | Union of all OuterMetadata + InnerMetadata field names whose name appears in the embedded `$ExistingColumns` list. Format: each name + `;`, one per line in the cell. |
| J | New Text Columns | InnerMetadata field names that are not in `$ExistingColumns` and whose type (per `$FieldTypes`) is `text`. Same stacking format. |
| K | New Choice Columns | InnerMetadata fields not in `$ExistingColumns` and typed as `choice`. One line per field as `FieldName: opt1, opt2, opt3` where options are the union of distinct values seen across folders. |
| L | New Date Columns | InnerMetadata fields not in `$ExistingColumns` and typed as `date`. Same stacking format as J. |
| M | Document Views | Built from non-date InnerMetadata fields (existing + new text + new choice — anything except date). 0 fields → `All Documents`; 1 → `Group by {f}; All Documents`; 2 → `Group by {a} and {b}; All Documents`; 3+ → all pairwise combinations as separate `Group by` views, then `All Documents` last. Joined by `; `. |
| N | Document View Column Order (will be indexed) | All InnerMetadata field names, semicolon-separated, in nesting order, with the Trigger value (column S) appended at the end. |
| O | Document Set Views | Same logic as M, but built from the OuterMetadata fields. `N/A` if E=No. |
| P | Document Set Columns, in View Order | Semicolon-separated list of OuterMetadata field names in nesting order. `N/A` if E=No. |
| Q | Version Configuration | Static: `Major Only - 100 version limit`. |
| R | Permissions Inheritance | Static: `Yes`. |
| S | Trigger | File Plan lookup by class code → Trigger column. |
| T | Total Retention after Trigger Date | File Plan lookup by class code → Retention column. |

### Field type resolution

When a metadata field name is encountered:

1. If it appears in `$ExistingColumns` → goes to column I.
2. Else look up in `$FieldTypes` → goes to J / K / L based on type.
3. Else: tool prompts the user for its type and uses that for the rest of the run. The tool does **not** modify itself; instead, at the end of the run it prints a reminder block listing the new fields and their chosen types, so the user can paste them into the script's `$FieldTypes` hashtable for the next teammate.

## Interactive Prompts

Prompts use plain `stdin`/`stdout`. All prompts have a sensible default shown in brackets; pressing Enter accepts it.

**On startup:**

- `Site name [<folder name>]:` — also used as the sheet tab name.
- `Sheet "<name>" already exists. Overwrite the data area? [y/N]:` — only if the tab exists.
- If the tab does not exist: `Template tab to clone from [TEMPLATE]:`.

**Header block:**

For each of Organization, Department, Branch, Site Type, Team Site URL:

- New sheet → empty default; user types the value.
- Existing sheet → default is the value already in the sheet (read via COM); pressing Enter keeps it.
- `Date Created` defaults to today.

**During the walk:**

- `Field 'XYZ' is new — type? [text/choice/date]:` — answer used for the rest of the run.
- `Class code 'XYZ' not found in File Plan. [s]kip library / [e]nter manually / [a]bort:`.

**Before save:**

- `12 libraries → 12 rows. 2 new field types added (logged at end). Save? [Y/n]:`.

## File Plan Mapping (read from workbook)

The tool reads a tab named `File Plan` (case-insensitive match, first one wins) and builds a lookup keyed by the value in the class-code column. It expects columns labeled (or fuzzy-matched):

- Class Code
- Content Type
- Trigger
- Total Retention after Trigger Date

If the File Plan tab is missing or its expected columns can't be located, the tool aborts with a clear error before walking anything.

## Output Behavior

- The workbook is opened, modified in place, saved back to the same path via Excel COM.
- Before saving, write a `.bak` copy alongside (`<name>.xlsm.bak`).
- All other tabs are preserved untouched.
- Within the target tab:
  - Header block (top rows): written or updated per the prompt outcomes. The tool detects the header-block region by scanning column A for `Class Code`; everything above that row is the header block.
  - Data area (every column from A through `Total Retention after Trigger Date`): cleared then rewritten with one row per library.
  - Comments columns (anything with header `IA Review`, `Configuration`, or `StoneShare`): never touched, even on overwrite.
  - The trailing `---Select Class Code--` template row, if present, is preserved at the bottom.
- COM objects are released in `finally` blocks via `[System.Runtime.InteropServices.Marshal]::ReleaseComObject(...)` and `Quit()` so no `EXCEL.EXE` is left running.

## Distribution & Iteration Loop

- The deliverable is the single file `Invoke-IAFill.ps1`. No modules folder, no config files.
- Source code lives in a private repo (host TBD by the team).
- Released script is dropped into a shared SharePoint location the team syncs via OneDrive. Teammates copy it onto the client VM as needed.
- When a teammate's run discovers a new metadata field, the script prints (at exit) a "please add to script" block. The teammate edits `$FieldTypes` (and/or `$ExistingColumns`) at the top of the script, commits, and re-syncs to SharePoint.
- Client VMs may have an execution policy that blocks unsigned `.ps1` files. Workaround: launch with `powershell -ExecutionPolicy Bypass -File .\Invoke-IAFill.ps1 ...`. Sign the script if a stricter engagement requires it.

## Testing

- Pester unit tests against synthetic folder fixtures cover the pure-function layer: walk classification, metadata collection across multi-level nesting, slug/grouping derivation, view-combination logic, field-type resolution.
- One integration smoke run is performed manually against a fixture workbook (`tests/fixtures/ia-template.xlsm`) plus a fixture file share — verified by opening the result in Excel and eyeballing.
- COM I/O is **not** tested via Pester; it's exercised by the manual smoke run and by real client engagements (the iteration loop the team prefers).

## Open Questions Deferred to Implementation

- Behavior when a library mixes a sibling normal folder *and* a sibling `(Field=Value)` folder at the same level (e.g., `library/NormalFolder/...` next to `library/(Topic=X)/...`). v1 treats this as a doc-set library where Topic is doc-level metadata; the rules above already produce a sensible answer. Revisit if real data shows otherwise.
- Whether to also generate a Markdown change-log alongside the workbook (which libraries got added/changed). Out of scope for v1.
