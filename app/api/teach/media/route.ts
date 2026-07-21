import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { cloudinary, isCloudinaryConfigured } from '@/lib/cloudinary'
import { createServiceClient } from '@/lib/supabase/server'
import { makeMediaRef } from '@/lib/media'

export type MediaAsset = {
  id: string
  name: string
  kind: 'video' | 'image' | 'document' | 'other'
  source: 'cloudinary' | 'supabase'
  url: string
  previewUrl?: string | null
  size?: number
  format?: string
  createdAt?: string
  folder?: string
  publicId?: string
}

/**
 * GET /api/teach/media
 * Lists course media from Cloudinary (course-media/*) and lesson-resources bucket.
 */
export async function GET(request: NextRequest) {
  const rbac = await checkRBAC(request, ['instructor', 'admin', 'resource_person', 'superadmin'])
  if (!rbac.hasAccess) {
    return NextResponse.json(
      { error: rbac.error || 'Access denied' },
      { status: rbac.error?.includes('Unauthorized') ? 401 : 403 }
    )
  }

  const kindFilter = request.nextUrl.searchParams.get('kind') // video|image|document|all
  const assets: MediaAsset[] = []

  try {
    if (isCloudinaryConfigured()) {
      const types: Array<'video' | 'image'> = kindFilter === 'video'
        ? ['video']
        : kindFilter === 'image'
          ? ['image']
          : ['video', 'image']

      for (const resourceType of types) {
        try {
          const result: any = await cloudinary.api.resources({
            type: 'authenticated',
            resource_type: resourceType,
            prefix: 'course-media',
            max_results: 100,
            direction: 'desc',
          })

          for (const r of result.resources || []) {
            const publicId = r.public_id as string
            assets.push({
              id: `cloudinary:${resourceType}:${publicId}`,
              name: publicId.split('/').pop() || publicId,
              kind: resourceType,
              source: 'cloudinary',
              url: makeMediaRef(resourceType, publicId),
              previewUrl: resourceType === 'image' ? `/api/media/${publicId}?type=image` : null,
              size: r.bytes,
              format: r.format,
              createdAt: r.created_at,
              folder: r.folder || publicId.split('/').slice(0, -1).join('/'),
              publicId,
            })
          }
        } catch (err: any) {
          // Folder may be empty or account may not support listing authenticated assets
          console.warn(`[teach/media] Cloudinary ${resourceType} list:`, err?.message || err)
        }
      }
    }

    // Lesson documents in Supabase storage
    if (kindFilter !== 'video' && kindFilter !== 'image') {
      try {
        const supabase = await createServiceClient()
        const { data: buckets } = await supabase.storage.listBuckets()
        if (buckets?.some((b) => b.name === 'lesson-resources')) {
          const { data: top } = await supabase.storage.from('lesson-resources').list('', {
            limit: 50,
            sortBy: { column: 'created_at', order: 'desc' },
          })

          // list course folders then files (shallow scan)
          for (const entry of top || []) {
            if (entry.id === null && entry.name) {
              const { data: nested } = await supabase.storage
                .from('lesson-resources')
                .list(entry.name, { limit: 40 })
              for (const courseFolder of nested || []) {
                if (courseFolder.id === null && courseFolder.name) {
                  const path = `${entry.name}/${courseFolder.name}`
                  const { data: files } = await supabase.storage
                    .from('lesson-resources')
                    .list(path, { limit: 40 })
                  for (const file of files || []) {
                    if (!file.name || file.id === null) continue
                    const fullPath = `${path}/${file.name}`
                    const {
                      data: { publicUrl },
                    } = supabase.storage.from('lesson-resources').getPublicUrl(fullPath)
                    assets.push({
                      id: `supabase:lesson-resources:${fullPath}`,
                      name: file.name,
                      kind: 'document',
                      source: 'supabase',
                      url: publicUrl,
                      size: (file as any).metadata?.size,
                      createdAt: file.created_at,
                      folder: path,
                    })
                  }
                }
              }
            }
          }
        }
      } catch (err: any) {
        console.warn('[teach/media] Supabase list:', err?.message || err)
      }
    }

    assets.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return tb - ta
    })

    return NextResponse.json({
      assets,
      cloudinaryConfigured: isCloudinaryConfigured(),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to list media' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/teach/media
 * Body: { id, source, publicId?, path? }
 */
export async function DELETE(request: NextRequest) {
  const rbac = await checkRBAC(request, ['instructor', 'admin', 'resource_person', 'superadmin'])
  if (!rbac.hasAccess) {
    return NextResponse.json(
      { error: rbac.error || 'Access denied' },
      { status: rbac.error?.includes('Unauthorized') ? 401 : 403 }
    )
  }

  try {
    const body = await request.json()
    const source = body.source as string
    const publicId = body.publicId as string | undefined
    const path = body.path as string | undefined
    const kind = (body.kind as string) || 'video'

    if (source === 'cloudinary' && publicId && isCloudinaryConfigured()) {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: kind === 'image' ? 'image' : 'video',
        type: 'authenticated',
        invalidate: true,
      })
      return NextResponse.json({ ok: true })
    }

    if (source === 'supabase' && path) {
      const supabase = await createServiceClient()
      const { error } = await supabase.storage.from('lesson-resources').remove([path])
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Missing delete target' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to delete media' },
      { status: 500 }
    )
  }
}
