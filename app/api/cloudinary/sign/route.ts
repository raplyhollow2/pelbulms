import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { isCloudinaryConfigured, signUploadParams, cloudName, apiKey } from '@/lib/cloudinary'
import { VIDEO_EAGER_TRANSFORM } from '@/lib/video-url'

/**
 * POST /api/cloudinary/sign
 * Returns a signature the browser uses to upload directly to Cloudinary.
 * Body: {
 *   folder?,
 *   resourceType?: 'image' | 'video',
 *   accessType?: 'upload' | 'authenticated',  // images/covers → upload (public); videos → authenticated
 *   eager?,
 *   eagerAsync?
 * }
 */
export async function POST(request: NextRequest) {
  const rbac = await checkRBAC(request, ['instructor', 'admin', 'resource_person', 'superadmin'])
  if (!rbac.hasAccess) {
    return NextResponse.json(
      { error: rbac.error || 'Access denied' },
      { status: rbac.error?.includes('Unauthorized') ? 401 : 403 }
    )
  }

  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      { error: 'Cloudinary is not configured. Set CLOUDINARY_* env vars.' },
      { status: 503 }
    )
  }

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    // optional body
  }

  const folder = (body.folder as string) || `uploads/${rbac.userId}`
  const resourceType = (body.resourceType as string) === 'video' ? 'video' : 'image'
  // Videos stay private; images/covers are public so catalog cards can use secure_url.
  const accessType =
    (body.accessType as string) === 'authenticated' || resourceType === 'video'
      ? 'authenticated'
      : 'upload'
  const timestamp = Math.round(Date.now() / 1000)

  // Params must exactly match what the browser sends to Cloudinary.
  const paramsToSign: Record<string, string | number> = {
    timestamp,
    folder,
    type: accessType,
  }

  let eager: string | undefined
  let eagerAsync: boolean | undefined

  if (resourceType === 'video') {
    eager = (body.eager as string) || VIDEO_EAGER_TRANSFORM
    eagerAsync = body.eagerAsync !== false
    paramsToSign.eager = eager
    paramsToSign.eager_async = eagerAsync ? 'true' : 'false'
  }

  const signature = signUploadParams(paramsToSign)

  return NextResponse.json({
    signature,
    timestamp,
    apiKey,
    cloudName,
    folder,
    resourceType,
    type: accessType,
    ...(eager ? { eager, eager_async: eagerAsync ? 'true' : 'false' } : {}),
  })
}
