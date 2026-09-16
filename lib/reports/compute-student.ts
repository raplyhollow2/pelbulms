import type { SupabaseClient } from '@supabase/supabase-js'
import type { ReportBlock } from '@/lib/reports/types'

type Db = SupabaseClient<any>

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

export async function computeStudentReports(db: Db, userId: string): Promise<ReportBlock[]> {
  const [
    { data: enrollments },
    { data: lessonProgress },
    { data: quizAttempts },
    { data: certificates },
    { data: announcements },
  ] = await Promise.all([
    db
      .from('enrollments')
      .select('id, course_id, progress_percentage, status, last_accessed_at, completed_at, enrolled_at, courses(id, title)')
      .eq('user_id', userId)
      .in('status', ['active', 'completed']),
    db
      .from('lesson_progress')
      .select('id, lesson_id, course_id, completed, completed_at, time_spent_seconds, last_accessed_at')
      .eq('user_id', userId),
    db
      .from('quiz_attempts')
      .select('id, quiz_id, score, passed, completed_at, started_at')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(50),
    db
      .from('certificates')
      .select('id, course_id, issued_at, verification_code')
      .eq('user_id', userId)
      .order('issued_at', { ascending: false }),
    db
      .from('announcements')
      .select('id, title, course_id, created_at, is_global')
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  // Resolve course titles separately when embed join is unavailable
  const enrollmentList = (enrollments || []) as any[]
  const courseIdsForTitles = [
    ...new Set([
      ...enrollmentList.map((e) => e.course_id),
      ...((certificates || []) as any[]).map((c) => c.course_id),
    ]),
  ].filter(Boolean)
  const { data: courseRows } = courseIdsForTitles.length
    ? await db.from('courses').select('id, title').in('id', courseIdsForTitles)
    : { data: [] }
  const courseTitle = new Map(((courseRows || []) as any[]).map((c) => [c.id, c.title]))

  const quizIdsForTitles = [...new Set(((quizAttempts || []) as any[]).map((a) => a.quiz_id))].filter(
    Boolean
  )
  const { data: quizRows } = quizIdsForTitles.length
    ? await db.from('quizzes').select('id, title').in('id', quizIdsForTitles)
    : { data: [] }
  const quizTitleMap = new Map(((quizRows || []) as any[]).map((q) => [q.id, q.title]))

  const progressList = (lessonProgress || []) as any[]
  const avgProgress =
    enrollmentList.length > 0
      ? Math.round(
          enrollmentList.reduce((s, e) => s + (e.progress_percentage || 0), 0) /
            enrollmentList.length
        )
      : 0
  const completedCourses = enrollmentList.filter((e) => e.completed_at || e.status === 'completed').length
  const totalTimeMin = Math.round(
    progressList.reduce((s, p) => s + (p.time_spent_seconds || 0), 0) / 60
  )

  const weekStart = daysAgo(7)
  const completedThisWeek = progressList.filter(
    (p) => p.completed && p.completed_at && p.completed_at >= weekStart
  ).length

  // Simple streak: consecutive days with any lesson access ending today/yesterday
  const accessDays = new Set(
    progressList
      .filter((p) => p.last_accessed_at)
      .map((p) => new Date(p.last_accessed_at).toISOString().slice(0, 10))
  )
  let streak = 0
  for (let i = 0; i < 60; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    if (accessDays.has(key)) streak += 1
    else if (i > 0) break
  }

  const courseIds = new Set(enrollmentList.map((e) => e.course_id))
  const unreadish = ((announcements || []) as any[]).filter(
    (a) => a.is_global || !a.course_id || courseIds.has(a.course_id)
  )

  const nearComplete = enrollmentList.filter(
    (e) => !e.completed_at && (e.progress_percentage || 0) >= 80
  )

  return [
    {
      id: 'progress-overview',
      title: 'Progress overview',
      description: 'Your enrollments and completion status.',
      metrics: [
        { key: 'courses', label: 'Courses', value: enrollmentList.length },
        { key: 'completed', label: 'Completed', value: completedCourses },
        { key: 'avg', label: 'Avg progress', value: `${avgProgress}%` },
        { key: 'time', label: 'Time spent', value: `${totalTimeMin} min`, hint: 'From lesson progress' },
      ],
      columns: [
        { key: 'course', label: 'Course' },
        { key: 'progress', label: 'Progress %' },
        { key: 'status', label: 'Status' },
        { key: 'lastAccess', label: 'Last accessed' },
      ],
      rows: enrollmentList.map((e) => ({
        id: e.id,
        cells: {
          course: e.courses?.title || courseTitle.get(e.course_id) || e.course_id,
          progress: e.progress_percentage ?? 0,
          status: e.status,
          lastAccess: e.last_accessed_at ? new Date(e.last_accessed_at).toLocaleDateString() : '—',
        },
      })),
      emptyMessage: 'You are not enrolled in any courses yet.',
    },
    {
      id: 'activity-streak',
      title: 'Activity streak',
      description: 'Recent learning habit.',
      metrics: [
        { key: 'streak', label: 'Day streak', value: streak },
        { key: 'week', label: 'Lessons completed (7d)', value: completedThisWeek },
        { key: 'lessons', label: 'Lessons tracked', value: progressList.length },
      ],
    },
    {
      id: 'assessment-history',
      title: 'Assessment history',
      description: 'Recent quiz attempts.',
      columns: [
        { key: 'quiz', label: 'Quiz' },
        { key: 'score', label: 'Score' },
        { key: 'passed', label: 'Passed' },
        { key: 'when', label: 'Completed' },
      ],
      rows: ((quizAttempts || []) as any[]).map((a) => ({
        id: a.id,
        cells: {
          quiz: quizTitleMap.get(a.quiz_id) || a.quiz_id,
          score: a.score ?? 0,
          passed: a.passed ? 'Yes' : 'No',
          when: a.completed_at ? new Date(a.completed_at).toLocaleDateString() : '—',
        },
      })),
      emptyMessage: 'No quiz attempts yet.',
    },
    {
      id: 'certificates',
      title: 'Certificates & near completion',
      metrics: [
        { key: 'earned', label: 'Certificates', value: (certificates || []).length },
        { key: 'near', label: 'Near complete (≥80%)', value: nearComplete.length },
      ],
      columns: [
        { key: 'course', label: 'Course' },
        { key: 'issued', label: 'Issued' },
        { key: 'code', label: 'Verification code' },
      ],
      rows: ((certificates || []) as any[]).map((c) => ({
        id: c.id,
        cells: {
          course: courseTitle.get(c.course_id) || c.course_id,
          issued: c.issued_at ? new Date(c.issued_at).toLocaleDateString() : '—',
          code: c.verification_code,
        },
      })),
      emptyMessage: 'No certificates earned yet.',
    },
    {
      id: 'communication-digest',
      title: 'Communication digest',
      description: 'Recent announcements for your courses.',
      metrics: [{ key: 'count', label: 'Recent announcements', value: unreadish.length }],
      columns: [
        { key: 'title', label: 'Title' },
        { key: 'when', label: 'Posted' },
      ],
      rows: unreadish.slice(0, 20).map((a) => ({
        id: a.id,
        cells: {
          title: a.title,
          when: a.created_at ? new Date(a.created_at).toLocaleDateString() : '—',
        },
      })),
      emptyMessage: 'No announcements right now.',
    },
  ]
}
