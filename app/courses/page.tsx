'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Search, BookOpen, Command } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { CourseCard } from '@/components/courses/course-card'
import { CourseGridSkeleton } from '@/components/courses/course-card-skeleton'
import { Skeleton } from '@/components/ui/skeleton'
import { InstructorShowcase } from '@/components/courses/instructor-showcase'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'
import { buildInstructorShowcaseData } from '@/lib/instructor-stats'
import { postEnrollmentRequest } from '@/lib/request-enrollment'
import { toast } from 'sonner'
import {
  filterVisibleCourses,
  institutionLabel,
  loadInstitutionsForCourses,
  matchesInstitutionFilter,
  type InstitutionSummary,
} from '@/lib/course-institution-access'
import { AppHeaderPortal } from '@/components/layout/app-header-slot'

type Course = Database['public']['Tables']['courses']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']
type Module = Database['public']['Tables']['modules']['Row']
type Enrollment = Database['public']['Tables']['enrollments']['Row']

type CourseWithInstructor = Course & {
  profiles?: Profile | null
  modules?: Module[] | { id: string }[]
  students_count?: number
  modules_count?: number
  enrollment_count?: number
  audience_institutions?: InstitutionSummary[]
}

export default function CoursesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [courses, setCourses] = useState<CourseWithInstructor[]>([])
  const [filteredCourses, setFilteredCourses] = useState<CourseWithInstructor[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set())
  const [pendingCourseIds, setPendingCourseIds] = useState<Set<string>>(new Set())
  const [requestingCourseId, setRequestingCourseId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedLevel, setSelectedLevel] = useState('All')
  /** 'All' | 'mine' | institution uuid */
  const [selectedInstitution, setSelectedInstitution] = useState<string>('All')
  const [institutions, setInstitutions] = useState<InstitutionSummary[]>([])
  const [instructors, setInstructors] = useState<any[]>([])

  const supabase = createClient()

  const syncInstitutionQuery = useCallback(
    (value: string, instList: InstitutionSummary[] = institutions) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value === 'All') {
        params.delete('institution')
      } else if (value === 'mine') {
        params.set('institution', 'mine')
      } else {
        const inst = instList.find((i) => i.id === value)
        if (inst) params.set('institution', inst.slug)
        else params.delete('institution')
      }
      const qs = params.toString()
      router.replace(qs ? `/courses?${qs}` : '/courses', { scroll: false })
    },
    [institutions, router, searchParams]
  )

  // Fetch current user and courses
  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      let profile: Profile | null = null
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        profile = data
        setCurrentUser(profile)
      }

      let activeInstitutions: InstitutionSummary[] = []
      try {
        const instRes = await fetch('/api/institutions')
        if (instRes.ok) {
          const instJson = await instRes.json()
          activeInstitutions = instJson.institutions || []
          setInstitutions(activeInstitutions)
        }
      } catch {
        /* ignore */
      }

      // Fetch published courses with instructor + module rows for catalog stats
      let coursesData: CourseWithInstructor[] | null = null
      {
        const withModules = await supabase
          .from('courses')
          .select(`
            *,
            profiles:instructor_id (
              full_name,
              avatar_url,
              bio
            ),
            modules ( id )
          `)
          .eq('is_published', true)
          .order('created_at', { ascending: false })

        if (!withModules.error) {
          coursesData = (withModules.data || []) as unknown as CourseWithInstructor[]
        } else {
          const fallback = await supabase
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
            .order('created_at', { ascending: false })
          if (fallback.error) throw fallback.error
          coursesData = (fallback.data || []) as unknown as CourseWithInstructor[]
        }
      }

      const withStats = (coursesData || []).map((course) => ({
        ...course,
        modules_count: Array.isArray(course.modules) ? course.modules.length : 0,
        students_count:
          typeof course.enrollment_count === 'number'
            ? course.enrollment_count
            : typeof course.students_count === 'number'
              ? course.students_count
              : 0,
      }))

      // Live module + student counts (enrollment_count is often missing/stale;
      // learners cannot count other enrollments under RLS).
      const courseIds = withStats.map((c) => c.id)
      if (courseIds.length) {
        try {
          const statsRes = await fetch('/api/courses/catalog-stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseIds }),
          })
          if (statsRes.ok) {
            const { stats } = (await statsRes.json()) as {
              stats?: Record<string, { modules?: number; students?: number }>
            }
            if (stats) {
              for (const course of withStats) {
                const s = stats[course.id]
                if (!s) continue
                if (typeof s.students === 'number') course.students_count = s.students
                if (typeof s.modules === 'number') course.modules_count = s.modules
              }
            }
          }
        } catch (statsErr) {
          console.warn('Catalog stats enrichment failed:', statsErr)
        }
      }

      const audienceMap = await loadInstitutionsForCourses(supabase as any, courseIds)
      const institutionIdsByCourse = new Map<string, string[]>()
      for (const id of courseIds) {
        institutionIdsByCourse.set(
          id,
          (audienceMap.get(id) || []).map((i) => i.id)
        )
      }

      const visible = filterVisibleCourses(withStats, institutionIdsByCourse, {
        userInstitutionId: (profile as any)?.institution_id,
        role: (profile as any)?.role,
      }).map((course) => ({
        ...course,
        audience_institutions: audienceMap.get(course.id) || [],
      }))

      setCourses(visible)
      setFilteredCourses(visible)

      const q = searchParams.get('institution')
      let initialFilter = 'All'
      if (q === 'mine') {
        initialFilter = 'mine'
      } else if (q) {
        const bySlug = activeInstitutions.find((i) => i.slug === q)
        if (bySlug) initialFilter = bySlug.id
      } else if ((profile as any)?.institution_id) {
        initialFilter = 'mine'
      }
      setSelectedInstitution(initialFilter)

      // Fetch user's enrollments
      if (user) {
        const { data: enrollmentsData } = await supabase
          .from('enrollments')
          .select('course_id, status')
          .eq('user_id', user.id)

        if (enrollmentsData) {
          const enrolledIds = new Set<string>()
          const pendingIds = new Set<string>()
          for (const e of enrollmentsData as any[]) {
            if (e.status === 'pending') pendingIds.add(e.course_id)
            else if (e.status === 'rejected') continue
            else enrolledIds.add(e.course_id)
          }
          setEnrolledCourseIds(enrolledIds)
          setPendingCourseIds(pendingIds)
        }

        // Fetch instructors with live stats (categories, ratings, certificates)
        const { data: instructorsData } = await supabase
          .from('profiles')
          .select('*')
          .in('role', ['instructor', 'admin', 'superadmin', 'resource_person'])
          .limit(20)

        if (instructorsData) {
          const instructorsWithStats = await Promise.all(
            instructorsData.map(async (instructor: any) => {
              const { data: instructorCourses } = await supabase
                .from('courses')
                .select(
                  'id, title, category, tags, average_rating, rating_count, enrollment_count, is_published'
                )
                .eq('instructor_id', instructor.id)
                .eq('is_published', true)

              const courseList = (instructorCourses || []) as any[]
              const courseIds = courseList.map((c) => c.id)

              let studentsCount = 0
              let certificatesIssuedToStudents = 0
              if (courseIds.length > 0) {
                const { count: enrollCount } = await supabase
                  .from('enrollments')
                  .select('*', { count: 'exact', head: true })
                  .in('course_id', courseIds)
                studentsCount = enrollCount || 0

                const { count: certCount } = await supabase
                  .from('certificates')
                  .select('*', { count: 'exact', head: true })
                  .in('course_id', courseIds)
                certificatesIssuedToStudents = certCount || 0
              }

              const { data: earnedCerts } = await supabase
                .from('certificates')
                .select('issued_at, courses(title)')
                .eq('user_id', instructor.id)
                .order('issued_at', { ascending: false })
                .limit(10)

              const earnedCertificates = ((earnedCerts || []) as any[]).map((c) => ({
                courseTitle: c.courses?.title || null,
                issuedAt: c.issued_at || null,
              }))

              return buildInstructorShowcaseData({
                id: instructor.id,
                full_name: instructor.full_name,
                avatar_url: instructor.avatar_url,
                bio: instructor.bio,
                social_links: instructor.social_links,
                metadata: instructor.metadata || {},
                courses: courseList,
                studentsCount,
                earnedCertificates,
                certificatesIssuedToStudents,
              })
            })
          )

          // Prefer instructors who actually teach
          setInstructors(
            instructorsWithStats
              .filter((i) => i.courses_count > 0)
              .sort((a, b) => b.students_count - a.students_count || b.courses_count - a.courses_count)
          )
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter courses based on search and filters
  useEffect(() => {
    let filtered = courses

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(course =>
        course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (course.description && course.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (course.tags && course.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
      )
    }

    // Filter by category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter((course: any) => course.category === selectedCategory)
    }

    // Filter by level
    if (selectedLevel !== 'All') {
      filtered = filtered.filter((course: any) => course.level === selectedLevel)
    }

    filtered = filtered.filter((course) =>
      matchesInstitutionFilter(
        (course.audience_institutions || []).map((i) => i.id),
        selectedInstitution,
        (currentUser as any)?.institution_id
      )
    )

    setFilteredCourses(filtered)
  }, [searchTerm, selectedCategory, selectedLevel, selectedInstitution, courses, currentUser])

  const setInstitutionFilter = (value: string) => {
    setSelectedInstitution(value)
    syncInstitutionQuery(value)
  }

  const handleEnroll = async (courseId: string) => {
    if (!currentUser) {
      window.location.href = '/auth/login'
      return
    }

    if (enrolledCourseIds.has(courseId) || requestingCourseId) return
    if (pendingCourseIds.has(courseId)) return

    try {
      setRequestingCourseId(courseId)
      const { ok, data } = await postEnrollmentRequest(courseId)

      if (data.needsKyc) {
        window.location.href = '/auth/register'
        return
      }

      if (!ok) {
        throw new Error(data.error || 'Failed to enroll')
      }

      if (data.status === 'pending' || data.pending) {
        setPendingCourseIds((prev) => new Set(prev).add(courseId))
        return
      }

      setEnrolledCourseIds((prev) => new Set(prev).add(courseId))

      if (data.alreadyEnrolled) {
        window.location.href = `/learn/${courseId}`
        return
      }

      window.location.href = `/learn/${courseId}`
    } catch (error: any) {
      console.error('Enrollment error:', error)
      toast.error(error?.message ? `Failed to enroll: ${error.message}` : 'Failed to enroll. Please try again.')
    } finally {
      setRequestingCourseId(null)
    }
  }

  const categories = [
    'All',
    ...Array.from(new Set(courses.map((c: any) => c.category).filter(Boolean))),
  ]
  const levels = [
    'All',
    ...Array.from(new Set(courses.map((c: any) => c.level).filter(Boolean))),
  ]
  const showInstitutionFilter =
    institutions.length > 0 || !!(currentUser as any)?.institution_id

  const categoryDisplay =
    selectedCategory === 'All' ? 'All' : selectedCategory
  const levelDisplay = selectedLevel === 'All' ? 'All' : selectedLevel
  const institutionDisplay =
    selectedInstitution === 'All'
      ? 'All'
      : selectedInstitution === 'mine'
        ? 'Mine'
        : institutionLabel(institutions.find((i) => i.id === selectedInstitution)) ||
          'Institution'

  const toolbar = (
    <div className="flex w-full min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
      <div className="min-w-0 shrink-0 lg:max-w-[200px] xl:max-w-[240px]">
        <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
          Course catalog
        </h1>
        <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground sm:text-xs">
          Discover courses across Bhutan. Request enrollment — the course creator approves access.
        </p>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center lg:gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search courses…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 pl-9 glass-strong"
              aria-label="Search courses"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 gap-1.5 rounded-full px-2.5 sm:px-3"
            onClick={() => window.dispatchEvent(new Event('pelbu:open-search'))}
            aria-label="Quick search"
          >
            <Command className="h-3.5 w-3.5" />
            <kbd className="hidden rounded bg-muted px-1.5 py-0.5 text-[10px] sm:inline">⌘K</kbd>
          </Button>
        </div>

        <div
          className={`grid shrink-0 gap-2 sm:flex sm:flex-wrap sm:items-center ${
            showInstitutionFilter ? 'grid-cols-3' : 'grid-cols-2'
          }`}
        >
          <Select
            value={selectedCategory}
            onValueChange={(v) => v && setSelectedCategory(v)}
          >
            <SelectTrigger
              size="sm"
              className="h-9 w-full min-w-0 gap-1 sm:w-[148px] lg:w-[158px]"
              aria-label="Category filter"
            >
              <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-left">
                <span className="shrink-0 text-muted-foreground">Category</span>
                <span className="truncate font-medium">{categoryDisplay}</span>
              </span>
            </SelectTrigger>
            <SelectContent align="start">
              {categories.map((category: string) => (
                <SelectItem key={category} value={category}>
                  {category === 'All' ? 'All categories' : category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedLevel}
            onValueChange={(v) => v && setSelectedLevel(v)}
          >
            <SelectTrigger
              size="sm"
              className="h-9 w-full min-w-0 gap-1 sm:w-[128px] lg:w-[136px]"
              aria-label="Level filter"
            >
              <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-left">
                <span className="shrink-0 text-muted-foreground">Level</span>
                <span className="truncate font-medium capitalize">{levelDisplay}</span>
              </span>
            </SelectTrigger>
            <SelectContent align="start">
              {levels.map((level: string) => (
                <SelectItem key={level} value={level}>
                  {level === 'All' ? 'All levels' : level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {showInstitutionFilter && (
            <Select
              value={selectedInstitution}
              onValueChange={(v) => v && setInstitutionFilter(v)}
            >
              <SelectTrigger
                size="sm"
                className="h-9 w-full min-w-0 gap-1 sm:w-[158px] lg:w-[168px]"
                aria-label="Institution filter"
              >
                <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-left">
                  <span className="shrink-0 text-muted-foreground">Institution</span>
                  <span className="truncate font-medium">{institutionDisplay}</span>
                </span>
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="All">All institutions</SelectItem>
                {(currentUser as any)?.institution_id && (
                  <SelectItem value="mine">My institution</SelectItem>
                )}
                {institutions.map((inst) => (
                  <SelectItem key={inst.id} value={inst.id}>
                    {institutionLabel(inst)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-3 sm:px-5 sm:py-4 md:px-6 md:pt-3 lg:px-8">
        <div className="space-y-4 md:hidden">
          <div className="flex flex-col gap-3">
            <div className="shrink-0 space-y-1.5">
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-4 w-52" />
            </div>
            <Skeleton className="h-9 w-full" />
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        </div>
        <div className="mt-3 space-y-4 md:mt-0">
          <Skeleton className="h-4 w-36" />
          <CourseGridSkeleton count={6} />
        </div>
      </div>
    )
  }

  return (
    <>
      <AppHeaderPortal>{toolbar}</AppHeaderPortal>

      <div className="container mx-auto max-w-7xl px-4 pb-6 pt-3 sm:px-5 md:px-6 md:pt-3 lg:px-8">
        {/* Phones: toolbar lives in-page (header portal is desktop-only) */}
        <div className="mb-3 md:hidden">{toolbar}</div>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Showing {filteredCourses.length} of {courses.length} courses
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {filteredCourses.map((course) => {
              const isEnrolled = enrolledCourseIds.has(course.id)
              const enrollmentPending = pendingCourseIds.has(course.id)
              const progress = (course as any).progress || 0

              return (
                <CourseCard
                  key={course.id}
                  course={course}
                  isEnrolled={isEnrolled}
                  enrollmentPending={enrollmentPending}
                  requesting={requestingCourseId === course.id}
                  onRequestEnrollment={handleEnroll}
                  progress={progress}
                />
              )
            })}
          </div>

          {filteredCourses.length === 0 && (
            <div className="text-center py-12">
              <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">
                {selectedInstitution !== 'All' &&
                !searchTerm &&
                selectedCategory === 'All' &&
                selectedLevel === 'All'
                  ? 'No courses for this institution yet'
                  : 'No courses found'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {selectedInstitution !== 'All' &&
                !searchTerm &&
                selectedCategory === 'All' &&
                selectedLevel === 'All'
                  ? 'Try All institutions, or check back when more courses are published for your organization.'
                  : "Try adjusting your search or filters to find what you're looking for."}
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('')
                  setSelectedCategory('All')
                  setSelectedLevel('All')
                  setInstitutionFilter('All')
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}

          {!loading && instructors.length > 0 && (
            <div className="mt-12 pt-8 border-t border-border/50">
              <InstructorShowcase
                instructors={instructors}
                layout="grid"
                maxShow={6}
              />
            </div>
          )}
        </div>
      </div>
    </>
  )
}