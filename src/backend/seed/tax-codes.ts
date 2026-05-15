import type { Payload } from 'payload'
import type { Id } from './types'

export async function seedTaxCodes(payload: Payload, gls: Array<{ id: Id; code: string }>) {
  const apControl = gls.find((g) => g.code === '05-9100-CTRL-2010')!.id
  const recoverable = gls.find((g) => g.code === '05-9100-CTRL-1450')!.id
  const data = [
    { code: 'HST-ON-PSB', label: 'HST Ontario — PSB Rebate', rate: 0.13, recoverablePct: 0.78, recoverableGl: recoverable, apControlGl: apControl },
    { code: 'HST-ON-FULL', label: 'HST Ontario — Fully Recoverable', rate: 0.13, recoverablePct: 1.0, recoverableGl: recoverable, apControlGl: apControl },
    { code: 'HST-ON-NONE', label: 'HST Ontario — Non Recoverable', rate: 0.13, recoverablePct: 0, recoverableGl: recoverable, apControlGl: apControl },
    { code: 'EXEMPT', label: 'Tax Exempt', rate: 0, recoverablePct: 0, recoverableGl: recoverable, apControlGl: apControl },
  ]
  return Promise.all(data.map((t) => payload.create({ collection: 'tax-codes', data: t as never })))
}
