import { notFound } from 'next/navigation'
import { Topbar } from '@/components/app/topbar'
import { InvoiceView } from '@/components/app/invoice-view'
import { getInvoiceWithLines } from '@/backend/lib/queries'

export const dynamic = 'force-dynamic'

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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
            defaultTab: 'header',
          }}
        />
      </main>
    </>
  )
}
