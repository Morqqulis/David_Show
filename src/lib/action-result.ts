/**
 * How a server action tells the person on screen that it refused.
 *
 * Next.js replaces the message of any error thrown out of a server action with
 * a generic notice in a production build, so internals cannot leak. That is
 * correct for a fault and wrong for "enter the mailbox address first": on the
 * deployed demo a wall of technical text appeared where an instruction belonged,
 * and the coding gate's admin-configured block message — the one the spec asks
 * for by name — was replaced the same way.
 *
 * So the two kinds of failure are separated.
 *
 * - A **fault** (bad data, a missing row, a broken invariant) still throws and
 *   is still redacted. Nobody outside the team should read it.
 * - An **expected refusal** is thrown as {@link UserFacingError}, caught by
 *   {@link guard} and handed back as a RETURNED value. The framework never
 *   rewrites a return value, so the words reach the browser intact.
 *
 * {@link unwrap} turns the returned refusal back into an exception in the
 * browser, which is what lets existing `try { … } catch (err) { toast(err.message) }`
 * call sites keep reading exactly as they did.
 *
 * This module is deliberately dependency-free so it can be imported from a
 * server action, a client component and a test alike.
 */

/** A refusal written for the person on screen. Its words are meant to survive. */
export class UserFacingError extends Error {
  /**
   * Duplicated as a plain property because `instanceof` is unreliable if this
   * module is ever evaluated twice (separate server and client bundles, or a
   * test importing a fresh copy). The flag survives any of that.
   */
  readonly isUserFacing = true

  constructor(message: string) {
    super(message)
    this.name = 'UserFacingError'
  }
}

export function isUserFacingError(err: unknown): err is UserFacingError {
  if (err instanceof UserFacingError) return true
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { isUserFacing?: unknown }).isUserFacing === true &&
    typeof (err as { message?: unknown }).message === 'string'
  )
}

/** What a guarded server action hands back. */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string }

/**
 * Runs an action body and converts an expected refusal into a returned value.
 *
 * Anything that is not a {@link UserFacingError} is rethrown untouched — that
 * covers genuine faults, which should stay redacted, and the control-flow
 * exceptions Next.js itself throws for `redirect()` and `notFound()`, which
 * must never be swallowed.
 */
export async function guard<T>(run: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await run() }
  } catch (err) {
    if (isUserFacingError(err)) return { ok: false, message: err.message }
    throw err
  }
}

/**
 * Reads a guarded result, throwing the refusal message as an ordinary browser
 * error. Call it at the call site so the surrounding try/catch keeps working.
 */
export function unwrap<T>(result: ActionResult<T>): T {
  if (result.ok) return result.data
  throw new Error(result.message)
}
