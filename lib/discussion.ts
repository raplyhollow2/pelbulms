// @ts-nocheck — forums/threads not fully typed in generated Database types

type Db = {
  from: (table: string) => any
}

async function findForum(
  db: Db,
  courseId: string,
  lessonId: string | null,
  moduleId: string | null
) {
  let query = db.from('forums').select('*').eq('course_id', courseId)

  if (lessonId) {
    query = query.eq('lesson_id', lessonId)
  } else if (moduleId) {
    query = query.eq('module_id', moduleId).is('lesson_id', null)
  } else {
    query = query.is('module_id', null).is('lesson_id', null)
  }

  const { data, error } = await query.order('created_at', { ascending: true }).limit(1)
  if (error) throw error
  return Array.isArray(data) ? data[0] || null : data || null
}

/**
 * Resolve (or create) the single discussion forum for a course/lesson scope.
 * Uses limit(1) — never maybeSingle — so duplicates cannot blank the feed.
 */
export async function ensureDiscussionForum(
  db: Db,
  opts: {
    courseId: string
    userId: string
    moduleId?: string | null
    lessonId?: string | null
  }
) {
  const { courseId, userId } = opts
  const lessonId = opts.lessonId || null
  const moduleId = opts.moduleId || null

  const existing = await findForum(db, courseId, lessonId, moduleId)
  if (existing) return existing

  const insertPayload = {
    course_id: courseId,
    title: lessonId ? 'Lesson discussion' : 'Course discussion',
    description: 'Ask questions and share ideas with classmates.',
    is_enabled: true,
    created_by: userId,
    module_id: moduleId,
    lesson_id: lessonId,
  }

  const { data: created, error: createError } = await db
    .from('forums')
    .insert(insertPayload)
    .select('*')
    .single()

  if (!createError && created) return created

  // Unique index race: another request created it first — fetch again.
  const again = await findForum(db, courseId, lessonId, moduleId)
  if (again) return again

  throw createError || new Error('Could not open discussion forum')
}
