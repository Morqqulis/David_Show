import { getPayload as getPayloadCore } from 'payload'
import config from '../../payload.config'

let cached: Awaited<ReturnType<typeof getPayloadCore>> | null = null

export async function getPayload() {
  if (cached) return cached
  cached = await getPayloadCore({ config })
  return cached
}
