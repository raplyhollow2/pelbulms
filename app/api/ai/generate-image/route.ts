// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { createServiceClient } from '@/lib/supabase/server'
import { courseIdByLesson, userCanManageCourse } from '@/lib/course-access'
import { geminiImagePng } from '@/lib/gemini'
import { isCloudinaryConfigured, cloudinary } from '@/lib/cloudinary'
import { parseLessonBlocks, newBlockId } from '@/lib/lesson-blocks'

const TEACHER_ROLES = ['instructor', 'admin', 'resource_person', 'superadmin'] as const

export async function POST(request: NextRequest) {
  const rbac = await checkRBAC(request, [...TEACHER_ROLES])
  if (!rbac.hasAccess) {
    return NextResponse.json({ error: rbac.error || 'Access denied' }, { status: 403 })
  }
  const body = await request.json().catch(() => ({}))
  const prompt = String(body.prompt || '').trim()
  const lessonId = body.lessonId as string | undefined
  if (!prompt) return NextResponse.json({ error: 'prompt is required' }, { status: 400 })

  const service = await createServiceClient()
  if (lessonId) {
    const courseId = await courseIdByLesson(service, lessonId)
    if (!courseId || !(await userCanManageCourse(service, courseId, rbac.userId!, rbac.userRole))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  try {
    const png = await geminiImagePng({ userId: rbac.userId, prompt })
    if (!png) {
      return NextResponse.json(
        { error: 'Gemini did not return an image. Try a more visual prompt.' },
        { status: 400 }
      )
    }
    let url: string | null = null
    if (isCloudinaryConfigured()) {
      const uploaded: any = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'pelbu/ai-images', resource_type: 'image' },
          (err, result) => (err ? reject(err) : resolve(result))
        )
        stream.end(png)
      })
      url = uploaded.secure_url
    } else {
      url = `data:image/png;base64,${png.toString('base64')}`
    }

    if (lessonId) {
      const { data: lesson } = await service.from('lessons').select('content').eq('id', lessonId).single()
      const blocks = parseLessonBlocks((lesson as any)?.content)
      blocks.push({ id: newBlockId(), type: 'image', url, alt: prompt.slice(0, 120) })
      await service.from('lessons').update({ content: blocks, updated_at: new Date().toISOString() }).eq('id', lessonId)
      return NextResponse.json({ success: true, url, blocks })
    }
    return NextResponse.json({ success: true, url })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Image generation failed' }, { status: 500 })
  }
}
