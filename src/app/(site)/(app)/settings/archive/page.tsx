import { ConfigStub } from '@/components/app/settings/config-stub'

export default function ArchivePage() {
  return (
    <ConfigStub
      title="Archive"
      description="SharePoint archive triggered when an invoice enters Completed. Document Set inherits the library's retention label."
      fields={[
        { label: 'SharePoint library', value: 'https://aurora.sharepoint.com/sites/Finance/Archived%20AP' },
        { label: 'Document Set name pattern', value: '{Vendor}_{InvoiceNumber}_{InvoiceDate}' },
        { label: 'Retry attempts', value: '5', hint: '1m, 5m, 30m, 1h, 6h' },
        { label: 'On failure', value: 'Flag "Archive Failed" + notify admin' },
      ]}
    />
  )
}
