import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { createServiceClient } from '@/lib/supabase/server'
import { courseIdByLesson, userCanManageCourse } from '@/lib/course-access'
import { resolveAvatarVendor, type AvatarProvider } from '@/lib/ai-keys'
import { geminiText } from '@/lib/gemini'
import { parseLessonBlocks, newBlockId } from '@/lib/lesson-blocks'
import { generateAvatarVideo } from '@/lib/avatar-vendors'

const TEACHER_ROLES = ['instructor', 'admin', 'resource_person', 'superadmin'] as const

export async function POST(request: NextRequest) {
  const rbac = await checkRBAC(request, [...TEACHER_ROLES])
  if (!rbac.hasAccess) {
    return NextResponse.json({ error: rbac.error || 'Access denied' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const lessonId = body.lessonId as string | undefined
  const preferred = (['heygen', 'did', 'tavus'] as AvatarProvider[]).includes(body.vendor)
    ? (body.vendor as AvatarProvider)
    : null
  let script = String(body.script || '').trim()

  const service = await createServiceClient()
  if (lessonId) {
    const courseId = await courseIdByLesson(service, lessonId)
    if (!courseId || !(await userCanManageCourse(service, courseId, rbac.userId!, rbac.userRole))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!script) {
      const { data: lesson } = await service
        .from('lessons')
        .select('title, description, content')
        .eq('id', lessonId)
        .maybeSingle()
      script = await geminiText(
        `Write a 45-second presenter script for this lesson. Plain spoken English, no markdown.
Title: ${(lesson as any)?.title}
Notes: ${String((lesson as any)?.description || '').slice(0, 2000)}`,
        { userId: rbac.userId }
      )
    }
  }

  if (!script) return NextResponse.json({ error: 'script is required' }, { status: 400 })

  const vendor = await resolveAvatarVendor(rbac.userId, preferred)
  if (!vendor) {
    return NextResponse.json({
      configured: false,
      message:
        'Add a paid avatar API key in Settings → AI (HeyGen, D-ID, or Tavus). Gemini can write the script; it cannot render a talking presenter.',
      settingsUrl: '/settings#ai-avatar',
      script,
    })
  }

  try {
    const job = await generateAvatarVideo({
      provider: vendor.provider,
      secret: vendor.secret,
      script,
      meta: vendor.meta,
    })
    const attach = body.attach !== false
    if (attach && lessonId && job.url) {
      const { data: lesson } = await service.from('lessons').select('content').eq('id', lessonId).single()
      const blocks = parseLessonBlocks((lesson as any)?.content)
      blocks.push({ id: newBlockId(), type: 'video', url: job.url })
      await service
        .from('lessons')
        .update({ content: blocks, updated_at: new Date().toISOString() })
        .eq('id', lessonId)
      return NextResponse.json({
        configured: true,
        vendor: vendor.provider,
        job: job.raw,
        url: job.url,
        jobId: job.jobId,
        script,
        blocks,
      })
    }
    return NextResponse.json({
      configured: true,
      vendor: vendor.provider,
      job: job.raw,
      url: job.url,
      jobId: job.jobId,
      script,
      message: job.url
        ? null
        : `${vendor.provider === 'heygen' ? 'HeyGen' : vendor.provider === 'did' ? 'D-ID' : 'Tavus'} accepted the job. The video URL appears when rendering finishes — add it as a video block, or try again in a minute.`,
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Avatar vendor request failed', script, vendor: vendor.provider },
      { status: 400 }
    )
  }
}
