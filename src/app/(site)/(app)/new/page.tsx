import { Topbar } from '@/components/app/topbar'
import { PageHeader } from '@/components/app/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getPayload } from '@/backend/lib/payload'
import { createInvoiceManual } from '@/backend/actions/create-invoice'

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

        <form action={createInvoiceManual} className="grid max-w-4xl grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Header</CardTitle>
              <CardDescription>Fields exposed here are defined in Settings → Fields.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Field>
                <Label htmlFor="invoiceNumber">Invoice Number *</Label>
                <Input id="invoiceNumber" name="invoiceNumber" required />
              </Field>
              <Field>
                <Label htmlFor="poNumber">PO Number</Label>
                <Input id="poNumber" name="poNumber" />
              </Field>
              <Field className="col-span-2">
                <Label htmlFor="vendor">Vendor</Label>
                <Select name="vendor">
                  <SelectTrigger id="vendor">
                    <SelectValue placeholder="Select vendor…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(vendors.docs as unknown as Array<{ id: string | number; vendorNumber: string; name: string }>).map((v) => (
                      <SelectItem key={String(v.id)} value={String(v.id)}>
                        {v.vendorNumber} — {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <Label htmlFor="invoiceDate">Invoice Date</Label>
                <Input id="invoiceDate" name="invoiceDate" type="date" />
              </Field>
              <Field>
                <Label htmlFor="dueDate">Due Date</Label>
                <Input id="dueDate" name="dueDate" type="date" />
              </Field>
              <Field>
                <Label htmlFor="fiscalYear">Fiscal Year</Label>
                <Input id="fiscalYear" name="fiscalYear" defaultValue={String(new Date().getFullYear())} />
              </Field>
              <Field>
                <Label htmlFor="priority">Priority</Label>
                <Select name="priority">
                  <SelectTrigger id="priority">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {['Low', 'Normal', 'High', 'Urgent'].map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field className="col-span-2 flex flex-row items-center gap-2">
                <Checkbox id="confidential" name="confidential" />
                <Label htmlFor="confidential" className="cursor-pointer text-sm font-normal">
                  Mark as confidential (only Confidential-flag roles will see this invoice)
                </Label>
              </Field>
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Amounts</CardTitle>
              <CardDescription>Lines will refine these — these are the header totals.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <Field>
                <Label htmlFor="subtotal">Subtotal</Label>
                <Input id="subtotal" name="subtotal" type="number" step="0.01" defaultValue={0} />
              </Field>
              <Field>
                <Label htmlFor="totalTax">Total Tax</Label>
                <Input id="totalTax" name="totalTax" type="number" step="0.01" defaultValue={0} />
              </Field>
              <Field>
                <Label htmlFor="grandTotal">Grand Total</Label>
                <Input id="grandTotal" name="grandTotal" type="number" step="0.01" defaultValue={0} />
              </Field>

              <Button type="submit" className="mt-2">
                Create invoice
              </Button>
              <p className="text-xs text-muted-foreground">
                Invoice will be created in <strong>To Be Assigned</strong>.
              </p>
            </CardContent>
          </Card>
        </form>
      </main>
    </>
  )
}

function Field({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>{children}</div>
}
