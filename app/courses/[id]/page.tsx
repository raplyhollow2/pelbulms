'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Hourglass, Building2, Star, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CourseActionDeck } from '@/components/courses/course-action-deck'
import { CurriculumTimeline } from '@/components/courses/curriculum-timeline'
import { CourseDetailSkeleton } from '@/components/courses/course-detail-skeleton'
import { CourseCard } from '@/components/courses/course-card'
import { CourseShareButton } from '@/components/courses/course-share-dialog'
import { CourseDescription } from '@/components/course/course-description'
import { ReviewsDashboard } from '@/components/course/reviews-dashboard'
import { courseDescriptionPlain } from '@/lib/course-description'
import { resumeLearnPath } from '@/lib/resume-path'
import { postEnrollmentRequest } from '@/lib/request-enrollment'
import { toast } from 'sonner'
import type { Database } from '@/types/database.types'
import {
  loadCourseInstitutions,
  userCanSeeCourseAudience,
  institutionLabel,
} from '@/lib/course-institution-access'
import { canAccessTeaching } from '@/lib/roles'
import { LinkedInProfileLink } from '@/components/profile/linkedin-profile-link'
import { linkedinFromProfile } from '@/lib/social-links'
import { loadCourseFacilitators } from '@/lib/course-facilitators'

type Course = Database['public']['Tables']['courses']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']
type RelatedCourse = Course & {
  profiles?: Pick<Profile, 'full_name' | 'avatar_url' | 'bio'> | null
}

type OutlineLesson = {
  id: string
  title: string
  duration_minutes?: number | null
  order_index?: number | null
  is_published: boolean
  is_free: boolean
  is_preview: boolean
  is_upcoming: boolean
}

type OutlineModule = {
  id: string
  title: string
  description?: string | null
  order_index: number
  lessons?: OutlineLesson[]
}

function toOutlineLesson(lesson: {
  id: string
  title: string
  duration_minutes?: number | null
  order_index?: number | null
  is_published?: boolean | null
  is_free?: boolean | null
  is_preview?: boolean | null
}): OutlineLesson {
  const published = lesson.is_published === true
  const free = published && lesson.is_free === true
  return {
    id: lesson.id,
    title: lesson.title,
    duration_minutes: lesson.duration_minutes || undefined,
    order_index: lesson.order_index ?? null,
    is_published: published,
    is_free: free,
    is_preview: published && (free || lesson.is_preview === true),
    is_upcoming: !published,
  }
}

async function fetchLiveStudentCount(courseId: string): Promise<number | null> {
  try {
    const res = await fetch('/api/courses/catalog-stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseIds: [courseId] }),
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      stats?: Record<string, { students?: number }>
    }
    const students = json.stats?.[courseId]?.students
    return typeof students === 'number' ? students : null
  } catch {
    return null
  }
}

