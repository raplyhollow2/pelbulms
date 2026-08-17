// @ts-nocheck - expansion tables not fully in generated Database types
import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { createServiceClient } from '@/lib/supabase/server'
import { userCanManageCourse } from '@/lib/course-access'

const TEACHER_ROLES = ['instructor', 'admin', 'resource_person', 'superadmin'] as const

export async function GET(request: NextRequest) {
  const rbac = await checkRBAC(request, [...TEACHER_ROLES])
  if (!rbac.hasAccess) {
    return NextResponse.json({ error: rbac.error || 'Access denied' }, { status: 403 })
  }
  const courseId = request.nextUrl.searchParams.get('courseId')
  if (!courseId) return NextResponse.json({ error: 'courseId is required' }, { status: 400 })
  const service = await createServiceClient()
  if (!(await userCanManageCourse(service, courseId, rbac.userId!, rbac.userRole))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { data, error } = await service
    .from('teacher_interventions')
    .select('*')
    .eq('course_id', courseId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const { data: modules } = await service.from('modules').select('id').eq('course_id', courseId)
  const moduleIds = (modules || []).map((m: any) => m.id)
  let quizFails: Array<{ studentId: string; quizTitle: string; score: number }> = []
  if (moduleIds.length) {
    const { data: lessons } = await service.from('lessons').select('id').in('module_id', moduleIds)
    const lessonIds = (lessons || []).map((l: any) => l.id)
    if (lessonIds.length) {
      const { data: quizzes } = await service
        .from('quizzes')
        .select('id, title, passing_score')
        .in('lesson_id', lessonIds)
      const quizIds = (quizzes || []).map((q: any) => q.id)
      if (quizIds.length) {
        const { data: attempts } = await service
          .from('quiz_attempts')
          .select('user_id, quiz_id, score, passed, completed_at')
          .in('quiz_id', quizIds)
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false })
          .limit(400)
        const quizById = Object.fromEntries((quizzes || []).map((q: any) => [q.id, q]))
        const seen = new Set<string>()
        for (const attempt of attempts || []) {
          const key = `${(attempt as any).user_id}:${(attempt as any).quiz_id}`
          if (seen.has(key)) continue
          seen.add(key)
          const quiz = quizById[(attempt as any).quiz_id]
          const failed =
            (attempt as any).passed === false ||
            (typeof (attempt as any).score === 'number' &&
              quiz &&
              (attempt as any).score < (quiz.passing_score || 70))
          if (failed) {
            quizFails.push({
              studentId: (attempt as any).user_id,
              quizTitle: quiz?.title || 'Quiz',
              score: (attempt as any).score ?? 0,
            })
          }
        }
      }
    }
  }

  const { data: forums } = await service.from('forums').select('id').eq('course_id', courseId)
  const forumIds = (forums || []).map((f: any) => f.id)
  let openQuestions: Array<{ id: string; title: string; studentId: string }> = []
  if (forumIds.length) {
    const { data: threads } = await service
      .from('threads')
      .select('id, title, user_id, reply_count')
      .in('forum_id', forumIds)
      .order('created_at', { ascending: false })
      .limit(50)
    openQuestions = (threads || [])
      .filter((t: any) => !t.reply_count)
      .map((t: any) => ({ id: t.id, title: t.title, studentId: t.user_id }))
  }

  return NextResponse.json({
    interventions: data || [],
    quizFails,
    openQuestions,
  })
}

export async function POST(request: NextRequest) {
  const rbac = await checkRBAC(request, [...TEACHER_ROLES])
  if (!rbac.hasAccess) {
    return NextResponse.json({ error: rbac.error || 'Access denied' }, { status: 403 })
  }
  const body = await request.json().catch(() => ({}))
  const { courseId, studentId, kind, message } = body || {}
  if (!courseId || !studentId || !message?.trim()) {
    return NextResponse.json({ error: 'courseId, studentId and message are required' }, { status: 400 })
  }
  const service = await createServiceClient()
  if (!(await userCanManageCourse(service, courseId, rbac.userId!, rbac.userRole))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await service
    .from('teacher_interventions')
    .insert({
      course_id: courseId,
      student_id: studentId,
      teacher_id: rbac.userId,
      kind: ['note', 'nudge', 'question', 'at_risk'].includes(kind) ? kind : 'note',
      message: String(message).trim(),
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await service.from('notifications').insert({
    user_id: studentId,
    type: 'intervention',
    title: kind === 'nudge' ? 'A reminder from your teacher' : 'Message from your teacher',
    message: String(message).trim(),
    action_url: `/learn/${courseId}`,
    is_read: false,
    metadata: { course_id: courseId, kind },
  })

  return NextResponse.json({ intervention: data })
}
