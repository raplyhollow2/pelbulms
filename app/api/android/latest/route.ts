import { NextResponse } from 'next/server'
import { getAndroidRelease } from '@/lib/android-release'

export const dynamic = 'force-dynamic'

export async function GET() {
  const release = await getAndroidRelease()
  return NextResponse.json(release, {
    status: release.available ? 200 : 404,
    headers: { 'Cache-Control': 'public, max-age=60' },
  })
}
