import { ConfigStub } from '@/components/app/settings/config-stub'

export default function DuplicateDetectionPage() {
  return (
    <ConfigStub
      title="Duplicate Detection"
      description="Match rule used when invoices arrive — if the rule matches an existing invoice, the on-match action fires."
      fields={[
        { label: 'Match rule', value: 'Invoice # + Vendor + Amount', hint: 'default' },
        { label: 'On match action', value: 'Flag (persistent banner on invoice)', hint: 'options: warn / flag / block' },
        { label: 'Block destination', value: '"Blocked Duplicates" admin view', hint: 'used when action = block' },
      ]}
    />
  )
}
