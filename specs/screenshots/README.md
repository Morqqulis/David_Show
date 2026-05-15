# Handoff Screenshots

Drop PNG screenshots of each app screen here. The handoff document
(`2026-05-13-municipal-ap-invoice-handoff.html`) automatically picks
them up by filename when printing to PDF.

## Naming convention

One file per route, named `<route>.png`. Required filenames:

| Filename | Mockup route |
|---|---|
| `home.png` | `#home` |
| `all-requests.png` | `#all-requests` |
| `to-be-assigned.png` | `#to-be-assigned` |
| `to-be-coded.png` | `#to-be-coded` |
| `conditional-approvals.png` | `#conditional-approvals` |
| `ap-review.png` | `#ap-review` |
| `ready-for-processing.png` | `#ready-for-processing` |
| `processed.png` | `#processed` |
| `treasurer-review.png` | `#treasurer-review` |
| `completed.png` | `#completed` |
| `invoice.png` | `#invoice` |
| `coding.png` | `#coding` |
| `create-invoice.png` | `#create-invoice` |
| `email.png` | `#email` (used for all three Email tabs — capture each tab and pick the one you want, or rename per tab) |
| `settings.png` | `#settings` (used for all Settings tab variants — same note as Email) |
| `deleted-records.png` | `#deleted-records` |
| `archive-failures.png` | `#archive-failures` |

## How to capture

1. Open `2026-05-13-municipal-ap-invoice-mockup.html` in a browser.
2. Navigate to the route (the URL hash will reflect it, e.g.,
   `...mockup.html#home`).
3. For Settings/Email tabs: click the tab you want to capture.
4. Take a screenshot of the viewport (Cmd+Shift+4 on macOS for a
   region grab; for a full-page screenshot use Chrome's DevTools
   command palette → "Capture full size screenshot").
5. Save as PNG with the matching filename in this folder.

The handoff doc will detect the file the next time it's loaded — no
manual edits needed. Routes without a screenshot show a "Screenshot
pending" placeholder in the printed PDF.
