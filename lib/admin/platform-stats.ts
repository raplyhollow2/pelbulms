import type { SupabaseClient } from '@supabase/supabase-js'

type Db = SupabaseClient<any>

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function pct(part: number, whole: number) {
  if (!whole) return 0
  return Math.round((part / whole) * 100)
}

async function countRows(db: Db, table: string, apply?: (q: any) => any) {
  let q = db.from(table).select('*', { count: 'exact', head: true })
  if (apply) q = apply(q)
  const { count, error } = await q
  if (error) throw new Error(`${table}: ${error.message}`)
  return count || 0
}

export type PlatformStats = {
  generatedAt: string
  users: {
    total: number
    byRole: Record<string, number>
    new7d: number
    new30d: number
    signedIn15m: number
    signedIn1h: number
    signedIn24h: number
    signedIn7d: number
    activitySource: 'auth' | 'enrollments'
  }
  learning: {
    enrollments: number
    inProgress: number
    completed: number
    avgProgress: number
    completionRate: number
    activeNow: number
    active1h: number
    active1d: number
    active7d: number
    active30d: number
    atRisk: number
    progressBuckets: { label: string; count: number }[]
  }
  catalog: {
    courses: number
    published: number
    draft: number
    modules: number
    lessons: number
    quizzes: number
    quizAttempts: number
    certificates: number
    flashcardDecks: number
    forums: number
    reviews: number
  }
  operations: {
    institutions: number
    activeInstitutions: number
    pendingRegistrations: number
    approvedRegistrations: number
    rejectedRegistrations: number
  }
  topCourses: {
    id: string
    title: string
    published: boolean
    enrollments: number
    avgProgress: number
    completions: number
  }[]
}

