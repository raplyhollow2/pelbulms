// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, tryCreateServiceClient } from '@/lib/supabase/server'
import { userCanManageCourse } from '@/lib/course-access'
import { fetchLinkPreview, firstNonYoutubeUrl, firstYoutubeUrl } from '@/lib/link-preview'
import { getYoutubeId } from '@/lib/video-url'

const BUCKET = 'course-media'

async function getSessionUser() {
  const session = await createSupabaseServerClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user) return { session: null as any, user: null as any, role: null as string | null }

  const admin = await tryCreateServiceClient()
  const db = admin || session
  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle()
  return { session, user, role: (profile as any)?.role || null }
}

async function assertCourseAccess(db: any, courseId: string, userId: string, role?: string | null) {
  if (await userCanManageCourse(db, courseId, userId, role as any)) return true

  const { data: enrollment } = await db
    .from('enrollments')
    .select('id')
    .eq('course_id', courseId)
    .eq('user_id', userId)
    .in('status', ['active', 'completed'])
    .limit(1)
    .maybeSingle()

  return Boolean(enrollment)
}

function autoTitle(text: string) {
  const first = text.split('\n')[0]?.trim() || 'Update'
  return first.length > 72 ? `${first.slice(0, 69).trimEnd()}…` : first
}

async function loadProfiles(db: any, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))]
  const map: Record<string, { full_name?: string; avatar_url?: string | null }> = {}
  if (unique.length === 0) return map
  const { data } = await db.from('profiles').select('id, full_name, avatar_url').in('id', unique)
  for (const p of data || []) {
    map[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url }
  }
  return map
}

async function filterTaggedCourseMembers(
  db: any,
  courseId: string,
  taggedIds: string[]
): Promise<string[]> {
  const unique = [...new Set(taggedIds.filter(Boolean))]
  if (unique.length === 0) return []

  const { data: enrolled } = await db
    .from('enrollments')
    .select('user_id')
    .eq('course_id', courseId)
    .in('status', ['active', 'completed'])
    .in('user_id', unique)

  const enrolledSet = new Set((enrolled || []).map((e: any) => e.user_id))

  const { data: course } = await db
    .from('courses')
    .select('instructor_id')
    .eq('id', courseId)
    .maybeSingle()
  if (course?.instructor_id) enrolledSet.add(course.instructor_id)

  const { data: staff } = await db
    .from('course_instructors')
    .select('user_id')
    .eq('course_id', courseId)
    .in('user_id', unique)
  for (const row of staff || []) enrolledSet.add(row.user_id)

  return unique.filter((id) => enrolledSet.has(id))
}

async function notifyTagged(
  db: any,
  opts: {
    courseId: string
    lessonId?: string | null
    actorId: string
    actorName: string
    taggedIds: string[]
    threadId: string
    snippet: string
  }
) {
  if (!opts.taggedIds.length) return
  const rows = opts.taggedIds
    .filter((id) => id !== opts.actorId)
    .map((userId) => ({
      user_id: userId,
      type: 'discussion_tag',
      title: `${opts.actorName} tagged you in a discussion`,
      message: opts.snippet.slice(0, 160),
      action_url: opts.lessonId
        ? `/learn/${opts.courseId}/lesson/${opts.lessonId}?tab=discussion`
        : `/learn/${opts.courseId}`,
      is_read: false,
      metadata: {
        course_id: opts.courseId,
        thread_id: opts.threadId,
        tagged_by: opts.actorId,
      },
    }))
  if (!rows.length) return
  const { error } = await db.from('notifications').insert(rows)
  if (error) console.warn('[discussion] tag notify failed:', error.message)
}

