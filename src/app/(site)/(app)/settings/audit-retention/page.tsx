import { ConfigStub } from '@/components/app/settings/config-stub'

export default function AuditRetentionPage() {
  return (
    <ConfigStub
      title="Audit Retention"
      description="How long audit events are retained. Aligned with municipal records-retention bylaws."
      fields={[
        { label: 'Retention period', value: '7 years', hint: 'configurable per client' },
        { label: 'Event scope', value: 'Action-based (approve, reject, batch, archive, etc.) — no field-level edits' },
        { label: 'Storage', value: 'Same database, audit_events table' },
      ]}
    />
  )
}
