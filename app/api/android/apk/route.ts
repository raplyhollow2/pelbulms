import { NextResponse } from 'next/server'
import { fetchAndroidApk } from '@/lib/android-release'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const result = await fetchAndroidApk()
  if (!result.ok || !result.body) {
    return NextResponse.json(
      { error: result.error || 'Android APK is not available.' },
      { status: result.status },
    )
  }

  return new NextResponse(new Uint8Array(result.body), {
    status: 200,
    headers: {
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