/**
 * GET /api/courses/[courseId]/discussion?lessonId=&moduleId=
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params
    const { session, user, role } = await getSessionUser()
    if (!session || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const lessonId = request.nextUrl.searchParams.get('lessonId')
    const moduleId = request.nextUrl.searchParams.get('moduleId')
    const admin = await tryCreateServiceClient()
    const readDb = admin || session

    if (!(await assertCourseAccess(readDb, courseId, user.id, role))) {
      return NextResponse.json({ error: 'Forbidden — enroll in this course to view discussion' }, { status: 403 })
    }

    const { data: forumId, error: forumError } = await session.rpc('ensure_discussion_forum', {
      p_course_id: courseId,
      p_module_id: moduleId || null,
      p_lesson_id: lessonId || null,
    })

    if (forumError || !forumId) {
      return NextResponse.json(
        { error: forumError?.message || 'Could not open discussion' },
        { status: 400 }
      )
    }

    const { data: forum } = await session
      .from('forums')
      .select('id, is_enabled')
      .eq('id', forumId)
      .maybeSingle()

    if (!forum || forum.is_enabled === false) {
      return NextResponse.json({ enabled: false, forumId, threads: [] })
    }

    const { data: threadRows, error: threadError } = await session
      .from('threads')
      .select('*')
      .eq('forum_id', forumId)
      .order('created_at', { ascending: false })

    if (threadError) {
      return NextResponse.json({ error: threadError.message }, { status: 400 })
    }

    const list = threadRows || []
    const taggedAll = list.flatMap((t: any) =>
      Array.isArray(t.metadata?.tagged_user_ids) ? t.metadata.tagged_user_ids : []
    )
    const profiles = await loadProfiles(readDb, [
      ...list.map((t: any) => t.user_id),
      ...taggedAll,
    ])

    let repliesByThread: Record<string, any[]> = {}
    if (list.length > 0) {
      const { data: replyRows } = await session
        .from('replies')
        .select('*')
        .in(
          'thread_id',
          list.map((t: any) => t.id)
        )
        .order('created_at', { ascending: true })

      const replyList = replyRows || []
      Object.assign(
        profiles,
        await loadProfiles(
          readDb,
          replyList.map((r: any) => r.user_id)
        )
      )

      for (const r of replyList) {
        const tid = r.thread_id
        if (!repliesByThread[tid]) repliesByThread[tid] = []
        repliesByThread[tid].push({
          id: r.id,
          thread_id: tid,
          body: r.content || '',
          created_at: r.created_at,
          author_name: profiles[r.user_id]?.full_name || 'Student',
          author_avatar: profiles[r.user_id]?.avatar_url,
        })
      }
    }

    const threads = list.map((t: any) => {
      const taggedIds: string[] = Array.isArray(t.metadata?.tagged_user_ids)
        ? t.metadata.tagged_user_ids
        : []
      return {
        id: t.id,
        title: t.title,
        body: t.content || '',
        created_at: t.created_at,
        author_name: profiles[t.user_id]?.full_name || 'Student',
        author_avatar: profiles[t.user_id]?.avatar_url,
        feeling: t.metadata?.feeling || null,
        image_url: t.metadata?.image_url || null,
        video_url: t.metadata?.video_url || null,
        youtube_url: t.metadata?.youtube_url || null,
        link_preview: t.metadata?.link_preview || null,
        tagged_users: taggedIds.map((id) => ({
          id,
          full_name: profiles[id]?.full_name || 'Learner',
          avatar_url: profiles[id]?.avatar_url || null,
        })),
        replies: repliesByThread[t.id] || [],
      }
    })

    const { data: me } = await readDb
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .maybeSingle()

    return NextResponse.json({
      enabled: true,
      forumId,
      threads,
      me: me || null,
      audience: 'course_enrolled_only',
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load discussion' }, { status: 500 })
  }
}

/**
 * POST /api/courses/[courseId]/discussion
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params
    const { session, user, role } = await getSessionUser()
    if (!session || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await tryCreateServiceClient()
    const readDb = admin || session
    if (!(await assertCourseAccess(readDb, courseId, user.id, role))) {
      return NextResponse.json({ error: 'Forbidden — only enrolled learners can post' }, { status: 403 })
    }

    const contentType = request.headers.get('content-type') || ''
    let action = 'post'
    let bodyText = ''
    let lessonId: string | null = null
    let moduleId: string | null = null
    let threadId: string | null = null
    let feeling: string | null = null
    let imageUrl: string | null = null
    let videoUrl: string | null = null
    let youtubeUrl: string | null = null
    let taggedUserIds: string[] = []
    let file: File | null = null
    let videoFile: File | null = null

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      action = String(form.get('action') || 'post')
      bodyText = String(form.get('body') || '').trim()
      lessonId = (form.get('lessonId') as string) || null
      moduleId = (form.get('moduleId') as string) || null
      threadId = (form.get('threadId') as string) || null
      feeling = (form.get('feeling') as string) || null
      imageUrl = (form.get('imageUrl') as string) || null
      videoUrl = (form.get('videoUrl') as string) || null
      youtubeUrl = (form.get('youtubeUrl') as string) || null
      try {
        const rawTags = form.get('taggedUserIds')
        if (typeof rawTags === 'string' && rawTags.trim()) {
          taggedUserIds = JSON.parse(rawTags)
        }
      } catch {
        taggedUserIds = []
      }
      const uploaded = form.get('file')
      if (uploaded instanceof File && uploaded.size > 0) {
        if (uploaded.type.startsWith('video/')) videoFile = uploaded
        else file = uploaded
      }
      const uploadedVideo = form.get('video')
      if (uploadedVideo instanceof File && uploadedVideo.size > 0) videoFile = uploadedVideo
    } else {
      const json = await request.json().catch(() => ({}))
      action = json.action || 'post'
      bodyText = typeof json.body === 'string' ? json.body.trim() : ''
      lessonId = json.lessonId || null
      moduleId = json.moduleId || null
      threadId = json.threadId || null
      feeling = json.feeling || null
      imageUrl = json.imageUrl || null
      videoUrl = json.videoUrl || null
      youtubeUrl = json.youtubeUrl || null
      taggedUserIds = Array.isArray(json.taggedUserIds) ? json.taggedUserIds : []
    }

    if (
      !bodyText &&
      !(action === 'post' && (file || imageUrl || videoFile || videoUrl || youtubeUrl))
    ) {
      return NextResponse.json({ error: 'Post text, media, or video is required' }, { status: 400 })
    }

    const uploader = admin || session

    if (file) {
      if (!file.type.startsWith('image/')) {
        return NextResponse.json({ error: 'Photo must be an image file' }, { status: 400 })
      }
      if (file.size > 8 * 1024 * 1024) {
        return NextResponse.json({ error: 'Image must be under 8MB' }, { status: 400 })
      }
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
      const path = `discussion/${courseId}/${user.id}/${Date.now()}.${ext || 'jpg'}`
      const bytes = Buffer.from(await file.arrayBuffer())
      const { error: uploadError } = await uploader.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: file.type, upsert: false })
      if (uploadError) {
        return NextResponse.json(
          { error: `Photo upload failed: ${uploadError.message}` },
          { status: 400 }
        )
      }
      imageUrl = uploader.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    }

    if (videoFile) {
      if (!videoFile.type.startsWith('video/')) {
        return NextResponse.json({ error: 'Video file required' }, { status: 400 })
      }
      if (videoFile.size > 80 * 1024 * 1024) {
        return NextResponse.json({ error: 'Video must be under 80MB' }, { status: 400 })
      }
      const ext = (videoFile.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '')
      const path = `discussion/${courseId}/${user.id}/${Date.now()}.${ext || 'mp4'}`
      const bytes = Buffer.from(await videoFile.arrayBuffer())
      const { error: uploadError } = await uploader.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: videoFile.type, upsert: false })
      if (uploadError) {
        return NextResponse.json(
          { error: `Video upload failed: ${uploadError.message}` },
          { status: 400 }
        )
      }
      videoUrl = uploader.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    }

    if (action === 'reply') {
      if (!threadId) {
        return NextResponse.json({ error: 'threadId is required' }, { status: 400 })
      }
      const { data: replyId, error } = await session.rpc('create_discussion_reply', {
        p_thread_id: threadId,
        p_content: bodyText,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ success: true, replyId })
    }

    const { data: forumId, error: forumError } = await session.rpc('ensure_discussion_forum', {
      p_course_id: courseId,
      p_module_id: moduleId || null,
      p_lesson_id: lessonId || null,
    })
    if (forumError || !forumId) {
      return NextResponse.json(
        { error: forumError?.message || 'Could not open discussion' },
        { status: 400 }
      )
    }

    // Prefer explicit youtube field, else detect from body
    const ytFromBody = firstYoutubeUrl(bodyText)
    const resolvedYoutube =
      (youtubeUrl && getYoutubeId(youtubeUrl) ? youtubeUrl : null) || ytFromBody || null

    // Link preview for article/docs URLs (not YouTube)
    let linkPreview = null
    const previewUrl = firstNonYoutubeUrl(bodyText)
    if (previewUrl && !imageUrl) {
      linkPreview = await fetchLinkPreview(previewUrl)
    }

    const allowedTags = await filterTaggedCourseMembers(readDb, courseId, taggedUserIds)

    const content =
      bodyText ||
      (resolvedYoutube
        ? 'Shared a YouTube video'
        : videoUrl
          ? 'Shared a video'
          : imageUrl
            ? 'Shared a photo'
            : 'Update')

    const metadata: Record<string, unknown> = {}
    if (feeling) metadata.feeling = feeling
    if (imageUrl) metadata.image_url = imageUrl
    if (videoUrl) metadata.video_url = videoUrl
    if (resolvedYoutube) metadata.youtube_url = resolvedYoutube
    if (linkPreview) metadata.link_preview = linkPreview
    if (allowedTags.length) metadata.tagged_user_ids = allowedTags

    const { data: newThreadId, error } = await session.rpc('create_discussion_thread', {
      p_forum_id: forumId,
      p_title: autoTitle(linkPreview?.title || content),
      p_content: content,
      p_metadata: metadata,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const { data: me } = await readDb
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()

    await notifyTagged(session, {
      courseId,
      lessonId,
      actorId: user.id,
      actorName: me?.full_name || 'A classmate',
      taggedIds: allowedTags,
      threadId: newThreadId,
      snippet: content,
    })

    return NextResponse.json({
      success: true,
      threadId: newThreadId,
      forumId,
      link_preview: linkPreview,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to save post' }, { status: 500 })
  }
}
