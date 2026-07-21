import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { isCloudinaryConfigured, signedUrl } from '@/lib/cloudinary'

export const runtime = 'nodejs'
// Never cache the proxy response at the edge; access is per-user authenticated.
export const dynamic = 'force-dynamic'

/**
 * GET /api/media/<public_id...>?type=image|video
 *
 * Serves a PRIVATE Cloudinary asset. Requires an authenticated session (this is
 * a closed system, so any signed-in user may view). Instead of redirecting to a
 * signed Cloudinary URL (which would be visible in the browser's Network tab),
 * this route fetches the asset SERVER-SIDE and streams the bytes back through
 * our own domain. The browser only ever sees `/api/media/...`; the underlying
 * Cloudinary URL, signature and account details never leave the server.
 *
 * HTTP Range requests are forwarded so video seeking / progressive playback
 * works exactly like a native file.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ publicId: string[] }> }
) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { publicId } = await params
  const id = (publicId || []).join('/')
  const resourceType =
    request.nextUrl.searchParams.get('type') === 'video' ? 'video' : 'image'

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isCloudinaryConfigured()) {
    return NextResponse.json({ error: 'Media backend not configured' }, { status: 503 })
  }

  if (!id) {
    return NextResponse.json({ error: 'Missing media id' }, { status: 400 })
  }

  const upstreamUrl = signedUrl(id, { resourceType })

  // Forward Range (for video seeking). Avoid forwarding browser Accept for images.
  const forwardHeaders: Record<string, string> = {}
  const range = request.headers.get('range')
  if (range) forwardHeaders['Range'] = range
  if (resourceType === 'video') {
    const accept = request.headers.get('accept')
    if (accept) forwardHeaders['Accept'] = accept
  }

  let upstream: Response
  try {
    upstream = await fetch(upstreamUrl, { headers: forwardHeaders })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch media' }, { status: 502 })
  }

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json(
      { error: 'Media not available' },
      { status: upstream.status === 404 ? 404 : 502 }
    )
  }

  const headers = new Headers()
  const passthrough = [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
    'etag',
    'last-modified',
  ]
  for (const key of passthrough) {
    const value = upstream.headers.get(key)
    if (value) headers.set(key, value)
  }
  headers.set('Cache-Control', 'private, max-age=0, must-revalidate')

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  })
}
