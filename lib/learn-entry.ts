import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Udemy-style entry: resume last lecture, else first published lesson.
 * Returns null when the learner is not enrolled.
 */
export async function resolveCoursePlayerPath(
  courseId: string,
  userId: string
): Promise<string | 'empty' | null> {
  const supabase = await createSupabaseServerClient()

  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('status, last_lesson_id')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .maybeSingle()

  const status = (enrollment as { status?: string } | null)?.status
  if (!enrollment || (status !== 'active' && status !== 'completed')) {
    return null
  }

  const lastLessonId = (enrollment as { last_lesson_id?: string | null }).last_lesson_id
  if (lastLessonId) {
    const { data: lastLesson } = await supabase
      .from('lessons')
      .select('id, is_published')
      .eq('id', lastLessonId)
      .maybeSingle()
    if (lastLesson && (lastLesson as { is_published?: boolean }).is_published !== false) {
      return `/learn/${courseId}/lesson/${lastLessonId}`
    }
  }

  const { data: modules } = await supabase
    .from('modules')
    .select('id')
    .eq('course_id', courseId)
    .order('order_index', { ascending: true })

  const moduleIds = ((modules || []) as { id: string }[]).map((m) => m.id)
  if (moduleIds.length === 0) return 'empty'

  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, module_id, order_index')
    .in('module_id', moduleIds)
    .eq('is_published', true)
    .order('order_index', { ascending: true })

  const byModule = new Map<string, { id: string }[]>()
  for (const lesson of (lessons || []) as { id: string; module_id: string }[]) {
    const list = byModule.get(lesson.module_id) || []
    list.push(lesson)
    byModule.set(lesson.module_id, list)
  }

  for (const moduleId of moduleIds) {
    const first = byModule.get(moduleId)?.[0]
    if (first) return `/learn/${courseId}/lesson/${first.id}`
  }

  return 'empty'
}
