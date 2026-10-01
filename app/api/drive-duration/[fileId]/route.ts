import { NextRequest, NextResponse } from 'next/server'
import { fetchDriveDurationSeconds } from '@/lib/drive-duration'
import { userCanReadDriveFile } from '@/lib/media-access'
import { getRequestUser } from '@/lib/request-user'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FILE_ID = /^[A-Za-z0-9_-]{10,128}$/

/**
 * GET /api/drive-duration/:fileId
 *
 * Returns `{ seconds }` for a Drive lesson the viewer may open.
 * This is a short header read. It is not a video URL and must not be given to a player.
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

  const seconds = await fetchDriveDurationSeconds(fileId)
  if (!seconds) return NextResponse.json({ error: 'Duration unavailable' }, { status: 404 })

  return NextResponse.json(
    { seconds },
    { headers: { 'Cache-Control': 'private, max-age=86400' } }
  )
}
