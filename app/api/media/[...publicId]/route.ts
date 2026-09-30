import { NextRequest, NextResponse } from 'next/server'
import { getCloudinaryAccount, signedUrl } from '@/lib/cloudinary'
import { getRequestUser } from '@/lib/request-user'

export const runtime = 'nodejs'

function isPlayableVideo(response: Response) {
  if (response.status !== 200 && response.status !== 206) return false
  if (response.headers.get('x-cld-error')) return false
  // Fragmented MP4 from an on-the-fly transform advertises accept-ranges: none.
  // The native player cannot start those files.
  if ((response.headers.get('accept-ranges') || '').toLowerCase() === 'none') return false
  const type = (response.headers.get('content-type') || '').toLowerCase()
  if (!type) return true
  if (
    type.includes('mpegurl') ||
    type.startsWith('text/') ||
    type.includes('json') ||
    type.includes('html') ||
    type.includes('xml')
  ) {
    return false
  }
  return type.startsWith('video/') || type.includes('octet-stream') || type.includes('mp4')
}

async function discard(response: Response | null) {
  if (!response?.body) return
  try {
    await response.body.cancel()
  } catch {
    /* already closed */
  }
}
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
  const user = await getRequestUser(request)

  const { publicId } = await params
  const id = (publicId || []).join('/')
  const resourceType =
    request.nextUrl.searchParams.get('type') === 'video' ? 'video' : 'image'

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const account = await getCloudinaryAccount()
  if (!account) {
    return NextResponse.json({ error: 'Media backend not configured' }, { status: 503 })
  }

  if (!id) {
    return NextResponse.json({ error: 'Missing media id' }, { status: 400 })
  }

  const upstreamUrl = signedUrl(id, account, {
    resourceType,
    // Original progressive upload. Quality transforms are fragmented MP4.
    ...(resourceType === 'video' ? { raw: true } : {}),
  })

  // Forward Range (for video seeking). Ask Cloudinary for a progressive MP4
  // even when the browser's Accept header would negotiate HLS.
  const forwardHeaders: Record<string, string> = {}
  const range = request.headers.get('range')
  if (range) forwardHeaders['Range'] = range
  if (resourceType === 'video') {
    forwardHeaders['Accept'] = 'video/mp4'
  }

  let upstream: Response | null
  try {
    upstream = await fetch(upstreamUrl, { headers: forwardHeaders })
  } catch {
    upstream = null
  }

  // .mp4 on the original is a remux. If that file is missing or fragmented,
  // try the uploaded container unchanged.
  if (resourceType === 'video' && (!upstream || !isPlayableVideo(upstream))) {
    await discard(upstream)
    const original = signedUrl(id, account, {
      resourceType: 'video',
      raw: true,
      format: false,
    })
    try {
      upstream = await fetch(original, { headers: forwardHeaders })
    } catch {
      upstream = null
    }
  }

  if (!upstream) {
    return NextResponse.json({ error: 'Failed to fetch media' }, { status: 502 })
  }

  if (resourceType === 'video' && !isPlayableVideo(upstream)) {
    await discard(upstream)
    return NextResponse.json({ error: 'Media not available' }, { status: 502 })
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
