import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { isCloudinaryConfigured, signUploadParams, cloudName, apiKey } from '@/lib/cloudinary'

/**
 * POST /api/cloudinary/sign
 * Returns a signature the browser uses to upload an "authenticated" (private)
 * asset directly to Cloudinary. Body: { folder?: string, resourceType?: 'image' | 'video' }
 */
export async function POST(request: NextRequest) {
  const rbac = await checkRBAC(request, ['student', 'instructor', 'admin', 'resource_person', 'superadmin'])
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

  let body: any = {}
  try {
    body = await request.json()
  } catch {
    // optional body
  }

  const folder = (body.folder as string) || `uploads/${rbac.userId}`
  const resourceType = (body.resourceType as string) === 'video' ? 'video' : 'image'
  const timestamp = Math.round(Date.now() / 1000)

  // These params must exactly match what the browser sends to Cloudinary.
  const paramsToSign: Record<string, string | number> = {
    timestamp,
    folder,
    type: 'authenticated',
  }

  const signature = signUploadParams(paramsToSign)

  return NextResponse.json({
    signature,
    timestamp,
    apiKey,
    cloudName,
    folder,
    resourceType,
    type: 'authenticated',
  })
}
