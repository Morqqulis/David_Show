import { ConfigStub } from '@/components/app/settings/config-stub'

export default function CodingTableSettingsPage() {
  return (
    <ConfigStub
      title="Coding Table"
      description="How the coding table behaves: sum-match validation and computed column visibility."
      fields={[
        { label: 'Sum-match field', value: 'Subtotal', hint: 'options: subtotal / grandTotal / disabled' },
        { label: 'On mismatch', value: 'Block advance past AP Review', hint: 'options: warn / block' },
        { label: 'Tax columns', value: 'Tax $ only', hint: 'options: full / Tax $ only / hidden' },
      ]}
    />
  )
}
