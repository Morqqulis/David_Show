import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getPayload } from '@/backend/lib/payload'
import { TaxCodesCrud } from '@/components/app/settings/tax-codes-crud'

export const dynamic = 'force-dynamic'

export default async function TaxCodesPage() {
  const payload = await getPayload()
  const codes = await payload.find({ collection: 'tax-codes', limit: 50, depth: 1 })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tax Codes</CardTitle>
        <CardDescription>
          Configure recoverable PSB rates and GL mappings. The system computes tax, recoverable, and non-recoverable on every coded line.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TaxCodesCrud rows={codes.docs as never} />
      </CardContent>
    </Card>
  )
}
