import { ConfigStub } from '@/components/app/settings/config-stub'

export default function OcrPage() {
  return (
    <ConfigStub
      title="OCR"
      description="AI Builder fields extracted from inbound email attachments. Configurable per client."
      fields={[
        { label: 'Extracted fields', value: 'invoiceNumber, vendor, invoiceDate, dueDate, subtotal, totalTax, grandTotal, fiscalYear' },
        { label: 'Vendor match', value: 'Auto-populate against synced vendor list', hint: 'confidence threshold = 0.8' },
        { label: 'On low confidence', value: 'Auto-flag for AP attention' },
        { label: 'On OCR failure', value: '"OCR Failed" flag on To Be Assigned' },
      ]}
    />
  )
}
