import { NextResponse } from 'next/server'
import { getPayload } from '@/backend/lib/payload'
import { seedAll } from '@/backend/seed'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: Request) {
  const url = new URL(req.url)
  const reset = url.searchParams.get('reset') !== 'false'
  const payload = await getPayload()
  const result = await seedAll(payload, { reset })
  return NextResponse.json(result)
}

export async function GET(req: Request) {
  return POST(req)
}
