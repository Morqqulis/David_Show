'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from '../lib/payload'
import { SAVED_VIEW_LIMIT, type SavedViewSpec } from '../lib/invoice-filters'

/**
 * Personal saved views for the All Requests table.
 *
 * There is no auth layer yet, so the current actor is resolved the same way
 * every other mutation in this app resolves it — by looking up the seeded
 * operator account. Ownership is modelled properly around that single call, so
 * when a session lands the only change needed is what `currentActorId()`
 * returns.
 */
const ACTOR_EMAIL = 'david@aurora.ca'

async function currentActorId(): Promise<string | number> {
  const payload = await getPayload()
  const res = await payload.find({
    collection: 'users',
    where: { email: { equals: ACTOR_EMAIL } } as never,
    limit: 1,
    depth: 0,
  })
  const actor = res.docs[0]?.id
  if (actor == null) {
    console.error('[saved-views] no operator account found', { email: ACTOR_EMAIL })
    throw new Error('No account is available to own this view.')
  }
  return actor
}

function specToData(spec: SavedViewSpec) {
  return {
    stage: spec.stage || 'all',
    columns: spec.columns ?? [],
    columnOrder: spec.columnOrder ?? [],
    filters: spec.filters ?? [],
    sort: spec.sort ?? [],
  }
}

async function assertRoom(ownerId: string | number) {
  const payload = await getPayload()
  const existing = await payload.count({
    collection: 'saved-views' as never,
    where: { owner: { equals: ownerId } } as never,
  })
  if (existing.totalDocs >= SAVED_VIEW_LIMIT) {
    throw new Error(`You already have ${SAVED_VIEW_LIMIT} saved views. Delete one before adding another.`)
  }
}

/** Clear the previous default so a person never has two views claiming to open first. */
async function clearOtherDefaults(ownerId: string | number, keepId: string | number | null) {
  const payload = await getPayload()
  const current = await payload.find({
    collection: 'saved-views' as never,
    where: { and: [{ owner: { equals: ownerId } }, { isDefault: { equals: true } }] } as never,
    limit: SAVED_VIEW_LIMIT,
    depth: 0,
  })
  await Promise.all(
    (current.docs as Array<{ id: string | number }>)
      .filter((doc) => keepId == null || String(doc.id) !== String(keepId))
      .map((doc) =>
        payload.update({
          collection: 'saved-views' as never,
          id: doc.id as never,
          data: { isDefault: false } as never,
        }),
      ),
  )
}

export async function createSavedView(name: string, spec: SavedViewSpec): Promise<{ id: string | number }> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Give the view a name before saving it.')
  const payload = await getPayload()
  const owner = await currentActorId()
  await assertRoom(owner)
  const created = (await payload.create({
    collection: 'saved-views' as never,
    data: { name: trimmed, owner, isDefault: false, ...specToData(spec) } as never,
  })) as unknown as { id: string | number }
  revalidatePath('/requests')
  return { id: created.id }
}

/** Overwrite a view with the arrangement currently on screen. */
export async function updateSavedViewSpec(id: string | number, spec: SavedViewSpec) {
  const payload = await getPayload()
  await payload.update({
    collection: 'saved-views' as never,
    id: id as never,
    data: specToData(spec) as never,
  })
  revalidatePath('/requests')
}

export async function renameSavedView(id: string | number, name: string) {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('A view needs a name.')
  const payload = await getPayload()
  await payload.update({
    collection: 'saved-views' as never,
    id: id as never,
    data: { name: trimmed } as never,
  })
  revalidatePath('/requests')
}

export async function duplicateSavedView(id: string | number): Promise<{ id: string | number }> {
  const payload = await getPayload()
  const owner = await currentActorId()
  await assertRoom(owner)
  const source = (await payload.findByID({
    collection: 'saved-views' as never,
    id: id as never,
    depth: 0,
  })) as unknown as { name: string } & SavedViewSpec
  const created = (await payload.create({
    collection: 'saved-views' as never,
    data: {
      name: `${source.name} (copy)`,
      owner,
      isDefault: false,
      ...specToData(source),
    } as never,
  })) as unknown as { id: string | number }
  revalidatePath('/requests')
  return { id: created.id }
}

export async function deleteSavedView(id: string | number) {
  const payload = await getPayload()
  await payload.delete({ collection: 'saved-views' as never, id: id as never })
  revalidatePath('/requests')
}

/** Mark a view as the one that opens on arrival, or clear the current default. */
export async function setDefaultSavedView(id: string | number | null) {
  const payload = await getPayload()
  const owner = await currentActorId()
  await clearOtherDefaults(owner, id)
  if (id != null) {
    await payload.update({
      collection: 'saved-views' as never,
      id: id as never,
      data: { isDefault: true } as never,
    })
  }
  revalidatePath('/requests')
}

/**
 * Publish a view to roles. Recipients can open it but not change it; the view
 * keeps its original owner, so there is no transfer of ownership to reason
 * about. Passing an empty list un-publishes.
 */
export async function publishSavedViewToRoles(id: string | number, roleIds: Array<string | number>) {
  const payload = await getPayload()
  await payload.update({
    collection: 'saved-views' as never,
    id: id as never,
    data: { publishedToRoles: roleIds } as never,
  })
  revalidatePath('/requests')
}
