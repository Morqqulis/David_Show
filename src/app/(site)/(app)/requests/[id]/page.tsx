import { notFound, redirect } from 'next/navigation'
import { Topbar } from '@/components/app/topbar'
import { InvoiceView } from '@/components/app/invoice-view'
import { getInvoiceWithLines } from '@/backend/lib/queries'

export const dynamic = 'force-dynamic'

const VALID_TABS = ['header', 'files', 'notes', 'log'] as const
type ValidTab = (typeof VALID_TABS)[number]

function resolveTab(raw: string | string[] | undefined): ValidTab {
  if (typeof raw !== 'string') return 'header'
  return (VALID_TABS as readonly string[]).includes(raw) ? (raw as ValidTab) : 'header'
}

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string | string[] }>
}) {
  const { id } = await params
  const { tab: rawTab } = await searchParams

  // Coding has its own page (different layout, full editor). Tab is rendered
  // here for visual continuity but a direct ?tab=coding deep link still routes
  // to the editor so external bookmarks behave consistently.
  if (rawTab === 'coding') redirect(`/requests/${id}/coding`)

  let data: Awaited<ReturnType<typeof getInvoiceWithLines>> | null = null
  try {
    data = await getInvoiceWithLines(id)
  } catch (err) {
    console.error('[InvoicePage] failed to load invoice', id, err)
    throw err
  }
  if (!data || !data.invoice) notFound()
  const invoice = data.invoice as { invoiceNumber: string }
  return (
    <>
      <Topbar
        crumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Requests', href: '/requests' },
          { label: invoice.invoiceNumber },
        ]}
      />
      <main className="flex flex-1 flex-col gap-3 overflow-hidden p-6">
        <InvoiceView
          data={{
            invoice: data.invoice as never,
            lines: data.lines as never,
            comments: data.comments as never,
            audit: data.audit as never,
            documents: data.documents as never,
            defaultTab: resolveTab(rawTab),
          }}
        />
      </main>
    </>
  )
}
