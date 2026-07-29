import type { Payload } from 'payload'
import { DEFAULT_EMAIL_WRAPPER } from '../lib/email-render'

/**
 * Creates the single email-settings row that holds the sender identity and the
 * header/footer wrapped around every template body. Seeded from the same
 * defaults the app falls back to when the row is missing, so a seeded database
 * and a fresh one preview identical emails.
 */
export async function seedEmailSettings(payload: Payload) {
  return payload.create({
    collection: 'email-settings' as never,
    data: { ...DEFAULT_EMAIL_WRAPPER } as never,
  })
}
