import { ConfigStub } from '@/components/app/settings/config-stub'

export default function EmailSettingsPage() {
  return (
    <ConfigStub
      title="Email Settings"
      description="App-wide sender + delivery configuration. All templates inherit these."
      fields={[
        { label: 'From email', value: 'ap@aurora.ca' },
        { label: 'From display name', value: 'City of Aurora — Accounts Payable' },
        { label: 'Reply-To', value: 'ap@aurora.ca' },
        { label: 'SMTP relay', value: 'Microsoft 365', hint: 'options: M365 / SendGrid / SES / Custom' },
        { label: 'Daily send cap', value: '2,000' },
        { label: 'Retry attempts on send failure', value: '3' },
        { label: 'Bounce notification address', value: 'ap-admin@aurora.ca' },
      ]}
    />
  )
}
