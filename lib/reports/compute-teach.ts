import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  FrictionHotspot,
  FrictionMapPayload,
  FrictionType,
  FunnelStep,
  ReportBlock,
  ReportRange,
} from '@/lib/reports/types'
import { rangeToDays } from '@/lib/reports/types'
import {
  courseRosterHref,
  gradingHref,
  learnerHref,
  lessonHref,
} from '@/lib/reports/action-links'
import { currentAssessableActivityKeys } from '@/lib/activity-responses'

type Db = SupabaseClient<any>

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function median(arr: number[]) {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

async function courseIdsOwnedOrStaff(db: Db, userId: string): Promise<string[]> {
  const [{ data: owned }, { data: staff }] = await Promise.all([
    db.from('courses').select('id').eq('instructor_id', userId),
    db.from('course_instructors').select('course_id').eq('user_id', userId),
  ])
  const ids = new Set<string>()
  for (const c of owned || []) ids.add((c as any).id)
  for (const s of staff || []) ids.add((s as any).course_id)
  return [...ids]
}

export async function courseIdsForTeacher(
  db: Db,
  userId: string,
  opts?: { allCourses?: boolean; instructorId?: string | null }
): Promise<string[]> {
  if (opts?.instructorId) return courseIdsOwnedOrStaff(db, opts.instructorId)
  if (opts?.allCourses) {
    const { data } = await db.from('courses').select('id')
    return ((data || []) as any[]).map((c) => c.id)
  }
  return courseIdsOwnedOrStaff(db, userId)
}

function pickFrictionType(signals: {
  dropOffPct: number
  hesitationBoost: number
  stuckRate: number
  quizFailRate: number | null
}): FrictionType {
  const assessment = signals.quizFailRate ?? 0
  const scores: { type: FrictionType; value: number }[] = [
    { type: 'drop_off', value: signals.dropOffPct },
    { type: 'hesitation', value: signals.hesitationBoost },
    { type: 'stuck', value: signals.stuckRate },
    { type: 'assessment', value: assessment },
  ]
  scores.sort((a, b) => b.value - a.value)
  return scores[0]?.type || 'drop_off'
}

function frictionScore(signals: {
  dropOffPct: number
  stuckRate: number
  hesitationBoost: number
  quizFailRate: number | null
}): number {
  const quiz = signals.quizFailRate ?? 0
  const raw =
    signals.dropOffPct * 0.4 +
    signals.stuckRate * 0.25 +
    Math.min(100, signals.hesitationBoost) * 0.2 +
    quiz * 0.15
  return Math.max(0, Math.min(100, Math.round(raw)))
}

export interface TeachReportsResult {
  blocks: ReportBlock[]
  frictionMap: FrictionMapPayload
}

const EMPTY_FRICTION: FrictionMapPayload = {
  hotspots: [],
  sequenceFunnel: [],
}

export async function computeTeachReports(
  db: Db,
  userId: string,
  opts?: { range?: ReportRange; allCourses?: boolean; instructorId?: string | null }
): Promise<TeachReportsResult> {
  const courseIds = await courseIdsForTeacher(db, userId, opts)
  if (courseIds.length === 0) {
    return {
      blocks: [
        {
          id: 'engagement',
          title: 'Engagement',
          emptyMessage: 'Create or join a course as staff to see course insights.',
          metrics: [],
        },
      ],
      frictionMap: EMPTY_FRICTION,
    }
  }

  const rangeDays = rangeToDays(opts?.range || '30d')
  const sinceRange = daysAgo(rangeDays)
  const since14 = daysAgo(14)
  const since7 = daysAgo(7)

  const [
    { data: courses },
    { data: enrollments },
    { data: lessonProgress },
    { data: lessons },
    { data: modules },
    { data: quizzes },
    { data: invites },
    { data: certificates },
    { data: reviews },
  ] = await Promise.all([
    db.from('courses').select('id, title, is_published, category').in('id', courseIds),
    db
      .from('enrollments')
      .select('id, user_id, course_id, status, progress_percentage, last_accessed_at, completed_at, enrolled_at')
      .in('course_id', courseIds),
    db
      .from('lesson_progress')
      .select(
        'id, user_id, lesson_id, course_id, completed, completed_at, time_spent_seconds, last_accessed_at, progress_percentage'
      )
      .in('course_id', courseIds),
    db.from('lessons').select('id, module_id, title, is_published, order_index, resources').limit(5000),
    db.from('modules').select('id, course_id, title, order_index').in('course_id', courseIds),
    db.from('quizzes').select('id, lesson_id, title').limit(5000),
    db.from('enrollment_invites').select('id, course_id, used_at, created_at').in('course_id', courseIds),
    db.from('certificates').select('id, course_id').in('course_id', courseIds),
    db.from('reviews').select('id, course_id, rating').in('course_id', courseIds),
  ])

  const courseList = (courses || []) as any[]
  const enrollmentList = (enrollments || []) as any[]
  const progressListAll = (lessonProgress || []) as any[]
  const moduleList = (modules || []) as any[]
  const moduleIds = new Set(moduleList.map((m) => m.id))
  const lessonList = ((lessons || []) as any[]).filter((l) => moduleIds.has(l.module_id))
  const lessonById = new Map(lessonList.map((l) => [l.id, l]))
  const courseTitle = new Map(courseList.map((c) => [c.id, c.title]))
  const moduleById = new Map(moduleList.map((m) => [m.id, m]))

  // Prefer range-windowed progress; fall back to all-time if sparse
  const rangedProgress = progressListAll.filter(
    (p) => p.last_accessed_at && p.last_accessed_at >= sinceRange
  )
  const progressList =
    rangedProgress.length >= 10 ? rangedProgress : progressListAll

  const active14 = enrollmentList.filter(
    (e) => e.last_accessed_at && e.last_accessed_at >= since14
  ).length
  const engagementRate =
    enrollmentList.length > 0 ? Math.round((active14 / enrollmentList.length) * 100) : 0

  // At-risk: no access 14d OR progress < cohort median - 20
  const byCourse: Record<string, number[]> = {}
  for (const e of enrollmentList) {
    if (!byCourse[e.course_id]) byCourse[e.course_id] = []
    byCourse[e.course_id].push(e.progress_percentage || 0)
  }
  const cohortMedian = Object.fromEntries(
    Object.entries(byCourse).map(([id, vals]) => [id, median(vals)])
  )

  const atRisk = enrollmentList.filter((e) => {
    const inactive = !e.last_accessed_at || e.last_accessed_at < since14
    const lag =
      (e.progress_percentage || 0) < Math.max(0, (cohortMedian[e.course_id] || 0) - 20)
    return e.status === 'active' && !e.completed_at && (inactive || lag)
  })

  const atRiskUserIds = [...new Set(atRisk.map((e) => e.user_id))].slice(0, 100)
  const { data: profiles } = atRiskUserIds.length
    ? await db.from('profiles').select('id, full_name, email').in('id', atRiskUserIds)
    : { data: [] }
  const nameById = new Map(((profiles || []) as any[]).map((p) => [p.id, p.full_name || p.email]))

  // Assessment quality
  const quizList = ((quizzes || []) as any[]).filter((q) => {
    const lesson = lessonById.get(q.lesson_id)
    return !!lesson
  })
  const quizIds = quizList.map((q) => q.id)
  let attempts: any[] = []
  if (quizIds.length) {
    const { data } = await db
      .from('quiz_attempts')
      .select('id, quiz_id, score, passed, completed_at')
      .in('quiz_id', quizIds.slice(0, 200))
    attempts = (data || []) as any[]
  }
  const byQuiz: Record<string, { total: number; passed: number; scoreSum: number }> = {}
  for (const a of attempts) {
    if (!byQuiz[a.quiz_id]) byQuiz[a.quiz_id] = { total: 0, passed: 0, scoreSum: 0 }
    byQuiz[a.quiz_id].total += 1
    if (a.passed) byQuiz[a.quiz_id].passed += 1
    byQuiz[a.quiz_id].scoreSum += a.score || 0
  }
  const quizTitle = new Map(quizList.map((q) => [q.id, q.title]))

  // Activity / assignment grading backlog
  const courseLessonIds = lessonList.map((l) => l.id)
  let activityProgress: any[] = []
  if (courseLessonIds.length) {
    const { data } = await db
      .from('lesson_activity_progress')
      .select('id, lesson_id, activity_id, status, grade, max_grade, source, completed')
      .in('lesson_id', courseLessonIds.slice(0, 500))
      .in('source', ['submission', 'response'])
      .limit(5000)
    activityProgress = (data || []) as any[]
  }
  const assessableKeys = currentAssessableActivityKeys(lessonList)
  const submittedActivities = activityProgress.filter(
    (r) =>
      assessableKeys.has(`${r.lesson_id}:${r.activity_id}`) && (r.completed || r.status)
  )
  const pendingActivities = submittedActivities.filter(
    (r) => r.status !== 'graded' && r.status !== 'returned'
  )
  const gradedActivities = submittedActivities.filter(
    (r) => r.status === 'graded' || r.status === 'returned'
  )
  const gradedWithScore = gradedActivities.filter((r) => r.grade != null)
  const avgActivityGrade =
    gradedWithScore.length > 0
      ? Math.round(
          (gradedWithScore.reduce((s, r) => {
            const max = r.max_grade > 0 ? Number(r.max_grade) : 100
            return s + (Number(r.grade) / max) * 100
          }, 0) /
            gradedWithScore.length) *
            10
        ) / 10
      : 0
  const gradedRate =
    submittedActivities.length > 0
      ? Math.round((gradedActivities.length / submittedActivities.length) * 100)
      : 0

  const gradingByCourse: Record<string, { submitted: number; pending: number; graded: number }> = {}
  for (const row of submittedActivities) {
    const lesson = lessonById.get(row.lesson_id)
    const mod = lesson ? moduleById.get(lesson.module_id) : null
    const courseId = mod?.course_id as string | undefined
    if (!courseId) continue
    if (!gradingByCourse[courseId]) {
      gradingByCourse[courseId] = { submitted: 0, pending: 0, graded: 0 }
    }
    gradingByCourse[courseId].submitted += 1
    if (row.status === 'graded' || row.status === 'returned') gradingByCourse[courseId].graded += 1
    else gradingByCourse[courseId].pending += 1
  }
  const gradingRows = Object.entries(gradingByCourse)
    .map(([courseId, stats]) => ({
      id: courseId,
      href: gradingHref(courseId),
      actionLabel: 'Grade',
      cells: {
        course: courseTitle.get(courseId) || courseId,
        submitted: stats.submitted,
        pending: stats.pending,
        graded: stats.graded,
        gradedRate:
          stats.submitted > 0 ? `${Math.round((stats.graded / stats.submitted) * 100)}%` : '—',
      },
    }))
    .sort((a, b) => Number(b.cells.pending) - Number(a.cells.pending))

  // Quiz fail rate by lesson
  const quizIdsByLesson: Record<string, string[]> = {}
  for (const q of quizList) {
    if (!q.lesson_id) continue
    if (!quizIdsByLesson[q.lesson_id]) quizIdsByLesson[q.lesson_id] = []
    quizIdsByLesson[q.lesson_id].push(q.id)
  }
  const quizFailByLesson: Record<string, number | null> = {}
  for (const [lessonId, qids] of Object.entries(quizIdsByLesson)) {
    let total = 0
    let failed = 0
    for (const qid of qids) {
      const stats = byQuiz[qid]
      if (!stats) continue
      total += stats.total
      failed += stats.total - stats.passed
    }
    quizFailByLesson[lessonId] = total > 0 ? Math.round((failed / total) * 100) : null
  }

  // Lesson friction aggregates
  type Agg = {
    starts: number
    finishes: number
    timeSum: number
    timeCount: number
    stuck: number
    courseId: string
  }
  const byLesson: Record<string, Agg> = {}
  for (const p of progressList) {
    if (!p.lesson_id) continue
    const lesson = lessonById.get(p.lesson_id)
    const mod = lesson ? moduleById.get(lesson.module_id) : null
    const courseId = p.course_id || mod?.course_id
    if (!courseId) continue
    if (!byLesson[p.lesson_id]) {
      byLesson[p.lesson_id] = {
        starts: 0,
        finishes: 0,
        timeSum: 0,
        timeCount: 0,
        stuck: 0,
        courseId,
      }
    }
    const agg = byLesson[p.lesson_id]
    agg.starts += 1
    if (p.completed) agg.finishes += 1
    if (p.time_spent_seconds) {
      agg.timeSum += p.time_spent_seconds
      agg.timeCount += 1
    }
    const pct = p.progress_percentage ?? 0
    if (!p.completed && pct >= 10 && pct <= 80) agg.stuck += 1
  }

  // Cohort median minutes per course (among lessons with time data)
  const minutesByCourse: Record<string, number[]> = {}
  for (const [lessonId, agg] of Object.entries(byLesson)) {
    if (agg.timeCount <= 0) continue
    const avgMin = Math.round(agg.timeSum / agg.timeCount / 60)
    if (!minutesByCourse[agg.courseId]) minutesByCourse[agg.courseId] = []
    minutesByCourse[agg.courseId].push(avgMin)
    void lessonId
  }
  const cohortMedianMinutes = Object.fromEntries(
    Object.entries(minutesByCourse).map(([id, vals]) => [id, median(vals)])
  )

  const hotspotCandidates: FrictionHotspot[] = []
  for (const [lessonId, agg] of Object.entries(byLesson)) {
    if (agg.starts < 3) continue
    const finishRate = Math.round((agg.finishes / agg.starts) * 100)
    const dropOffPct = 100 - finishRate
    const avgMinutes =
      agg.timeCount > 0 ? Math.round(agg.timeSum / agg.timeCount / 60) : 0
    const cohortMed = cohortMedianMinutes[agg.courseId] || 0
    const stuckRate = Math.round((agg.stuck / agg.starts) * 100)
    const quizFailRate = quizFailByLesson[lessonId] ?? null
    const hesitationBoost =
      cohortMed > 0 && avgMinutes >= cohortMed * 2
        ? Math.min(100, Math.round((avgMinutes / Math.max(1, cohortMed)) * 40))
        : avgMinutes >= 20 && finishRate < 85
          ? 50
          : 0

    const include =
      finishRate < 70 ||
      stuckRate >= 40 ||
      (cohortMed > 0 && avgMinutes >= cohortMed * 2 && finishRate < 85) ||
      (quizFailRate != null && quizFailRate >= 40)

    if (!include) continue

    const frictionType = pickFrictionType({
      dropOffPct,
      hesitationBoost,
      stuckRate,
      quizFailRate,
    })
    const score = frictionScore({
      dropOffPct,
      stuckRate,
      hesitationBoost,
      quizFailRate,
    })
    const lesson = lessonById.get(lessonId)

    hotspotCandidates.push({
      lessonId,
      lessonTitle: lesson?.title || lessonId,
      courseId: agg.courseId,
      courseTitle: courseTitle.get(agg.courseId) || '—',
      starts: agg.starts,
      finishes: agg.finishes,
      finishRate,
      dropOffPct,
      avgMinutes,
      cohortMedianMinutes: cohortMed,
      stuckRate,
      quizFailRate,
      frictionType,
      frictionScore: score,
    })
  }

  const hotspots = hotspotCandidates
    .sort((a, b) => b.frictionScore - a.frictionScore)
    .slice(0, 25)

  // Sequence funnel for course with most friction lessons
  const frictionCountByCourse: Record<string, number> = {}
  for (const h of hotspots) {
    frictionCountByCourse[h.courseId] = (frictionCountByCourse[h.courseId] || 0) + 1
  }
  const topFrictionCourseId = Object.entries(frictionCountByCourse).sort(
    (a, b) => b[1] - a[1]
  )[0]?.[0]

  let sequenceFunnel: FunnelStep[] = []
  let sequenceCourseTitle: string | undefined
  let sequenceCourseId: string | undefined

  if (topFrictionCourseId) {
    sequenceCourseId = topFrictionCourseId
    sequenceCourseTitle = courseTitle.get(topFrictionCourseId)
    const courseModules = moduleList
      .filter((m) => m.course_id === topFrictionCourseId)
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    const orderedLessons: any[] = []
    for (const mod of courseModules) {
      const modsLessons = lessonList
        .filter((l) => l.module_id === mod.id)
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
      orderedLessons.push(...modsLessons)
    }
    // Cap funnel steps for readability
    const steps = orderedLessons.slice(0, 12)
    sequenceFunnel = steps.map((l, i) => ({
      key: l.id,
      label: l.title?.length > 18 ? `${l.title.slice(0, 16)}…` : l.title || `L${i + 1}`,
      count: byLesson[l.id]?.starts || 0,
    }))
  }

  const frictionMap: FrictionMapPayload = {
    hotspots,
    sequenceFunnel,
    sequenceCourseTitle,
    sequenceCourseId,
  }

  const frictionRows = hotspots.map((h) => ({
    id: h.lessonId,
    href: lessonHref(h.courseId, h.lessonId),
    actionLabel: 'Edit lesson',
    cells: {
      lesson: h.lessonTitle,
      course: h.courseTitle,
      finishRate: `${h.finishRate}%`,
      dropOff: `${h.dropOffPct}%`,
      avgMin: h.avgMinutes,
      stuckRate: `${h.stuckRate}%`,
      quizFail: h.quizFailRate != null ? `${h.quizFailRate}%` : '—',
      type: h.frictionType,
      score: h.frictionScore,
    },
  }))

  const statusCounts: Record<string, number> = {}
  for (const e of enrollmentList) {
    statusCounts[e.status] = (statusCounts[e.status] || 0) + 1
  }
  const inviteList = (invites || []) as any[]
  const redeemed = inviteList.filter((i) => !!i.used_at).length

  const certCount = (certificates || []).length
  const reviewList = (reviews || []) as any[]
  const avgRating =
    reviewList.length > 0
      ? (reviewList.reduce((s, r) => s + (r.rating || 0), 0) / reviewList.length).toFixed(1)
      : '—'

  const weeklyActive = enrollmentList.filter(
    (e) => e.last_accessed_at && e.last_accessed_at >= since7
  ).length

  const atRiskByCourse: Record<string, number> = {}
  for (const e of atRisk) {
    atRiskByCourse[e.course_id] = (atRiskByCourse[e.course_id] || 0) + 1
  }
  const topAtRiskCourseId = Object.entries(atRiskByCourse).sort((a, b) => b[1] - a[1])[0]?.[0]
  const atRiskRosterHref = topAtRiskCourseId ? courseRosterHref(topAtRiskCourseId) : undefined
  const topGrading = gradingRows.find((row) => Number(row.cells.pending) > 0)
  const pendingGradeHref = topGrading?.href
  const topHotspot = hotspots[0]
  const topLessonHref = topHotspot
    ? lessonHref(topHotspot.courseId, topHotspot.lessonId)
    : undefined
  const quizLesson = new Map(
    quizList.map((q) => {
      const lesson = lessonById.get(q.lesson_id)
      const mod = lesson ? moduleById.get(lesson.module_id) : null
      return [q.id, { lessonId: q.lesson_id as string | undefined, courseId: mod?.course_id as string | undefined }]
    })
  )

  const blocks: ReportBlock[] = [
    {
      id: 'engagement',
      title: 'Engagement',
      metrics: [
        { key: 'courses', label: 'Courses', value: courseList.length },
        { key: 'enrollments', label: 'Enrollments', value: enrollmentList.length },
        { key: 'weekly', label: 'Active (7d)', value: weeklyActive },
        { key: 'rate', label: 'Engagement (14d)', value: `${engagementRate}%` },
      ],
      columns: [
        { key: 'course', label: 'Course' },
        { key: 'students', label: 'Students' },
        { key: 'active14', label: 'Active 14d' },
        { key: 'avgProgress', label: 'Avg progress' },
      ],
      rows: courseList.map((c) => {
        const ens = enrollmentList.filter((e) => e.course_id === c.id)
        const active = ens.filter((e) => e.last_accessed_at && e.last_accessed_at >= since14).length
        const avg =
          ens.length > 0
            ? Math.round(ens.reduce((s, e) => s + (e.progress_percentage || 0), 0) / ens.length)
            : 0
        return {
          id: c.id,
          href: courseRosterHref(c.id),
          actionLabel: 'Open roster',
          cells: {
            course: c.title,
            students: ens.length,
            active14: active,
            avgProgress: `${avg}%`,
          },
        }
      }),
    },
    {
      id: 'at-risk',
      title: 'At-risk learners',
      description: 'Inactive 14+ days or lagging cohort median by 20+ points.',
      metrics: [
        {
          key: 'count',
          label: 'At-risk students',
          value: atRisk.length,
          href: atRiskRosterHref,
        },
      ],
      columns: [
        { key: 'student', label: 'Student' },
        { key: 'course', label: 'Course' },
        { key: 'progress', label: 'Progress %' },
        { key: 'lastAccess', label: 'Last accessed' },
      ],
      rows: atRisk.slice(0, 50).map((e) => ({
        id: e.id,
        href: learnerHref(e.course_id, e.user_id),
        actionLabel: 'Review learner',
        cells: {
          student: nameById.get(e.user_id) || e.user_id.slice(0, 8),
          course: courseTitle.get(e.course_id) || e.course_id,
          progress: e.progress_percentage ?? 0,
          lastAccess: e.last_accessed_at
            ? new Date(e.last_accessed_at).toLocaleDateString()
            : 'Never',
        },
      })),
      emptyMessage: 'No at-risk learners detected.',
    },
    {
      id: 'assessment-quality',
      title: 'Assessment quality',
      metrics: [
        {
          key: 'pending',
          label: 'Pending activity grades',
          value: pendingActivities.length,
          href: pendingGradeHref,
        },
        {
          key: 'gradedRate',
          label: 'Activity graded rate',
          value: `${gradedRate}%`,
        },
        {
          key: 'avgActivity',
          label: 'Avg activity score %',
          value: avgActivityGrade,
        },
        {
          key: 'submitted',
          label: 'Activity submissions',
          value: submittedActivities.length,
        },
      ],
      columns: [
        { key: 'quiz', label: 'Quiz' },
        { key: 'attempts', label: 'Attempts' },
        { key: 'passRate', label: 'Pass rate' },
        { key: 'avgScore', label: 'Avg score' },
      ],
      rows: Object.entries(byQuiz).map(([quizId, stats]) => {
        const meta = quizLesson.get(quizId)
        const href =
          meta?.courseId && meta.lessonId ? lessonHref(meta.courseId, meta.lessonId) : undefined
        return {
        id: quizId,
        href,
        actionLabel: href ? 'Edit lesson' : undefined,
        cells: {
          quiz: quizTitle.get(quizId) || quizId,
          attempts: stats.total,
          passRate: `${Math.round((stats.passed / stats.total) * 100)}%`,
          avgScore: Math.round(stats.scoreSum / stats.total),
        },
        }
      }),
      emptyMessage: 'No quiz attempts or activity submissions for your courses yet.',
    },
    {
      id: 'grading-queue',
      title: 'Grading queue',
      description: 'Submitted work waiting for a grade. Open a course to grade it.',
      metrics: [
        { key: 'submitted', label: 'Submitted', value: submittedActivities.length },
        { key: 'pending', label: 'Pending', value: pendingActivities.length, href: pendingGradeHref },
        { key: 'graded', label: 'Graded', value: gradedActivities.length },
        { key: 'gradedRate', label: 'Graded rate', value: `${gradedRate}%` },
      ],
      split: { pending: pendingActivities.length, graded: gradedActivities.length },
      columns: [
        { key: 'course', label: 'Course' },
        { key: 'submitted', label: 'Submitted' },
        { key: 'pending', label: 'Pending' },
        { key: 'graded', label: 'Graded' },
        { key: 'gradedRate', label: 'Graded rate' },
      ],
      rows: gradingRows,
      emptyMessage: 'Nothing is waiting to be graded.',
    },
    {
      id: 'roster-ops',
      title: 'Roster ops',
      metrics: [
        ...Object.entries(statusCounts).map(([status, count]) => ({
          key: status,
          label: `Status: ${status}`,
          value: count,
        })),
        { key: 'invites', label: 'Invites', value: inviteList.length },
        { key: 'redeemed', label: 'Invites used', value: redeemed },
      ],
    },
    {
      id: 'outcomes',
      title: 'Outcomes',
      metrics: [
        {
          key: 'completions',
          label: 'Completions',
          value: enrollmentList.filter((e) => e.completed_at || e.status === 'completed').length,
        },
        { key: 'certs', label: 'Certificates issued', value: certCount },
        { key: 'rating', label: 'Avg review rating', value: avgRating },
        { key: 'reviews', label: 'Reviews', value: reviewList.length },
      ],
    },
    {
      id: 'lesson-friction',
      title: 'Lesson Friction Map',
      description:
        'Behavioral hotspots: drop-off, hesitation (dwell), stuck mid-lesson, and assessment fail rates (≥3 starts).',
      metrics: [
        { key: 'hotspots', label: 'Friction hotspots', value: hotspots.length, href: topLessonHref },
        {
          key: 'topScore',
          label: 'Top friction score',
          value: hotspots[0]?.frictionScore ?? 0,
        },
      ],
      columns: [
        { key: 'lesson', label: 'Lesson' },
        { key: 'course', label: 'Course' },
        { key: 'finishRate', label: 'Finish rate' },
        { key: 'dropOff', label: 'Drop-off' },
        { key: 'avgMin', label: 'Avg min' },
        { key: 'stuckRate', label: 'Stuck rate' },
        { key: 'quizFail', label: 'Quiz fail' },
        { key: 'type', label: 'Type' },
        { key: 'score', label: 'Score' },
      ],
      rows: frictionRows,
      emptyMessage: 'No high-friction lessons detected yet.',
    },
  ]

  return { blocks, frictionMap }
}
