import { Topbar } from '@/components/app/topbar'
import { PageHeader } from '@/components/app/page-header'
import { getPayload } from '@/backend/lib/payload'
import { NewInvoiceForm, type NewInvoiceVendor } from '@/components/app/new-invoice-form'

export const dynamic = 'force-dynamic'

export default async function NewInvoicePage() {
  const payload = await getPayload()
  const vendors = await payload.find({ collection: 'vendors', limit: 200, depth: 0 })

  return (
    <>
      <Topbar
        crumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'New invoice' },
        ]}
      />
      <main className="flex-1 overflow-y-auto p-8 space-y-4">
        <PageHeader
          title="Create invoice"
          description="Manual entry — same lifecycle as email intake, no OCR is run."
        />
        <NewInvoiceForm vendors={vendors.docs as unknown as NewInvoiceVendor[]} />
      </main>
    </>
  )
}
