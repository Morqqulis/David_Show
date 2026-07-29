import { getPayload } from '@/backend/lib/payload'
import { loadEmailWrapper } from '@/backend/actions/email-actions'
import { TemplatesWorkshop } from '@/components/app/email/templates-workshop'
import type { TemplateDraft } from '@/components/app/email/template-editor'

export const dynamic = 'force-dynamic'

type TemplateDoc = {
  id: string | number
  name?: string | null
  subject?: string | null
  bodyHtml?: string | null
  description?: string | null
  enabled?: boolean | null
}

export default async function TemplatesPage() {
  const payload = await getPayload()
  const [res, wrapper] = await Promise.all([
    payload.find({ collection: 'email-templates', limit: 50, depth: 0 }),
    loadEmailWrapper(),
  ])

  const templates: TemplateDraft[] = (res.docs as TemplateDoc[]).map((doc) => ({
    id: doc.id,
    name: doc.name ?? '',
    subject: doc.subject ?? '',
    bodyHtml: doc.bodyHtml ?? '',
    description: doc.description ?? '',
    enabled: doc.enabled ?? true,
  }))

  return <TemplatesWorkshop templates={templates} wrapper={wrapper} />
}
