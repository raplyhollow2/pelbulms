'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Clock, Users, Star, ArrowLeft, CheckCircle, Hourglass, Building2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CourseActionDeck } from '@/components/courses/course-action-deck'
import { CurriculumTimeline } from '@/components/courses/curriculum-timeline'
import { CourseDetailSkeleton } from '@/components/courses/course-detail-skeleton'
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

      let profile: { role?: string; institution_id?: string | null } | null = null
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('role, institution_id')
          .eq('id', user.id)
          .maybeSingle()
        profile = data as any
      }

      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select(`
          *,
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

      if (courseError || !courseData) {
        setAccessDenied({ names: [] })
        setCourse(null)
        return
      }

      let enrolled = false
      let pending = false
      if (user) {
        const paidSession =
          typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('session_id')
            : null
        if (paidSession) {
          const paidRes = await fetch('/api/enrollments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseId, sessionId: paidSession }),
          })
          if (paidRes.ok) {
            enrolled = true
            pending = false
          }
        }
        const { data: enrollmentRows } = await supabase
          .from('enrollments')
          .select('id, status, last_lesson_id')
          .eq('user_id', user.id)
          .eq('course_id', courseId)
          .limit(1)

        const row = enrollmentRows?.[0] as any
        if (row) {
          const status = row.status || 'active'
          enrolled = status === 'active' || status === 'completed'
          pending = status === 'pending'
          setLastLessonId(row.last_lesson_id || null)
        }
      }
      setIsEnrolled(enrolled)
      setEnrollmentPending(pending)

      const audienceInstitutions = await loadCourseInstitutions(supabase as any, courseId)
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

      try {
        const ownerId = (courseData as any).instructor_id as string | null
        const ordered = await loadCourseFacilitators(supabase, courseId, ownerId)
        if (ordered.length > 0) {
          setFacilitators(ordered)
        } else {
          setFacilitators(
            (courseData as any).profiles ? [(courseData as any).profiles] : []
          )
        }
      } catch (staffErr) {
        console.log('Facilitators fetch error:', staffErr)
        setFacilitators(
          (courseData as any).profiles ? [(courseData as any).profiles] : []
        )
      }

      const [{ data: modulesData }, liveStudentCount] = await Promise.all([
        supabase
          .from('modules')
          .select('*')
          .eq('course_id', courseId)
          .order('order_index', { ascending: true }),
        fetchLiveStudentCount(courseId),
      ])

      setModules(modulesData || [])
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
        <div className="mx-auto max-w-md text-center py-12 space-y-4">
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
          <Button variant="outline" onClick={() => router.push('/courses')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Courses
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-5 pb-28 sm:px-5 sm:py-7 md:px-6 md:py-8 md:pb-24 lg:px-8 lg:pb-8">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => router.push('/courses')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Courses
        </Button>

        {enrollmentPending && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
            <Hourglass className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium text-amber-900 dark:text-amber-100">Enrollment request pending</p>
              <p className="text-sm text-muted-foreground">
                Your request was sent to the course creator and course admins. You can start learning once they approve it.
              </p>
            </div>
          </div>
        )}

        {/* Course Header */}
        <div className="space-y-4" data-hero-section>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="text-xs">{course.category}</Badge>
                <Badge variant="secondary" className="text-xs capitalize">{course.level}</Badge>
                {course.is_featured && (
                  <Badge className="text-xs bg-bhutan-yellow text-bhutan-black">⭐ Featured</Badge>
                )}
              </div>
              <h1 className="text-4xl font-bold mb-2">{course.title}</h1>
              <p className="text-lg text-muted-foreground">{course.description}</p>
            </div>
          </div>

          {/* Course Stats */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span>{course.duration_minutes ? `${Math.floor(course.duration_minutes / 60)}h ${course.duration_minutes % 60}m` : 'Self-paced'}</span>
            </div>
            {course.tags && course.tags.length > 0 && (
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-muted-foreground" />
                <div className="flex gap-1">
                  {course.tags.slice(0, 3).map((tag: any) => (
                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Instructors / facilitators */}
        {facilitators.length > 0 && (
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg">
                {facilitators.length > 1 ? 'Instructors' : 'Your Instructor'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {facilitators.map((person) => {
                const linkedin = linkedinFromProfile(person)
                return (
                <div
                  key={person.id}
                  className="flex items-start gap-4"
                >
                  <a
                    href={`/instructors/${person.id}`}
                    className="w-16 h-16 rounded-full overflow-hidden bg-bhutan-yellow/30 flex items-center justify-center shrink-0"
                  >
                    {person.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={person.avatar_url}
                        alt={person.full_name || 'Instructor'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="font-bold text-lg">
                        {(person.full_name || 'IN')
                          .split(/\s+/)
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                    )}
                  </a>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={`/instructors/${person.id}`}
                        className="font-semibold text-lg hover:text-bhutan-orange transition-colors"
                      >
                        {person.full_name}
                      </a>
                      {person.staffRole && person.staffRole !== 'owner' && (
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {String(person.staffRole).replace(/_/g, ' ')}
                        </Badge>
                      )}
                      {person.staffRole === 'owner' && facilitators.length > 1 && (
                        <Badge variant="secondary" className="text-[10px]">
                          Lead
                        </Badge>
                      )}
                    </div>
                    {course.category && person.staffRole === 'owner' && (
                      <Badge variant="outline" className="mt-1 text-xs">
                        {course.category}
                      </Badge>
                    )}
                    {person.bio && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                        {person.bio}
                      </p>
                    )}
                    {linkedin && (
                      <div className="mt-2">
                        <LinkedInProfileLink url={linkedin} />
                      </div>
                    )}
                    <a
                      href={`/instructors/${person.id}`}
                      className="text-xs text-bhutan-yellow mt-2 inline-block"
                    >
                      View full profile →
                    </a>
                  </div>
                </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* Learning Objectives */}
        {course.learning_objectives && course.learning_objectives.length > 0 && (
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg">What You'll Learn</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {course.learning_objectives.map((objective, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{objective}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Course Modules - Timeline */}
        {modules.length > 0 && (
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg">Course Curriculum</CardTitle>
              <CardDescription>
                {modules.length} modules • {course.duration_minutes ? `${Math.floor(course.duration_minutes / 60)} hours` : 'Self-paced'} content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CurriculumTimeline
                modules={modules}
                showProgress={isEnrolled}
                overallProgress={0}
                onLessonClick={(lessonId) => {
                  if (isEnrolled) {
                    router.push(`/learn/${courseId}/lesson/${lessonId}`)
                  }
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Requirements */}
        {course.requirements && course.requirements.length > 0 && (
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg">Requirements</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {course.requirements.map((requirement, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-bhutan-yellow mt-1.5 flex-shrink-0" />
                    <span>{requirement}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
        </div>

        {course && (
          <aside className="hidden min-w-0 lg:block">
            <CourseActionDeck
              course={course}
              isEnrolled={isEnrolled}
              enrollmentPending={enrollmentPending}
              enrolling={enrolling}
              onEnroll={handleEnroll}
              onLearn={() => router.push(resumeLearnPath(courseId, lastLessonId))}
              inviteMode={(course as any).enrollment_mode === 'invite_code'}
              inviteCode={inviteCode}
              onInviteCodeChange={setInviteCode}
              variant="sidebar"
            />
          </aside>
        )}
      </div>

      {course && (
        <div className="lg:hidden">
          <CourseActionDeck
            course={course}
            isEnrolled={isEnrolled}
            enrollmentPending={enrollmentPending}
            enrolling={enrolling}
            onEnroll={handleEnroll}
            onLearn={() => router.push(resumeLearnPath(courseId, lastLessonId))}
            inviteMode={(course as any).enrollment_mode === 'invite_code'}
            inviteCode={inviteCode}
            onInviteCodeChange={setInviteCode}
            variant="mobile"
          />
        </div>
      )}
    </div>
  )
}