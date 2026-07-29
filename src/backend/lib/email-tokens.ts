import { escapeHtml } from './email-html-sanitize'

/**
 * The single source of truth for `{{Token}}` placeholders in email templates.
 *
 * Before this file the list lived in three places that disagreed with each
 * other (the preview's sample map, a prose sentence on the templates page, and
 * whatever the seed bodies happened to use). Everything — the token palette,
 * the preview resolver and any future sender — now reads from EMAIL_TOKENS.
 *
 * Adding a token: add one entry here. `sample` is what the preview shows, so
 * it should look like real data from this municipality, not "foo".
 */
export type EmailToken = {
  /** Exactly as it appears in a template, braces included. */
  token: string
  /** Short human name for the palette button. */
  label: string
  /** One plain sentence for a finance clerk — never mentions code. */
  description: string
  /** Stand-in value used by the preview. */
  sample: string
}

export const EMAIL_TOKENS: readonly EmailToken[] = [
  {
    token: '{{InvoiceNumber}}',
    label: 'Invoice number',
    description: 'The vendor invoice number, as entered on the invoice.',
    sample: 'INV-77100',
  },
  {
    token: '{{Vendor}}',
    label: 'Vendor',
    description: 'Name of the company that sent the invoice.',
    sample: 'BlueRock Construction Inc.',
  },
  {
    token: '{{Amount}}',
    label: 'Amount',
    description: 'Invoice total, formatted as currency.',
    sample: 'CA$4,861.00',
  },
  {
    token: '{{InvoiceDate}}',
    label: 'Invoice date',
    description: 'Date shown on the vendor invoice.',
    sample: 'May 8, 2026',
  },
  {
    token: '{{DueDate}}',
    label: 'Due date',
    description: 'Date the invoice must be paid by.',
    sample: 'Jun 7, 2026',
  },
  {
    token: '{{Status}}',
    label: 'Status',
    description: 'Where the invoice stands right now, in words.',
    sample: 'Approved',
  },
  {
    token: '{{Stage}}',
    label: 'Stage',
    description: 'The queue the invoice currently sits in.',
    sample: 'AP Review',
  },
  {
    token: '{{Department}}',
    label: 'Department',
    description: 'Department the invoice is charged to.',
    sample: 'Public Works',
  },
  {
    token: '{{BatchNumber}}',
    label: 'Batch number',
    description: 'Batch the invoice was processed in.',
    sample: 'BATCH-2026-W21',
  },
  {
    token: '{{Assignee}}',
    label: 'Assignee',
    description: 'Person the invoice is currently assigned to.',
    sample: 'Jordan Lee',
  },
  {
    token: '{{Approver}}',
    label: 'Approver',
    description: 'Person who approved the invoice.',
    sample: 'Sarah Chen',
  },
  {
    token: '{{Rejecter}}',
    label: 'Rejected by',
    description: 'Person who sent the invoice back.',
    sample: 'Sarah Chen',
  },
  {
    token: '{{RejectReason}}',
    label: 'Rejection reason',
    description: 'The reason typed in when the invoice was sent back.',
    sample: 'Missing PO reference — please add and resubmit.',
  },
  {
    token: '{{Submitter}}',
    label: 'Submitter',
    description: 'Person who first entered or forwarded the invoice.',
    sample: 'Marcus Patel',
  },
  {
    token: '{{Reason}}',
    label: 'Reason given',
    description: 'The reason chosen when the action was taken.',
    sample: 'Out of office',
  },
  {
    token: '{{InvoiceList}}',
    label: 'List of invoices',
    description: 'The invoice numbers this email covers, separated by commas.',
    sample: 'INV-77100, INV-77104, INV-77119',
  },
  {
    token: '{{InvoiceCount}}',
    label: 'How many invoices',
    description: 'How many invoices this email covers.',
    sample: '3',
  },
  {
    token: '{{HeldReason}}',
    label: 'Why it was held',
    description:
      'Plain-language explanation of why an emailed invoice was not accepted automatically.',
    sample:
      'This message came from outside the municipality, and the mailbox is currently set to accept invoices from staff only.',
  },
  {
    token: '{{InvoiceURL}}',
    label: 'Link to invoice',
    description: 'Web address that opens this invoice. Use it as a link target.',
    sample: 'https://auroraap.example.com/requests/INV-77100',
  },
  {
    token: '{{Municipality}}',
    label: 'Municipality',
    description: 'Name of the municipality sending the email.',
    sample: 'City of Aurora',
  },
  {
    token: '{{AppName}}',
    label: 'System name',
    description: 'Name of this application, for sign-offs and footers.',
    sample: 'AuroraAP',
  },
]

/** Matches `{{Name}}` and tolerates the stray spaces people type inside the braces. */
const TOKEN_PATTERN = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g

const TOKEN_SET: ReadonlySet<string> = new Set(EMAIL_TOKENS.map((t) => t.token))

/** Sample values for every known token, keyed by the token text itself. */
export function sampleTokenValues(): Record<string, string> {
  const values: Record<string, string> = {}
  for (const t of EMAIL_TOKENS) values[t.token] = t.sample
  return values
}

/**
 * Substitutes tokens into a string destined for **HTML**.
 *
 * Values are escaped on the way in. That is the whole point: a vendor named
 * `<script>alert(1)</script>` is data, and data must never become markup.
 * A token with no value in `values` is left exactly as it was — a half-filled
 * preview is honest, a silently blanked one is not.
 */
export function resolveTokens(body: string, values: Record<string, string>): string {
  return substitute(body, values, escapeHtml)
}

/**
 * Same substitution for plain-text destinations (the subject line, which React
 * renders as text). No escaping, because there is no markup to break out of.
 */
export function resolveTokensPlain(text: string, values: Record<string, string>): string {
  return substitute(text, values, (v) => v)
}

function substitute(
  input: string,
  values: Record<string, string>,
  transform: (value: string) => string,
): string {
  if (!input) return ''
  return input.replace(TOKEN_PATTERN, (whole, name: string) => {
    const value = values[`{{${name}}}`]
    return value === undefined ? whole : transform(value)
  })
}

/** Tokens used in a template that this registry does not know — i.e. typos. */
export function listUnknownTokens(input: string): string[] {
  if (!input) return []
  const unknown = new Set<string>()
  for (const match of input.matchAll(TOKEN_PATTERN)) {
    const canonical = `{{${match[1]}}}`
    if (!TOKEN_SET.has(canonical)) unknown.add(canonical)
  }
  return [...unknown]
}
