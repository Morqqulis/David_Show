'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from '../lib/payload'
import { REASON_SCOPES, type ReasonScope } from '../collections/ActionReasons'

/**
 * The reason lists behind Reassign, Reject and Cancel: one mechanism, three
 * scopes. Reads feed the pickers on the invoice screens; writes come from
 * Settings → Reasons.
 *
 * The `action-reasons` collection is registered at integration, so Payload's
 * generated types do not know the slug yet. The `as never` casts below are the
 * same escape hatch every other collection call in this codebase uses.
 */

export type ReasonOption = {
  id: string | number
  label: string
  /** The built-in Other row: reveals a free-text line and cannot be deleted. */
  isOther: boolean
  active: boolean
  order: number
}

export type ReasonList = {
  scope: ReasonScope
  /** Whether the action refuses to complete without a reason. */
  required: boolean
  options: ReasonOption[]
}

type ReasonDoc = {
  id: string | number
  scope: ReasonScope
  kind: 'reason' | 'policy'
  label?: string | null
  order?: number | null
  active?: boolean | null
  isOther?: boolean | null
  reasonRequired?: boolean | null
}

async function findScopeDocs(scope: ReasonScope): Promise<ReasonDoc[]> {
  const payload = await getPayload()
  const res = await payload.find({
    collection: 'action-reasons' as never,
    where: { scope: { equals: scope } } as never,
    limit: 200,
    sort: 'order',
  })
  return res.docs as unknown as ReasonDoc[]
}

function shape(docs: ReasonDoc[], scope: ReasonScope, includeInactive: boolean): ReasonList {
  const policy = docs.find((d) => d.kind === 'policy')
  const options = docs
    .filter((d) => d.kind !== 'policy' && (includeInactive || d.active !== false))
    .map<ReasonOption>((d) => ({
      id: d.id,
      label: d.label ?? '',
      isOther: d.isOther === true,
      active: d.active !== false,
      order: d.order ?? 0,
    }))
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
  return { scope, required: policy?.reasonRequired === true, options }
}

/** The list a picker shows: active options only. */
export async function fetchReasonList(scope: ReasonScope): Promise<ReasonList> {
  return shape(await findScopeDocs(scope), scope, false)
}

/** Every list including switched-off options, for the settings screen. */
export async function fetchAllReasonLists(): Promise<ReasonList[]> {
  const lists: ReasonList[] = []
  for (const scope of REASON_SCOPES) {
    lists.push(shape(await findScopeDocs(scope), scope, true))
  }
  return lists
}

/**
 * Turns a picked reason into the sentence stored on the invoice and in the
 * audit trail. Returns null when nothing was given and nothing was demanded;
 * throws when the scope's policy demands one, so a client that forgets to
 * validate cannot skip the requirement.
 */
export async function resolveReasonText(
  scope: ReasonScope,
  reasonId: string | number | null,
  otherText?: string,
): Promise<string | null> {
  const list = shape(await findScopeDocs(scope), scope, true)
  const detail = (otherText ?? '').trim()

  if (!reasonId) {
    if (list.required) throw new Error('A reason is required before this can be saved.')
    return detail.length > 0 ? detail : null
  }

  const option = list.options.find((o) => String(o.id) === String(reasonId))
  if (!option) {
    console.error('[reasons] a reason was submitted that is not on the list', { scope, reasonId })
    throw new Error('That reason is no longer available. Pick another one.')
  }
  if (option.isOther) {
    if (detail.length === 0) throw new Error('Type the reason in the box before saving.')
    return `${option.label} — ${detail}`
  }
  return option.label
}

type UpsertResult = { id: string | number }

/** Create or edit one reason option. Mirrors the `upsert*` contract in settings-actions. */
export async function upsertReason(
  id: string | number | null,
  patch: Record<string, unknown>,
): Promise<UpsertResult> {
  const payload = await getPayload()
  const label = typeof patch.label === 'string' ? patch.label.trim() : ''
  if (id === null && label.length === 0) throw new Error('Give the reason a name before saving it.')
  if ('label' in patch && label.length === 0) throw new Error('A reason cannot have an empty name.')

  // `isOther` and `kind` are never client-settable: a second Other row, or an
  // option masquerading as the scope policy, would corrupt the list quietly.
  // Built by naming what is allowed through rather than by removing keys, so a
  // field added later is excluded until somebody decides otherwise.
  const data: Record<string, unknown> = {}
  if (typeof patch.scope === 'string') data.scope = patch.scope
  if (patch.order !== undefined) data.order = Number(patch.order) || 0
  if (patch.active !== undefined) data.active = patch.active === true
  if (label.length > 0) data.label = label

  if (id) {
    await payload.update({ collection: 'action-reasons' as never, id: id as never, data: data as never })
    revalidatePath('/settings/reasons')
    return { id }
  }
  const created = (await payload.create({
    collection: 'action-reasons' as never,
    data: { ...data, kind: 'reason', isOther: false } as never,
  })) as unknown as { id: string | number }
  revalidatePath('/settings/reasons')
  return { id: created.id }
}

/** Delete one reason option. Other is permanent and is refused here. */
export async function deleteReason(id: string | number): Promise<void> {
  const payload = await getPayload()
  const doc = (await payload.findByID({
    collection: 'action-reasons' as never,
    id: id as never,
  })) as unknown as ReasonDoc
  if (doc?.isOther) {
    console.error('[reasons] refused to delete the built-in Other option', { id })
    throw new Error('Other is built in and cannot be removed. Switch it off instead.')
  }
  if (doc?.kind === 'policy') {
    console.error('[reasons] refused to delete a scope policy row', { id })
    throw new Error('That row holds the setting for this list and cannot be removed.')
  }
  await payload.delete({ collection: 'action-reasons' as never, id: id as never })
  revalidatePath('/settings/reasons')
}

/** Switch "a reason is required" on or off for one action. */
export async function setReasonRequired(scope: ReasonScope, required: boolean): Promise<void> {
  const payload = await getPayload()
  const docs = await findScopeDocs(scope)
  const policy = docs.find((d) => d.kind === 'policy')
  if (policy) {
    await payload.update({
      collection: 'action-reasons' as never,
      id: policy.id as never,
      data: { reasonRequired: required } as never,
    })
  } else {
    // A scope seeded before this setting existed, or a hand-built database.
    // Creating the row on demand is cheaper than making every reader cope with
    // its absence forever.
    await payload.create({
      collection: 'action-reasons' as never,
      data: { scope, kind: 'policy', order: 0, active: true, reasonRequired: required } as never,
    })
  }
  revalidatePath('/settings/reasons')
}