export default function CourseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.id as string

  const [course, setCourse] = useState<(Course & { students_count?: number }) | null>(null)
  const [facilitators, setFacilitators] = useState<
    Array<
      Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'bio'> & {
        staffRole?: string
        social_links?: unknown
      }
    >
  >([])
  const [modules, setModules] = useState<any[]>([])
  const [relatedCourses, setRelatedCourses] = useState<RelatedCourse[]>([])
  const [instructorCourses, setInstructorCourses] = useState<RelatedCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState<{ names: string[] } | null>(null)
  const [isEnrolled, setIsEnrolled] = useState(false)
  const [enrollmentPending, setEnrollmentPending] = useState(false)
  const [enrolling, setEnrolling] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [lastLessonId, setLastLessonId] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState('')

  const supabase = createClient()

  useEffect(() => {
    fetchCourseDetails()
  }, [courseId])

  const fetchCourseDetails = async () => {
    try {
      setLoading(true)
      setAccessDenied(null)

      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)

      const paidSession =
        user && typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('session_id')
          : null

      const profilePromise = user
        ? supabase
            .from('profiles')
            .select('role, institution_id')
            .eq('id', user.id)
            .maybeSingle()
        : Promise.resolve({ data: null })

      const coursePromise = supabase
        .from('courses')
        .select(`
          id,
          title,
          description,
          thumbnail_url,
          instructor_id,
          category,
          level,
          language,
          price,
          duration_minutes,
          learning_objectives,
          requirements,
          tags,
          is_featured,
          is_published,
          enrollment_mode,
          average_rating,
          rating_count,
          metadata,
          updated_at,
          profiles:instructor_id (
            id,
            full_name,
            avatar_url,
            bio,
            social_links
          )
        `)
        .eq('id', courseId)
        .single()

      const enrollmentPromise =
        user && !paidSession
          ? supabase
              .from('enrollments')
              .select('id, status, last_lesson_id')
              .eq('user_id', user.id)
              .eq('course_id', courseId)
              .limit(1)
          : Promise.resolve({ data: null as { id: string; status?: string; last_lesson_id?: string | null }[] | null })

      const [profileResult, courseResult, enrollmentResult, audienceInstitutions] = await Promise.all([
        profilePromise,
        coursePromise,
        enrollmentPromise,
        loadCourseInstitutions(supabase as any, courseId),
      ])
      const profile = profileResult.data as { role?: string; institution_id?: string | null } | null
      const { data: courseData, error: courseError } = courseResult

      if (courseError || !courseData) {
        setAccessDenied({ names: [] })
        setCourse(null)
        return
      }

      let enrolled = false
      let pending = false
      let enrollmentRows = enrollmentResult.data
      if (user && paidSession) {
        const paidRes = await fetch('/api/enrollments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId, sessionId: paidSession }),
        })
        if (paidRes.ok) {
          enrolled = true
          pending = false
        }
        const paidEnrollment = await supabase
          .from('enrollments')
          .select('id, status, last_lesson_id')
          .eq('user_id', user.id)
          .eq('course_id', courseId)
          .limit(1)
        enrollmentRows = paidEnrollment.data
      }
      if (user && enrollmentRows?.[0]) {
        const row = enrollmentRows[0] as { status?: string; last_lesson_id?: string | null }
        const status = row.status || 'active'
        enrolled = status === 'active' || status === 'completed'
        pending = status === 'pending'
        setLastLessonId(row.last_lesson_id || null)
      }
      setIsEnrolled(enrolled)
      setEnrollmentPending(pending)
      const isOwner = Boolean(user && (courseData as any).instructor_id === user.id)
      const allowed = userCanSeeCourseAudience({
        institutionIds: audienceInstitutions.map((i) => i.id),
        userInstitutionId: profile?.institution_id,
        role: profile?.role,
        isInstructorOrStaff: isOwner || canAccessTeaching(profile?.role),
        isEnrolled: enrolled || pending,
      })

      if (!allowed) {
        setAccessDenied({ names: audienceInstitutions.map((i) => institutionLabel(i)) })
        setCourse(null)
        return
      }

      const ownerId = (courseData as any).instructor_id as string | null
      const category = (courseData as { category?: string | null }).category
      const [liveStudentCount, orderedFacilitators, siblingResult, outlineResult] =
        await Promise.all([
        fetchLiveStudentCount(courseId),
        loadCourseFacilitators(supabase, courseId, ownerId).catch((staffErr) => {
          console.log('Facilitators fetch error:', staffErr)
          return [] as Awaited<ReturnType<typeof loadCourseFacilitators>>
        }),
        supabase
          .from('courses')
          .select(`
            *,
            profiles:instructor_id (
              full_name,
              avatar_url,
              bio
            )
          `)
          .eq('is_published', true)
          .neq('id', courseId)
          .limit(24),
        fetch(`/api/courses/${courseId}/outline`).then(async (res) => {
          if (!res.ok) return null
          return (await res.json()) as { modules?: OutlineModule[] }
        }).catch(() => null),
      ])

      if (orderedFacilitators.length > 0) {
        setFacilitators(orderedFacilitators)
      } else {
        setFacilitators(
          (courseData as any).profiles ? [(courseData as any).profiles] : []
        )
      }

      const outlineModules = outlineResult?.modules
      if (outlineModules) {
        setModules(
          outlineModules.map((moduleRow) => ({
            ...moduleRow,
            lessons: (moduleRow.lessons || []).map((lesson) => toOutlineLesson(lesson)),
          }))
        )
      } else {
        const { data: moduleRows } = await supabase
          .from('modules')
          .select('id, title, description, order_index')
          .eq('course_id', courseId)
          .order('order_index', { ascending: true })
        const moduleIds = ((moduleRows || []) as { id: string }[]).map((row) => row.id)
        let visibleLessons: {
          id: string
          module_id: string
          title: string
          duration_minutes?: number | null
          order_index?: number | null
          is_free?: boolean | null
          is_preview?: boolean | null
          is_published?: boolean | null
        }[] = []
        if (moduleIds.length > 0) {
          const { data: lessonRows } = await supabase
            .from('lessons')
            .select('id, module_id, title, duration_minutes, order_index, is_published, is_free, is_preview')
            .in('module_id', moduleIds)
            .order('order_index', { ascending: true })
          visibleLessons = (lessonRows || []) as typeof visibleLessons
        }
        setModules(
          ((moduleRows || []) as { id: string }[]).map((moduleRow) => ({
            ...moduleRow,
            lessons: visibleLessons
              .filter((lesson) => lesson.module_id === moduleRow.id)
              .map((lesson) => toOutlineLesson(lesson)),
          }))
        )
      }
      const siblingRows = ((siblingResult as { data?: RelatedCourse[] | null }).data || []) as RelatedCourse[]
      let siblingStats: Record<string, { modules?: number; students?: number }> = {}
      if (siblingRows.length > 0) {
        try {
          const statsRes = await fetch('/api/courses/catalog-stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseIds: siblingRows.map((item) => item.id) }),
          })
          if (statsRes.ok) {
            const statsJson = (await statsRes.json()) as {
              stats?: Record<string, { modules?: number; students?: number }>
            }
            siblingStats = statsJson.stats || {}
          }
        } catch {
          siblingStats = {}
        }
      }
      const siblings = siblingRows.map((item) => ({
        ...item,
        modules_count: siblingStats[item.id]?.modules,
        students_count:
          typeof siblingStats[item.id]?.students === 'number'
            ? siblingStats[item.id]?.students
            : item.enrollment_count,
      }))
      setRelatedCourses(category ? siblings.filter((item) => item.category === category) : [])
      setInstructorCourses(ownerId ? siblings.filter((item) => item.instructor_id === ownerId) : [])
      setCourse({
        ...(courseData as any),
        students_count:
          typeof liveStudentCount === 'number'
            ? liveStudentCount
            : typeof (courseData as any).enrollment_count === 'number'
              ? (courseData as any).enrollment_count
              : 0,
      })
    } catch (error) {
      console.error('Error fetching course details:', error)
      setAccessDenied({ names: [] })
      setCourse(null)
    } finally {
      setLoading(false)
    }
  }

  const handleEnroll = async () => {
    if (!currentUser) {
      router.push('/auth/login')
      return
    }
    if (enrollmentPending || isEnrolled || enrolling) return

    try {
      setEnrolling(true)
      const stripeSessionId =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('session_id') || undefined
          : undefined
      const { ok, httpStatus, data } = await postEnrollmentRequest(courseId, {
        inviteCode: inviteCode.trim() || undefined,
        sessionId: stripeSessionId,
      })
      if (data.needsKyc) {
        router.push('/auth/register')
        return
      }
      if (httpStatus === 402 || data.enrollmentMode === 'paid') {
        const checkout = await fetch('/api/enrollments/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId }),
        })
        const checkoutData = await checkout.json().catch(() => ({}))
        if (checkoutData.url) {
          window.location.href = checkoutData.url
          return
        }
        throw new Error(checkoutData.error || data.error || 'Payment is required')
      }
      if (!ok) throw new Error(data.error || `Failed to enroll (HTTP ${httpStatus})`)

      if (data.status === 'pending' || data.pending) {
        setEnrollmentPending(true)
        setIsEnrolled(false)
        return
      }

      setIsEnrolled(true)
      setEnrollmentPending(false)
      if (data.alreadyEnrolled) {
        router.push(resumeLearnPath(courseId, lastLessonId))
        return
      }

      router.push(resumeLearnPath(courseId, lastLessonId))
    } catch (error: any) {
      if (error?.name === 'AbortError') return
      console.error('Enrollment error:', error?.message || error)
      toast.error(error?.message ? `Failed to enroll: ${error.message}` : 'Failed to enroll. Please try again.')
    } finally {
      setEnrolling(false)
    }
  }

  if (loading) {
    return <CourseDetailSkeleton />
  }

  if (!course) {
    const restrictedNames = accessDenied?.names?.filter(Boolean) || []
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-md space-y-4 py-12 text-center">
          <Building2 className="mx-auto h-10 w-10 text-muted-foreground" />
          <div className="space-y-2">
            <p className="font-medium">
              {accessDenied
                ? 'This course is not available for your institution'
                : 'Course not found'}
            </p>
            <p className="text-sm text-muted-foreground">
              {restrictedNames.length > 0
                ? `It is published only for members of ${restrictedNames.join(', ')}.`
                : accessDenied
                  ? 'Ask your administrator if you believe you should have access.'
                  : 'This course may have been removed or is no longer published.'}
            </p>
          </div>
          <Button variant="outline" render={<Link href="/courses" />}>
            Back to Courses
          </Button>
        </div>
      </div>
    )
  }

  const lead = courseDescriptionPlain(course.description)
  const objectives = (course.learning_objectives || []).map((item) => item.trim()).filter(Boolean)
  const requirements = (course.requirements || []).map((item) => item.trim()).filter(Boolean)
  const tags = (course.tags || []).map((item) => item.trim()).filter(Boolean)
  const rating = Number(course.average_rating) || 0
  const ratingCount = Number(course.rating_count) || 0
  const hasRating = rating > 0 && ratingCount > 0
  const studentCount = course.students_count || 0
  const updatedLabel = course.updated_at
    ? new Date(course.updated_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null
  const leadInstructor = facilitators[0]
  const lessonCount = modules.reduce(
    (sum: number, moduleRow: { lessons?: unknown[] }) => sum + (moduleRow.lessons?.length || 0),
    0
  )
  const previewCount = modules.reduce(
    (sum: number, moduleRow: { lessons?: { is_preview?: boolean }[] }) =>
      sum + (moduleRow.lessons || []).filter((lesson) => lesson.is_preview).length,
    0
  )
  const instructorCourseIds = new Set(instructorCourses.map((item) => item.id))
  const moreInCategory = relatedCourses.filter((item) => !instructorCourseIds.has(item.id))
  const deckProps = {
    course,
    isEnrolled,
    enrollmentPending,
    enrolling,
    onEnroll: handleEnroll,
    onLearn: () => router.push(resumeLearnPath(courseId, lastLessonId)),
    inviteMode: course.enrollment_mode === 'invite_code',
    inviteCode,
    onInviteCodeChange: setInviteCode,
    lessonCount,
    previewCount,
  }

  const detailBody = (
    <CourseDetailBody
      objectives={objectives}
      tags={tags}
      modules={modules}
      isEnrolled={isEnrolled}
      onLessonClick={(lessonId) => {
        const lesson = modules
          .flatMap((moduleRow) => moduleRow.lessons || [])
          .find((row: { id: string; is_preview?: boolean; is_upcoming?: boolean }) => row.id === lessonId)
        if (lesson?.is_upcoming) {
          toast.message('This lesson is not available yet.')
          return
        }
        if (isEnrolled || lesson?.is_preview) {
          router.push(`/learn/${courseId}/lesson/${lessonId}`)
          return
        }
        toast.message('Enroll to open this lesson. Free preview lessons stay open.')
      }}
      requirements={requirements}
      lead={lead}
      description={course.description}
      category={course.category}
      moreInCategory={moreInCategory}
      facilitators={facilitators}
      instructorCourses={instructorCourses}
      instructorName={leadInstructor?.full_name}
      showReviews={hasRating || isEnrolled}
      courseId={courseId}
      userId={currentUser?.id}
    />
  )

  const pendingNotice = enrollmentPending ? (
    <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
      <Hourglass className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <div>
        <p className="font-medium text-amber-900 dark:text-amber-100">Enrollment request pending</p>
        <p className="text-sm text-muted-foreground">
          Your request was sent to the course creator and course admins. You can start learning once they approve it.
        </p>
      </div>
    </div>
  ) : null

  return (
    <>
    <div className="pb-24 lg:hidden">
      <div className="mx-auto max-w-lg md:max-w-2xl">
        <CourseActionDeck {...deckProps} variant="media" />

        <div className="bg-[#1c1d1f] px-4 py-5 text-white" data-hero-section>
          <nav className="mb-3 flex flex-wrap items-center gap-1 text-xs text-white/70">
            <Link href="/courses" className="underline-offset-2 hover:underline">
              Courses
            </Link>
            {course.category && (
              <>
                <span aria-hidden>›</span>
                <Link
                  href={`/courses?category=${encodeURIComponent(course.category)}`}
                  className="underline-offset-2 hover:underline"
                >
                  {course.category}
                </Link>
              </>
            )}
          </nav>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-bold leading-tight">{course.title}</h1>
            <CourseShareButton
              courseId={course.id}
              title={course.title}
              description={course.description}
              published={Boolean(course.is_published)}
              appearance="button"
              className="shrink-0 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            />
          </div>
          {lead && <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-white/85">{lead}</p>}
          <div className="mt-3 space-y-1.5 text-xs text-white/80">
            {hasRating && (
              <p className="flex flex-wrap items-center gap-1.5">
                <span className="font-bold text-amber-400">{rating.toFixed(1)}</span>
                <span className="inline-flex" aria-hidden>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-3.5 w-3.5 ${
                        star <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-white/25'
                      }`}
                    />
                  ))}
                </span>
                <span>({ratingCount.toLocaleString()} ratings)</span>
              </p>
            )}
            <p className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {studentCount.toLocaleString()} {studentCount === 1 ? 'student' : 'students'}
            </p>
            {leadInstructor?.full_name && (
              <p>
                Created by{' '}
                <Link href={`/instructors/${leadInstructor.id}`} className="font-semibold text-primary">
                  {leadInstructor.full_name}
                </Link>
              </p>
            )}
            {(updatedLabel || course.language) && (
              <p>
                {updatedLabel ? `Last updated ${updatedLabel}` : ''}
                {updatedLabel && course.language ? ' · ' : ''}
                {course.language || ''}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-8 px-4 py-5">

        {pendingNotice}

        <CourseActionDeck {...deckProps} variant="purchase" />
        {detailBody}
        </div>
        </div>
    </div>

    <div className="relative mx-auto hidden max-w-6xl grid-cols-[minmax(0,1fr)_22rem] gap-8 px-8 pb-16 lg:grid">
      <div className="min-w-0">
        <div className="relative -mx-8 bg-[#1c1d1f] px-8 py-8 text-white before:absolute before:inset-y-0 before:left-full before:w-[calc(22rem+2rem)] before:bg-[#1c1d1f] before:content-['']">
          {course.is_featured && (
            <p className="mb-3 inline-flex rounded bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
              Featured
            </p>
          )}
          <nav className="mb-3 flex flex-wrap items-center gap-1 text-sm text-white/70">
            <Link href="/courses" className="underline-offset-2 hover:underline">
              Courses
            </Link>
            {course.category && (
              <>
                <span aria-hidden>›</span>
                <Link
                  href={`/courses?category=${encodeURIComponent(course.category)}`}
                  className="underline-offset-2 hover:underline"
                >
                  {course.category}
                </Link>
              </>
            )}
          </nav>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-3xl font-bold leading-tight">{course.title}</h1>
            <CourseShareButton
              courseId={course.id}
              title={course.title}
              description={course.description}
              published={Boolean(course.is_published)}
              appearance="button"
              className="shrink-0 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            />
          </div>
          {lead && <p className="mt-3 max-w-3xl text-base leading-relaxed text-white/85">{lead}</p>}
          <div className="mt-4 space-y-1.5 text-sm text-white/80">
            {hasRating && (
              <p className="flex flex-wrap items-center gap-1.5">
                <span className="font-bold text-amber-400">{rating.toFixed(1)}</span>
                <span className="inline-flex" aria-hidden>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-3.5 w-3.5 ${
                        star <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-white/25'
                      }`}
                    />
                  ))}
                </span>
                <span>({ratingCount.toLocaleString()} ratings)</span>
              </p>
            )}
            <p className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {studentCount.toLocaleString()} {studentCount === 1 ? 'student' : 'students'}
            </p>
            {leadInstructor?.full_name && (
              <p>
                Created by{' '}
                <Link href={`/instructors/${leadInstructor.id}`} className="font-semibold text-primary">
                  {leadInstructor.full_name}
                </Link>
              </p>
            )}
            {(updatedLabel || course.language) && (
              <p>
                {updatedLabel ? `Last updated ${updatedLabel}` : ''}
                {updatedLabel && course.language ? ' · ' : ''}
                {course.language || ''}
              </p>
            )}
          </div>
        </div>
        <div className="space-y-8 py-8">
          {pendingNotice}
          {detailBody}
        </div>
      </div>
      <aside className="sticky top-24 z-10 self-start pt-8">
        <CourseActionDeck {...deckProps} variant="sidebar" />
      </aside>
    </div>
    </>
  )
}

