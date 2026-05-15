import type { Payload } from 'payload'
import type { Id } from './types'

export async function seedEmailTriggers(
  payload: Payload,
  templates: Array<{ id: Id; name: string }>,
  stages: Array<{ id: Id; systemId: string }>,
  roles: Array<{ id: Id; name: string }>,
) {
  const t = (n: string) => templates.find((x) => x.name === n)!.id
  const s = (n: string) => stages.find((x) => x.systemId === n)!.id
  const r = (n: string) => roles.find((x) => x.name === n)!.id

  const data = [
    {
      name: 'Coding assignment → assignee',
      event: 'submission',
      stage: s('to_be_coded'),
      template: t('Coding Assignment'),
      recipients: [{ type: 'dynamic', dynamicKey: 'assignee' }],
      enabled: true,
    },
    {
      name: 'Approval @ AP Review → AP Clerk team',
      event: 'approval',
      stage: s('ap_review'),
      template: t('Approval Notification'),
      recipients: [{ type: 'role', role: r('AP Clerk') }],
      enabled: true,
    },
    {
      name: 'Rejection → submitter + AP supervisor',
      event: 'rejection',
      template: t('Rejection Notice'),
      recipients: [
        { type: 'dynamic', dynamicKey: 'submitter' },
        { type: 'role', role: r('AP Supervisor') },
      ],
      enabled: true,
    },
    {
      name: 'Batch applied → treasurer',
      event: 'batch_applied',
      template: t('Batch Applied — Treasurer Heads-up'),
      recipients: [{ type: 'role', role: r('Treasurer') }],
      enabled: true,
    },
    {
      name: 'Archive failed → admins',
      event: 'archive_failed',
      template: t('Archive Failure'),
      recipients: [{ type: 'role', role: r('Admin') }],
      enabled: true,
    },
  ]
  return Promise.all(data.map((d) => payload.create({ collection: 'email-triggers', data: d as never })))
}
