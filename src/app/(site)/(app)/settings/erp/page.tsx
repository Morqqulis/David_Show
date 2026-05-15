import { ConfigStub } from '@/components/app/settings/config-stub'

export default function ErpPage() {
  return (
    <ConfigStub
      title="ERP Sync"
      description="Read-only sync of Vendors, GL Accounts, Cost Centers, Projects, Funds, Tax Codes."
      fields={[
        { label: 'Mode', value: 'Real-time (cloud ERP)', hint: 'on-prem ERP → nightly schedule' },
        { label: 'Endpoint', value: 'https://erp.aurora.ca/api/v2/' },
        { label: 'Auth', value: 'Service principal (managed identity)' },
        { label: 'Entities synced', value: 'Vendors · GL Accounts · Cost Centers · Projects · Funds · Tax Codes' },
        { label: 'Last sync', value: '2026-05-13 06:00 UTC (auto)' },
      ]}
    />
  )
}
