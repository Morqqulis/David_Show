'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from '../../lib/payload'
import { recordAudit } from '../../lib/stage-engine'
import { defaultActorId } from './_helpers'

export async function postComment(invoiceId: string | number, body: string) {
  const payload = await getPayload()
  const actorId = await defaultActorId()
  if (!actorId) return
  await payload.create({
    collection: 'invoice-comments',
    data: { invoice: invoiceId as never, author: actorId as never, body } as never,
  })
  await recordAudit({ payload, invoiceId, actorId, action: 'comment_added' })
  revalidatePath(`/requests/${invoiceId}`)
}
