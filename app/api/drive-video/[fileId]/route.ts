import { NextRequest, NextResponse } from 'next/server'
import { openDriveVideo } from '@/lib/drive-stream'
import { userCanReadDriveFile } from '@/lib/media-access'
import { getRequestUser } from '@/lib/request-user'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FILE_ID = /^[A-Za-z0-9_-]{10,128}$/

/**
 * GET /api/drive-video/:fileId
 *
 * Streams a publicly shared Drive video for a lesson the viewer may open.
 * Range requests are passed through so the lesson player can start, seek,
 * pause, and finish in step with the file.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { fileId } = await params
  if (!fileId || !FILE_ID.test(fileId)) {
    return NextResponse.json({ error: 'Invalid file' }, { status: 400 })
  }

  const service = await createServiceClient()
  const allowed = await userCanReadDriveFile(service, user, fileId)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const range = request.headers.get('range')
  let upstream: Response | null = null
  try {
    upstream = await openDriveVideo(fileId, range)
  } catch {
    upstream = null
  }
  if (!upstream) return NextResponse.json({ error: 'Video unavailable' }, { status: 502 })

  const headers = new Headers()
  for (const key of ['content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
    const value = upstream.headers.get(key)
    if (value) headers.set(key, value)
  }
  const type = (upstream.headers.get('content-type') || '').toLowerCase()
  headers.set('Content-Type', type.startsWith('video/') ? upstream.headers.get('content-type') || 'video/mp4' : 'video/mp4')
  if (!headers.has('accept-ranges')) headers.set('Accept-Ranges', 'bytes')
  headers.set('Cache-Control', 'private, no-store')

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  })
}
