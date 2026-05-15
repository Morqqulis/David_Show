import { notFound } from 'next/navigation'
import { Topbar } from '@/components/app/topbar'
import { CodingScreen } from '@/components/app/coding-screen'
import { getInvoiceWithLines } from '@/backend/lib/queries'
import { getPayload } from '@/backend/lib/payload'

export const dynamic = 'force-dynamic'

export default async function CodingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let data: Awaited<ReturnType<typeof getInvoiceWithLines>> | null = null
  try {
    data = await getInvoiceWithLines(id)
  } catch (err) {
    console.error('[CodingPage] failed to load invoice', id, err)
    throw err
  }
  if (!data || !data.invoice) notFound()
  const invoice = data.invoice as { invoiceNumber: string }

  const payload = await getPayload()
  const [gls, taxCodes, costCenters, projects, funds] = await Promise.all([
    payload.find({ collection: 'gl-accounts', limit: 200, depth: 0 }),
    payload.find({ collection: 'tax-codes', limit: 50, depth: 0 }),
    payload.find({ collection: 'dimensions', where: { kind: { equals: 'cost_center' } } as never, limit: 200, depth: 0 }),
    payload.find({ collection: 'dimensions', where: { kind: { equals: 'project' } } as never, limit: 200, depth: 0 }),
    payload.find({ collection: 'dimensions', where: { kind: { equals: 'fund' } } as never, limit: 200, depth: 0 }),
  ])

  return (
    <>
      <Topbar
        crumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Requests', href: '/requests' },
          { label: invoice.invoiceNumber, href: `/requests/${id}` },
          { label: 'Coding' },
        ]}
      />
      <main className="flex flex-1 flex-col gap-3 overflow-hidden p-6">
        <CodingScreen
          invoice={data.invoice as never}
          lines={data.lines as never}
          documents={data.documents as never}
          options={{
            gls: gls.docs as never,
            taxCodes: taxCodes.docs as never,
            costCenters: costCenters.docs as never,
            projects: projects.docs as never,
            funds: funds.docs as never,
          }}
        />
      </main>
    </>
  )
}
