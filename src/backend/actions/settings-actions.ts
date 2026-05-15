'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from '../lib/payload'

export async function updateStage(id: string | number, patch: Record<string, unknown>) {
  const payload = await getPayload()
  await payload.update({ collection: 'stages', id: id as never, data: patch as never })
  revalidatePath('/settings/workflow')
}

export async function upsertField(id: string | number | null, patch: Record<string, unknown>) {
  const payload = await getPayload()
  if (id) {
    await payload.update({ collection: 'fields', id: id as never, data: patch as never })
  } else {
    await payload.create({ collection: 'fields', data: patch as never })
  }
  revalidatePath('/settings/fields')
}

export async function deleteField(id: string | number) {
  const payload = await getPayload()
  await payload.delete({ collection: 'fields', id: id as never })
  revalidatePath('/settings/fields')
}

export async function upsertSection(id: string | number | null, patch: Record<string, unknown>) {
  const payload = await getPayload()
  if (id) {
    await payload.update({ collection: 'sections', id: id as never, data: patch as never })
  } else {
    await payload.create({ collection: 'sections', data: patch as never })
  }
  revalidatePath('/settings/sections')
}

export async function deleteSection(id: string | number) {
  const payload = await getPayload()
  await payload.delete({ collection: 'sections', id: id as never })
  revalidatePath('/settings/sections')
}

export async function upsertRole(id: string | number | null, patch: Record<string, unknown>) {
  const payload = await getPayload()
  if (id) {
    await payload.update({ collection: 'roles', id: id as never, data: patch as never })
  } else {
    await payload.create({ collection: 'roles', data: patch as never })
  }
  revalidatePath('/settings/roles')
}

export async function deleteRole(id: string | number) {
  const payload = await getPayload()
  await payload.delete({ collection: 'roles', id: id as never })
  revalidatePath('/settings/roles')
}

export async function upsertTaxCode(id: string | number | null, patch: Record<string, unknown>) {
  const payload = await getPayload()
  if (id) {
    await payload.update({ collection: 'tax-codes', id: id as never, data: patch as never })
  } else {
    await payload.create({ collection: 'tax-codes', data: patch as never })
  }
  revalidatePath('/settings/tax-codes')
}

export async function deleteTaxCode(id: string | number) {
  const payload = await getPayload()
  await payload.delete({ collection: 'tax-codes', id: id as never })
  revalidatePath('/settings/tax-codes')
}

export async function upsertApprovalRule(id: string | number | null, patch: Record<string, unknown>) {
  const payload = await getPayload()
  if (id) {
    await payload.update({ collection: 'approval-rules', id: id as never, data: patch as never })
  } else {
    await payload.create({ collection: 'approval-rules', data: patch as never })
  }
  revalidatePath('/settings/approval-rules')
}

export async function deleteApprovalRule(id: string | number) {
  const payload = await getPayload()
  await payload.delete({ collection: 'approval-rules', id: id as never })
  revalidatePath('/settings/approval-rules')
}

export async function upsertDepartment(id: string | number | null, patch: Record<string, unknown>) {
  const payload = await getPayload()
  if (id) {
    await payload.update({ collection: 'departments', id: id as never, data: patch as never })
  } else {
    await payload.create({ collection: 'departments', data: patch as never })
  }
  revalidatePath('/settings/departments')
}

export async function deleteDepartment(id: string | number) {
  const payload = await getPayload()
  await payload.delete({ collection: 'departments', id: id as never })
  revalidatePath('/settings/departments')
}

export async function upsertEmailTemplate(id: string | number | null, patch: Record<string, unknown>) {
  const payload = await getPayload()
  if (id) {
    await payload.update({ collection: 'email-templates', id: id as never, data: patch as never })
  } else {
    await payload.create({ collection: 'email-templates', data: patch as never })
  }
  revalidatePath('/email/templates')
}

export async function deleteEmailTemplate(id: string | number) {
  const payload = await getPayload()
  await payload.delete({ collection: 'email-templates', id: id as never })
  revalidatePath('/email/templates')
}

export async function upsertEmailTrigger(id: string | number | null, patch: Record<string, unknown>) {
  const payload = await getPayload()
  if (id) {
    await payload.update({ collection: 'email-triggers', id: id as never, data: patch as never })
  } else {
    await payload.create({ collection: 'email-triggers', data: patch as never })
  }
  revalidatePath('/email/triggers')
}

export async function deleteEmailTrigger(id: string | number) {
  const payload = await getPayload()
  await payload.delete({ collection: 'email-triggers', id: id as never })
  revalidatePath('/email/triggers')
}
