import { describe, expect, it } from 'bun:test'
import { guard, isUserFacingError, unwrap, UserFacingError } from './action-result'

describe('UserFacingError', () => {
  it('carries its message', () => {
    expect(new UserFacingError('Enter the mailbox address first.').message).toBe(
      'Enter the mailbox address first.',
    )
  })

  it('is recognised across module copies via the flag, not only instanceof', () => {
    // Stands in for the same class evaluated twice in separate bundles.
    const lookalike = Object.assign(new Error('Pick a reason first.'), { isUserFacing: true })
    expect(isUserFacingError(lookalike)).toBe(true)
  })

  it('does not mistake an ordinary error for a refusal', () => {
    expect(isUserFacingError(new Error('connection reset'))).toBe(false)
    expect(isUserFacingError(null)).toBe(false)
    expect(isUserFacingError('Invoice needs to be fully coded.')).toBe(false)
    expect(isUserFacingError({ isUserFacing: true })).toBe(false)
  })
})

describe('guard', () => {
  it('hands back the value on success', async () => {
    expect(await guard(async () => ({ id: 7 }))).toEqual({ ok: true, data: { id: 7 } })
  })

  it('turns a refusal into a returned message, which the framework cannot rewrite', async () => {
    const result = await guard(async () => {
      throw new UserFacingError('Invoice needs to be fully coded.')
    })
    expect(result).toEqual({ ok: false, message: 'Invoice needs to be fully coded.' })
  })

  it('rethrows a genuine fault so it stays redacted', async () => {
    const fault = new Error('relation "invoices" does not exist')
    expect(guard(async () => { throw fault })).rejects.toBe(fault)
  })

  it('rethrows the control-flow errors redirect() and notFound() rely on', async () => {
    const redirect = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;push;/login;307;' })
    expect(guard(async () => { throw redirect })).rejects.toBe(redirect)
  })

  it('preserves a falsy success value rather than reading it as failure', async () => {
    expect(await guard(async () => undefined)).toEqual({ ok: true, data: undefined })
    expect(await guard(async () => false)).toEqual({ ok: true, data: false })
  })
})

describe('unwrap', () => {
  it('returns the value on success', () => {
    expect(unwrap({ ok: true, data: { id: 3 } })).toEqual({ id: 3 })
  })

  it('throws the refusal message verbatim so a catch block can show it', () => {
    expect(() => unwrap({ ok: false, message: 'Give the view a name before saving it.' })).toThrow(
      'Give the view a name before saving it.',
    )
  })

  it('round-trips a refusal from action body to call site', async () => {
    const action = async () =>
      guard(async () => {
        throw new UserFacingError('You already have 10 saved views. Delete one before adding another.')
      })

    let seen = ''
    try {
      unwrap(await action())
    } catch (err) {
      seen = err instanceof Error ? err.message : 'not an error'
    }
    expect(seen).toBe('You already have 10 saved views. Delete one before adding another.')
  })
})
