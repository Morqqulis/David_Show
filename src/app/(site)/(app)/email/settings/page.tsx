import { loadEmailWrapper } from '@/backend/actions/email-actions'
import { WrapperSettingsForm } from '@/components/app/email/wrapper-settings-form'

export const dynamic = 'force-dynamic'

export default async function EmailSettingsPage() {
  const wrapper = await loadEmailWrapper()
  return <WrapperSettingsForm initial={wrapper} />
}
