/**
 * Build instructor showcase fields from live course / enrollment / certificate data.
 */

export type InstructorStatsInput = {
  id: string
  full_name?: string | null
  avatar_url?: string | null
  bio?: string | null
  metadata?: Record<string, unknown> | null
  courses: Array<{
    id: string
    title?: string | null
    category?: string | null
    tags?: string[] | null
    average_rating?: number | null
    rating_count?: number | null
    enrollment_count?: number | null
    is_published?: boolean | null
  }>
  /** Distinct enrolled student count across their courses (preferred over sum of enrollment_count) */
  studentsCount?: number
  /** Certificates this instructor personally earned */
  earnedCertificates?: Array<{ courseTitle?: string | null; issuedAt?: string | null }>
  /** Count of certificates issued to students of their courses */
  certificatesIssuedToStudents?: number
}

export type InstructorShowcaseData = {
  id: string
  full_name: string
  avatar_url?: string
  bio?: string
  expertise: string[]
  rating: number | null
  students_count: number
  courses_count: number
  achievements: string[]
  location?: string
  website?: string
  years_experience?: number
  social_links?: {
    linkedin?: string
    github?: string
    website?: string
  }
}

function uniqueStrings(values: Array<string | null | undefined>, limit = 8): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const v = (raw || '').trim()
    if (!v) continue
    const key = v.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(v)
    if (out.length >= limit) break
  }
  return out
}

/**
 * Expertise from profile metadata (if set) else published course categories + tags.
 */
export function deriveExpertise(input: InstructorStatsInput): string[] {
  const meta = input.metadata || {}
  const fromMeta = Array.isArray(meta.expertise)
    ? (meta.expertise as unknown[]).map(String)
    : typeof meta.expertise === 'string'
      ? String(meta.expertise)
          .split(',')
          .map((s) => s.trim())
      : []

  if (fromMeta.filter(Boolean).length > 0) {
    return uniqueStrings(fromMeta, 8)
  }

  const published = input.courses.filter((c) => c.is_published !== false)
  const categories = published.map((c) => c.category)
  const tags = published.flatMap((c) => c.tags || [])
  const derived = uniqueStrings([...categories, ...tags], 8)
  return derived.length > 0 ? derived : ['Instructor']
}

export function deriveRating(courses: InstructorStatsInput['courses']): number | null {
  const rated = courses.filter(
    (c) => c.is_published !== false && (c.rating_count || 0) > 0 && (c.average_rating || 0) > 0
  )
  if (rated.length === 0) return null
  let weighted = 0
  let weight = 0
  for (const c of rated) {
    const w = Number(c.rating_count) || 1
    weighted += Number(c.average_rating) * w
    weight += w
  }
  return weight ? Math.round((weighted / weight) * 10) / 10 : null
}

export function deriveAchievements(input: InstructorStatsInput): string[] {
  const achievements: string[] = []
  const published = input.courses.filter((c) => c.is_published !== false)
  const coursesCount = published.length
  const students =
    input.studentsCount ??
    published.reduce((sum, c) => sum + (Number(c.enrollment_count) || 0), 0)
  const rating = deriveRating(published)
  const issued = input.certificatesIssuedToStudents || 0
  const earned = input.earnedCertificates || []

  if (coursesCount >= 1) {
    achievements.push(
      coursesCount === 1
        ? 'Published 1 course'
        : `Published ${coursesCount} courses`
    )
  }
  if (students >= 1) {
    achievements.push(
      students === 1 ? 'Taught 1 student' : `Reached ${students.toLocaleString()} students`
    )
  }
  if (rating !== null && rating >= 4) {
    achievements.push(`${rating}★ average course rating`)
  }
  if (issued >= 1) {
    achievements.push(
      issued === 1
        ? '1 student certificate issued'
        : `${issued.toLocaleString()} student certificates issued`
    )
  }
  for (const cert of earned.slice(0, 5)) {
    if (cert.courseTitle) {
      achievements.push(`Earned certificate: ${cert.courseTitle}`)
    }
  }
  if (earned.length > 5) {
    achievements.push(`+${earned.length - 5} more personal certificates`)
  }

  return achievements
}

export function buildInstructorShowcaseData(input: InstructorStatsInput): InstructorShowcaseData {
  const meta = (input.metadata || {}) as Record<string, any>
  const published = input.courses.filter((c) => c.is_published !== false)
  const students =
    input.studentsCount ??
    published.reduce((sum, c) => sum + (Number(c.enrollment_count) || 0), 0)

  return {
    id: input.id,
    full_name: input.full_name || 'Instructor',
    avatar_url: input.avatar_url || undefined,
    bio: input.bio || undefined,
    expertise: deriveExpertise(input),
    rating: deriveRating(published),
    students_count: students,
    courses_count: published.length,
    achievements: deriveAchievements(input),
    location: typeof meta.location === 'string' ? meta.location : undefined,
    website: typeof meta.website === 'string' ? meta.website : undefined,
    years_experience:
      typeof meta.years_experience === 'number' ? meta.years_experience : undefined,
    social_links: meta.social_links && typeof meta.social_links === 'object'
      ? meta.social_links
      : undefined,
  }
}