type Facilitator = Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'bio'> & {
  staffRole?: string
  social_links?: unknown
}

function CourseDetailBody({
  objectives,
  tags,
  modules,
  isEnrolled,
  onLessonClick,
  requirements,
  lead,
  description,
  category,
  moreInCategory,
  facilitators,
  instructorCourses,
  instructorName,
  showReviews,
  courseId,
  userId,
}: {
  objectives: string[]
  tags: string[]
  modules: any[]
  isEnrolled: boolean
  onLessonClick: (lessonId: string) => void
  requirements: string[]
  lead: string
  description: string | null
  category: string | null
  moreInCategory: RelatedCourse[]
  facilitators: Facilitator[]
  instructorCourses: RelatedCourse[]
  instructorName?: string | null
  showReviews: boolean
  courseId: string
  userId?: string
}) {
  return (
    <>
      {objectives.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">What you&apos;ll learn</h2>
          <ul className="grid gap-2 rounded-lg border p-4 sm:grid-cols-2">
            {objectives.map((objective) => (
              <li key={objective} className="flex items-start gap-2 text-sm">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                <span>{objective}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tags.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Explore related topics</h2>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Link
                key={tag}
                href={`/courses?q=${encodeURIComponent(tag)}`}
                className="rounded-full border px-3 py-1.5 text-sm font-medium hover:border-primary hover:text-primary"
              >
                {tag}
              </Link>
            ))}
          </div>
        </section>
      )}

      {modules.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Course content</h2>
          <CurriculumTimeline
            modules={modules.map((moduleRow) => ({
              ...moduleRow,
              lessons: (moduleRow.lessons || []).map((lesson: { is_preview?: boolean; is_upcoming?: boolean }) => ({
                ...lesson,
                is_locked: Boolean(lesson.is_upcoming) || (!isEnrolled && !lesson.is_preview),
              })),
            }))}
            showProgress={false}
            onLessonClick={onLessonClick}
          />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Requirements</h2>
        {requirements.length > 0 ? (
          <ul className="space-y-2">
            {requirements.map((requirement) => (
              <li key={requirement} className="flex items-start gap-2 text-sm">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />
                <span>{requirement}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No specific requirements listed.</p>
        )}
      </section>

      {lead && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Description</h2>
          <CourseDescription text={description} className="text-sm leading-relaxed" />
        </section>
      )}

      {moreInCategory.length > 0 && category && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">More courses in {category}</h2>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {moreInCategory.map((item) => (
              <div key={item.id} className="w-64 shrink-0">
                <CourseCard course={normalizeRelatedProfile(item)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {facilitators.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold">{facilitators.length > 1 ? 'Instructors' : 'Instructor'}</h2>
          {facilitators.map((person) => {
            const linkedin = linkedinFromProfile(person)
            return (
              <div key={person.id} className="flex items-start gap-3">
                <Link
                  href={`/instructors/${person.id}`}
                  className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/30"
                >
                  {person.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={person.avatar_url}
                      alt={person.full_name || 'Instructor'}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-bold">
                      {(person.full_name || 'IN')
                        .split(/\s+/)
                        .map((name) => name[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                  )}
                </Link>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/instructors/${person.id}`}
                      className="text-base font-semibold text-primary underline-offset-2 hover:underline"
                    >
                      {person.full_name}
                    </Link>
                    {person.staffRole && person.staffRole !== 'owner' && (
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {String(person.staffRole).replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </div>
                  {person.bio && (
                    <p className="mt-1 line-clamp-4 text-sm text-muted-foreground">{person.bio}</p>
                  )}
                  {linkedin && (
                    <div className="mt-2">
                      <LinkedInProfileLink url={linkedin} />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </section>
      )}

      {instructorCourses.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">More courses by {instructorName || 'this instructor'}</h2>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {instructorCourses.map((item) => (
              <div key={item.id} className="w-64 shrink-0">
                <CourseCard course={normalizeRelatedProfile(item)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {showReviews && <ReviewsDashboard courseId={courseId} userId={userId} />}
    </>
  )
}

function normalizeRelatedProfile(course: RelatedCourse): RelatedCourse {
  const profiles = course.profiles as RelatedCourse['profiles'] | NonNullable<RelatedCourse['profiles']>[] | null
  return {
    ...course,
    profiles: Array.isArray(profiles) ? profiles[0] || null : profiles || null,
  }
}
