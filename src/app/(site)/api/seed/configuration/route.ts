import { NextResponse } from 'next/server'
import { getPayload } from '@/backend/lib/payload'
import { seedConfiguration } from '@/backend/seed/configuration'

/**
 * Fills empty configuration tables without clearing anything.
 *
 * Separate from `/api/seed`, which rebuilds the whole database. That one is for
 * a fresh environment; this one is for an environment that already holds
 * invoices somebody needs to keep. Safe to call twice — every step skips when
 * the table it fills already has a row.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST() {
  const payload = await getPayload()
  try {
    const result = await seedConfiguration(payload)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[seed-configuration] failed', { err })
    return NextResponse.json(
      { error: 'Configuration seeding failed. Nothing was cleared.' },
      { status: 500 },
    )
  }
}

export async function GET() {
  return POST()
}