export async function computePlatformStats(db: Db): Promise<PlatformStats> {
  const since15m = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const since1h = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const since1d = daysAgo(1)
  const since7d = daysAgo(7)
  const since14d = daysAgo(14)
  const since30d = daysAgo(30)

  const [
    profilesRes,
    enrollmentsRes,
    lessonProgressRes,
    coursesRes,
    modulesCount,
    lessonsCount,
    quizzesCount,
    quizAttemptsCount,
    certificatesCount,
    decksCount,
    forumsCount,
    reviewsCount,
    institutionsRes,
    registrationsRes,
  ] = await Promise.all([
    db.from('profiles').select('id, role, created_at'),
    db
      .from('enrollments')
      .select('id, user_id, course_id, status, progress_percentage, last_accessed_at, completed_at, enrolled_at'),
    db.from('lesson_progress').select('user_id, last_accessed_at'),
    db.from('courses').select('id, title, is_published'),
    countRows(db, 'modules'),
    countRows(db, 'lessons'),
    countRows(db, 'quizzes'),
    countRows(db, 'quiz_attempts'),
    countRows(db, 'certificates'),
    countRows(db, 'flashcard_decks'),
    countRows(db, 'forums'),
    countRows(db, 'reviews'),
    db.from('institutions').select('id, is_active'),
    db.from('student_registrations').select('id, registration_status'),
  ])

  if (profilesRes.error) throw new Error(`profiles: ${profilesRes.error.message}`)
  if (enrollmentsRes.error) throw new Error(`enrollments: ${enrollmentsRes.error.message}`)
  if (coursesRes.error) throw new Error(`courses: ${coursesRes.error.message}`)
  if (institutionsRes.error) throw new Error(`institutions: ${institutionsRes.error.message}`)
  if (registrationsRes.error) {
    throw new Error(`student_registrations: ${registrationsRes.error.message}`)
  }

  const profiles = (profilesRes.data || []) as {
    id: string
    role: string | null
    created_at: string
  }[]
  const enrollments = (enrollmentsRes.data || []) as {
    id: string
    user_id: string
    course_id: string
    status: string | null
    progress_percentage: number | null
    last_accessed_at: string | null
    completed_at: string | null
    enrolled_at: string | null
  }[]
  const lessonProgress = (lessonProgressRes.data || []) as {
    user_id: string
    last_accessed_at: string | null
  }[]
  const courses = (coursesRes.data || []) as {
    id: string
    title: string
    is_published: boolean | null
  }[]
  const institutions = (institutionsRes.data || []) as { id: string; is_active: boolean | null }[]
  const registrations = (registrationsRes.data || []) as {
    id: string
    registration_status: string | null
  }[]

  const byRole: Record<string, number> = {}
  for (const p of profiles) {
    const role = p.role || 'unknown'
    byRole[role] = (byRole[role] || 0) + 1
  }

  let signedIn15m = 0
  let signedIn1h = 0
  let signedIn24h = 0
  let signedIn7d = 0
  let activitySource: 'auth' | 'enrollments' = 'enrollments'

  try {
    let page = 1
    let sawUsers = false
    for (;;) {
      const { data: authData, error } = await db.auth.admin.listUsers({ perPage: 200, page })
      if (error || !authData?.users?.length) break
      sawUsers = true
      activitySource = 'auth'
      for (const u of authData.users) {
        const ts = u.last_sign_in_at
        if (!ts) continue
        if (ts >= since15m) signedIn15m += 1
        if (ts >= since1h) signedIn1h += 1
        if (ts >= since1d) signedIn24h += 1
        if (ts >= since7d) signedIn7d += 1
      }
      if (authData.users.length < 200 || page >= 50) break
      page += 1
    }
    if (!sawUsers) activitySource = 'enrollments'
  } catch {
    activitySource = 'enrollments'
  }

  const accessedSince = (iso: string) => {
    const users = new Set<string>()
    for (const e of enrollments) {
      if (e.user_id && e.last_accessed_at && e.last_accessed_at >= iso) users.add(e.user_id)
    }
    for (const p of lessonProgress) {
      if (p.user_id && p.last_accessed_at && p.last_accessed_at >= iso) users.add(p.user_id)
    }
    return users.size
  }

  if (activitySource !== 'auth') {
    signedIn15m = accessedSince(since15m)
    signedIn1h = accessedSince(since1h)
    signedIn24h = accessedSince(since1d)
    signedIn7d = accessedSince(since7d)
  }

  const completed = enrollments.filter(
    (e) => e.completed_at || e.status === 'completed' || (e.progress_percentage || 0) >= 100
  )
  const inProgress = enrollments.filter((e) => !completed.some((c) => c.id === e.id))
  const progressValues = enrollments.map((e) =>
    Math.max(0, Math.min(100, Number(e.progress_percentage) || 0))
  )
  const avgProgress = progressValues.length
    ? Math.round(progressValues.reduce((s, n) => s + n, 0) / progressValues.length)
    : 0

  const buckets = [
    { label: '0%', min: 0, max: 0 },
    { label: '1–24%', min: 1, max: 24 },
    { label: '25–49%', min: 25, max: 49 },
    { label: '50–74%', min: 50, max: 74 },
    { label: '75–99%', min: 75, max: 99 },
    { label: '100%', min: 100, max: 100 },
  ].map((b) => ({
    label: b.label,
    count: progressValues.filter((n) => n >= b.min && n <= b.max).length,
  }))

  const atRisk = enrollments.filter((e) => {
    if (e.completed_at || e.status === 'completed' || (e.progress_percentage || 0) >= 90) return false
    const last = e.last_accessed_at || e.enrolled_at
    if (!last) return true
    return last < since14d && (e.progress_percentage || 0) < 50
  }).length

  const published = courses.filter((c) => c.is_published)
  const byCourse: Record<string, { ens: number; progress: number; done: number }> = {}
  for (const e of enrollments) {
    if (!byCourse[e.course_id]) byCourse[e.course_id] = { ens: 0, progress: 0, done: 0 }
    byCourse[e.course_id].ens += 1
    byCourse[e.course_id].progress += Math.max(0, Number(e.progress_percentage) || 0)
    if (e.completed_at || e.status === 'completed' || (e.progress_percentage || 0) >= 100) {
      byCourse[e.course_id].done += 1
    }
  }

  const topCourses = courses
    .map((c) => {
      const s = byCourse[c.id] || { ens: 0, progress: 0, done: 0 }
      return {
        id: c.id,
        title: c.title,
        published: !!c.is_published,
        enrollments: s.ens,
        avgProgress: s.ens ? Math.round(s.progress / s.ens) : 0,
        completions: s.done,
      }
    })
    .sort((a, b) => b.enrollments - a.enrollments)
    .slice(0, 8)

  const pendingStatuses = new Set([
    'submitted',
    'under_review',
    'additional_info_requested',
    'waitlisted',
    'pending',
  ])

  return {
    generatedAt: new Date().toISOString(),
    users: {
      total: profiles.length,
      byRole,
      new7d: profiles.filter((p) => p.created_at >= since7d).length,
      new30d: profiles.filter((p) => p.created_at >= since30d).length,
      signedIn15m,
      signedIn1h,
      signedIn24h,
      signedIn7d,
      activitySource,
    },
    learning: {
      enrollments: enrollments.length,
      inProgress: inProgress.length,
      completed: completed.length,
      avgProgress,
      completionRate: pct(completed.length, enrollments.length),
      activeNow: accessedSince(since15m),
      active1h: accessedSince(since1h),
      active1d: accessedSince(since1d),
      active7d: accessedSince(since7d),
      active30d: accessedSince(since30d),
      atRisk,
      progressBuckets: buckets,
    },
    catalog: {
      courses: courses.length,
      published: published.length,
      draft: courses.length - published.length,
      modules: modulesCount,
      lessons: lessonsCount,
      quizzes: quizzesCount,
      quizAttempts: quizAttemptsCount,
      certificates: certificatesCount,
      flashcardDecks: decksCount,
      forums: forumsCount,
      reviews: reviewsCount,
    },
    operations: {
      institutions: institutions.length,
      activeInstitutions: institutions.filter((i) => i.is_active !== false).length,
      pendingRegistrations: registrations.filter((r) =>
        pendingStatuses.has(r.registration_status || '')
      ).length,
      approvedRegistrations: registrations.filter((r) => r.registration_status === 'approved')
        .length,
      rejectedRegistrations: registrations.filter((r) => r.registration_status === 'rejected')
        .length,
    },
    topCourses,
  }
}
