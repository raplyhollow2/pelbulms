'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, BookOpen, Users, Loader2, Award, HardDrive, Check, X, ClipboardCheck, Trash2, MoreVertical, ListFilter } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'
import { resolveMediaUrl } from '@/lib/media'
import { canAccessAdmin, canAccessTeaching } from '@/lib/roles'
import { useCapabilities } from '@/components/auth/capabilities-provider'
import { CAP } from '@/lib/capability-keys'
import { GradingAlertBanner } from '@/components/teach/grading-alert-banner'

type Course = Database['public']['Tables']['courses']['Row'] & {
  instructor_name?: string
}
type Profile = Database['public']['Tables']['profiles']['Row']

type SortKey = 'newest' | 'oldest' | 'title' | 'students'

type EnrollmentRequest = {
  enrollmentId: string
  courseId: string
  courseTitle: string
  studentName: string
  studentEmail: string | null
  requestedAt: string | null
}

export default function TeacherDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [totalEnrollments, setTotalEnrollments] = useState(0)
  const [avgProgress, setAvgProgress] = useState<number | null>(null)
  const [activeQuizzes, setActiveQuizzes] = useState<number | null>(null)
  const [pendingRequests, setPendingRequests] = useState<EnrollmentRequest[]>([])
  const [gradeCounts, setGradeCounts] = useState<Record<string, number>>({})
  const [gradeBacklog, setGradeBacklog] = useState<
    { courseId: string; title: string; pendingCount: number }[]
  >([])
  const [insights, setInsights] = useState<{
    pending: string | number
    completions: string | number
    engagement: string | number
  } | null>(null)
  const [decidingId, setDecidingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteTargets, setDeleteTargets] = useState<Course[]>([])
  const [deleting, setDeleting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [bulkWorking, setBulkWorking] = useState<'publish' | 'unpublish' | null>(null)
  const [unpublishOpen, setUnpublishOpen] = useState(false)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [levelFilter, setLevelFilter] = useState('all')
  const [instructorFilter, setInstructorFilter] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('newest')

  const supabase = createClient()
  const { loaded: capsLoaded, has } = useCapabilities()
  const canCreateCourse = has(CAP.TEACH_CREATE_VIEW)
  const canOpenMedia = has(CAP.TEACH_MEDIA_VIEW)
  const isAdminView = canAccessAdmin((profile as any)?.role)

  useEffect(() => {
    if (!capsLoaded) return
    if (!has(CAP.TEACH_DASHBOARD_VIEW)) router.push('/dashboard')
  }, [capsLoaded, has, router])

  useEffect(() => {
    fetchTeacherData()
    const refreshGrades = () => {
      if (document.visibilityState === 'hidden') return
      void fetch('/api/teach/grading-summary')
        .then(async (gradeRes) => {
          const gradeData = await gradeRes.json().catch(() => ({}))
          if (!gradeRes.ok) return
          setGradeCounts(gradeData.counts || {})
          setGradeBacklog(Array.isArray(gradeData.backlog) ? gradeData.backlog : [])
        })
        .catch(() => {})
    }
    window.addEventListener('focus', refreshGrades)
    document.addEventListener('visibilitychange', refreshGrades)
    return () => {
      window.removeEventListener('focus', refreshGrades)
      document.removeEventListener('visibilitychange', refreshGrades)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchTeacherData = async () => {
    try {
      setLoading(true)

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      if (!authUser) {
        router.push('/auth/login')
        return
      }

      setUser(authUser)

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (!profileData || !canAccessTeaching((profileData as any).role)) {
        alert('Access denied. Teacher dashboard is for instructors and admins.')
        router.push('/dashboard')
        return
      }

      setProfile(profileData)
      const role = (profileData as any).role as string
      const admin = canAccessAdmin(role)

      let query = supabase.from('courses').select('*')
      if (!admin) {
        query = query.eq('instructor_id', authUser.id)
      }
      const { data: coursesData } = await query.order('created_at', { ascending: false })

      let enriched: Course[] = (coursesData || []) as Course[]

      if (admin && enriched.length > 0) {
        const ids = [...new Set(enriched.map((c) => (c as any).instructor_id).filter(Boolean))]
        if (ids.length > 0) {
          const { data: instructors } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', ids)
          const map: Record<string, string> = {}
          for (const p of (instructors || []) as any[]) {
            map[p.id] = p.full_name || 'Instructor'
          }
          enriched = enriched.map((c) => ({
            ...c,
            instructor_name: map[(c as any).instructor_id] || 'Instructor',
          }))
        }
      }

      setCourses(enriched)

      const courseIds = enriched.map((m) => m.id)
      if (courseIds.length > 0) {
        const { data: enrollRows, count } = await supabase
          .from('enrollments')
          .select('progress_percentage', { count: 'exact' })
          .in('course_id', courseIds)
          .in('status', ['active', 'completed'])

        setTotalEnrollments(count || 0)

        if (enrollRows && enrollRows.length > 0) {
          const sum = (enrollRows as any[]).reduce(
            (acc, e) => acc + (e.progress_percentage || 0),
            0
          )
          setAvgProgress(Math.round(sum / enrollRows.length))
        } else {
          setAvgProgress(0)
        }

        const { data: mods } = await supabase.from('modules').select('id').in('course_id', courseIds)
        const modIds = (mods || []).map((m: any) => m.id)
        if (modIds.length > 0) {
          const { data: lessonRows } = await supabase
            .from('lessons')
            .select('id')
            .in('module_id', modIds)
          const lessonIds = (lessonRows || []).map((l: any) => l.id)
          if (lessonIds.length > 0) {
            const { count: quizCount } = await supabase
              .from('quizzes')
              .select('*', { count: 'exact', head: true })
              .in('lesson_id', lessonIds)
              .eq('is_published', true)
            setActiveQuizzes(quizCount || 0)
          } else {
            setActiveQuizzes(0)
          }
        } else {
          setActiveQuizzes(0)
        }
      } else {
        setAvgProgress(0)
        setActiveQuizzes(0)
      }

      const reqRes = await fetch('/api/teach/enrollment-requests')
      const reqData = await reqRes.json().catch(() => ({}))
      if (reqRes.ok && Array.isArray(reqData.requests)) {
        setPendingRequests(reqData.requests)
      } else {
        setPendingRequests([])
      }

      const gradeRes = await fetch('/api/teach/grading-summary')
      const gradeData = await gradeRes.json().catch(() => ({}))
      if (gradeRes.ok) {
        setGradeCounts(gradeData.counts || {})
        setGradeBacklog(Array.isArray(gradeData.backlog) ? gradeData.backlog : [])
      }

      const snapRes = await fetch('/api/reports/snapshot?range=30d&audience=instructor')
      const snapJson = await snapRes.json().catch(() => ({}))
      if (snapRes.ok && snapJson.snapshot?.kpis) {
        const kpis = snapJson.snapshot.kpis as { key: string; value: string | number }[]
        const valueOf = (key: string) => kpis.find((k) => k.key === key)?.value ?? '—'
        setInsights({
          pending: valueOf('pendingGrades'),
          completions: valueOf('completions'),
          engagement: valueOf('engagement'),
        })
      }
    } catch (error) {
      console.error('Error fetching teacher data:', error)
    } finally {
      setLoading(false)
    }
  }

  const pendingByCourse = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of pendingRequests) {
      map[r.courseId] = (map[r.courseId] || 0) + 1
    }
    return map
  }, [pendingRequests])

  const handleEnrollmentDecision = async (
    enrollmentId: string,
    action: 'approve' | 'reject'
  ) => {
    try {
      setDecidingId(enrollmentId)
      const res = await fetch('/api/teach/enrollments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentId, action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to update enrollment')
      setPendingRequests((prev) => prev.filter((r) => r.enrollmentId !== enrollmentId))
    } catch (e: any) {
      alert(e?.message || 'Failed to update enrollment')
    } finally {
      setDecidingId(null)
    }
  }

  const confirmDeleteCourses = async () => {
    if (deleteTargets.length === 0) return
    try {
      setDeleting(true)
      const results = await Promise.all(
        deleteTargets.map(async (course) => {
          const res = await fetch(`/api/teach/courses/${course.id}`, { method: 'DELETE' })
          const data = await res.json().catch(() => ({}))
          return {
            id: course.id,
            ok: res.ok,
            error: (data as { error?: string }).error,
          }
        })
      )
      const removed = new Set(results.filter((result) => result.ok).map((result) => result.id))
      if (removed.size > 0) {
        setCourses((prev) => prev.filter((course) => !removed.has(course.id)))
        setSelectedIds((prev) => {
          const next = new Set(prev)
          for (const id of removed) next.delete(id)
          return next
        })
      }
      const failed = results.filter((result) => !result.ok)
      if (failed.length === 0) {
        setDeleteTargets([])
      } else {
        alert(
          failed[0]?.error ||
            `Could not delete ${failed.length} course${failed.length === 1 ? '' : 's'}.`
        )
        setDeleteTargets((prev) => prev.filter((course) => !removed.has(course.id)))
      }
    } catch (e: any) {
      alert(e?.message || 'Failed to delete course')
    } finally {
      setDeleting(false)
    }
  }

  const toggleCourseSelected = (courseId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(courseId)
      else next.delete(courseId)
      return next
    })
  }

  const clearFilters = () => {
    setStatusFilter('all')
    setCategoryFilter('all')
    setLevelFilter('all')
    setInstructorFilter('all')
  }

  const categories = useMemo(
    () =>
      [...new Set(courses.map((c) => c.category).filter(Boolean))].sort() as string[],
    [courses]
  )
  const levels = useMemo(
    () => [...new Set(courses.map((c) => c.level).filter(Boolean))].sort() as string[],
    [courses]
  )
  const instructors = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of courses) {
      const id = (c as any).instructor_id
      if (id) map.set(id, c.instructor_name || 'Instructor')
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }))
  }, [courses])

  const filteredCourses = useMemo(() => {
    let list = [...courses]

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (c) =>
          c.title?.toLowerCase().includes(q) ||
          c.category?.toLowerCase().includes(q) ||
          c.instructor_name?.toLowerCase().includes(q)
      )
    }
    if (statusFilter === 'published') {
      list = list.filter((c) => (c as any).is_published)
    } else if (statusFilter === 'draft') {
      list = list.filter((c) => !(c as any).is_published)
    }
    if (categoryFilter !== 'all') {
      list = list.filter((c) => c.category === categoryFilter)
    }
    if (levelFilter !== 'all') {
      list = list.filter((c) => c.level === levelFilter)
    }
    if (instructorFilter !== 'all') {
      list = list.filter((c) => (c as any).instructor_id === instructorFilter)
    }

    list.sort((a, b) => {
      if (sortKey === 'newest') {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      }
      if (sortKey === 'oldest') {
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      }
      if (sortKey === 'title') {
        return (a.title || '').localeCompare(b.title || '')
      }
      if (sortKey === 'students') {
        return ((b as any).enrollment_count || 0) - ((a as any).enrollment_count || 0)
      }
      return 0
    })

    return list
  }, [
    courses,
    search,
    statusFilter,
    categoryFilter,
    levelFilter,
    instructorFilter,
    sortKey,
  ])

  const canDeleteCourse = (course: Course) =>
    (profile as { role?: string } | null)?.role === 'superadmin' || course.instructor_id === user?.id
  const selectedVisible = filteredCourses.filter((course) => selectedIds.has(course.id))
  const deletableSelected = selectedVisible.filter(canDeleteCourse)
  const allVisibleSelected =
    filteredCourses.length > 0 && selectedVisible.length === filteredCourses.length
  const someVisibleSelected = selectedVisible.length > 0 && !allVisibleSelected
  const courseCountLabel =
    filteredCourses.length === courses.length
      ? `${courses.length} ${courses.length === 1 ? 'course' : 'courses'}`
      : `${filteredCourses.length} of ${courses.length} courses`

  const filterChips = [
    statusFilter !== 'all'
      ? {
          id: 'status',
          label: `Status: ${statusFilter === 'published' ? 'Published' : 'Draft'}`,
          clear: () => setStatusFilter('all'),
        }
      : null,
    categoryFilter !== 'all'
      ? {
          id: 'category',
          label: `Category: ${categoryFilter}`,
          clear: () => setCategoryFilter('all'),
        }
      : null,
    levelFilter !== 'all'
      ? {
          id: 'level',
          label: `Level: ${levelFilter}`,
          clear: () => setLevelFilter('all'),
        }
      : null,
    isAdminView && instructorFilter !== 'all'
      ? {
          id: 'instructor',
          label: `Instructor: ${instructors.find((instructor) => instructor.id === instructorFilter)?.name || 'Instructor'}`,
          clear: () => setInstructorFilter('all'),
        }
      : null,
  ].filter((chip): chip is { id: string; label: string; clear: () => void } => chip !== null)

  const setSelectedPublished = async (next: boolean) => {
    const ids = selectedVisible.map((course) => course.id)
    if (ids.length === 0) return
    try {
      setBulkWorking(next ? 'publish' : 'unpublish')
      const { error } = await supabase
        .from('courses')
        .update({ is_published: next, updated_at: new Date().toISOString() })
        .in('id', ids)
      if (error) throw new Error(error.message)
      const idSet = new Set(ids)
      setCourses((prev) =>
        prev.map((course) => (idSet.has(course.id) ? { ...course, is_published: next } : course))
      )
    } catch (e: any) {
      alert(e?.message || 'Failed to update courses')
    } finally {
      setBulkWorking(null)
    }
  }

  const toggleAllVisible = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const course of filteredCourses) {
        if (checked) next.add(course.id)
        else next.delete(course.id)
      }
      return next
    })
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-bhutan-yellow" />
          <span className="ml-3 text-muted-foreground">Loading dashboard...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 lg:py-8 space-y-6 lg:space-y-8 max-w-7xl md:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-1 sm:mb-2">
            {isAdminView ? 'Course Design Dashboard' : 'Teacher Dashboard'}
          </h1>
          <p className="text-sm sm:text-base lg:text-xl text-muted-foreground truncate">
            Welcome back, {profile?.full_name || user?.user_metadata?.full_name || 'Instructor'}!
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {canOpenMedia && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-initial"
            onClick={() => router.push('/teach/media')}
          >
            <HardDrive className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2" />
            <span className="ml-1 sm:ml-0">Media</span>
          </Button>
          )}
          {canCreateCourse && (
          <Button
            onClick={() => router.push('/teach/create')}
            className="flex-1 sm:flex-initial bg-bhutan-yellow hover:bg-bhutan-orange"
            size="sm"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2" />
            <span className="ml-1 sm:ml-0">Create Course</span>
          </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-6">
        <Card className="glass">
          <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-xs lg:text-sm font-medium">
              {isAdminView ? 'All Courses' : 'My Courses'}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="text-2xl lg:text-3xl font-bold text-bhutan-yellow">{courses.length}</div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-xs lg:text-sm font-medium">Total Students</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="text-2xl lg:text-3xl font-bold text-bhutan-orange">{totalEnrollments}</div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-xs lg:text-sm font-medium">Pending requests</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div
              data-testid="pending-enrollment-count"
              className="text-2xl lg:text-3xl font-bold text-amber-600"
            >
              {pendingRequests.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting approval</p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-xs lg:text-sm font-medium">Avg Progress</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="text-2xl lg:text-3xl font-bold text-bhutan-red">
              {avgProgress === null ? '--' : `${avgProgress}%`}
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-xs lg:text-sm font-medium">Active Quizzes</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="text-2xl lg:text-3xl font-bold text-green-600">
              {activeQuizzes === null ? '--' : activeQuizzes}
            </div>
          </CardContent>
        </Card>
      </div>

      <GradingAlertBanner />

      {insights && (
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Course insights</CardTitle>
              <CardDescription>Pending grades, completions, and 14-day engagement.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push('/teach/reports')}>
              View report
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Pending grades</p>
                <p className="text-2xl font-semibold text-amber-600">{insights.pending}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Completions</p>
                <p className="text-2xl font-semibold">{insights.completions}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Engagement (14d)</p>
                <p className="text-2xl font-semibold">{insights.engagement}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {gradeBacklog.length > 0 && (
        <Card className="glass-strong border-amber-500/30">
          <CardHeader>
            <CardTitle className="text-xl lg:text-2xl">Needs grading</CardTitle>
            <CardDescription>Courses with submitted work waiting for a grade.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {gradeBacklog.map((item) => (
              <div
                key={item.courseId}
                className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.pendingCount} waiting
                  </p>
                </div>
                <Button
                  size="sm"
                  className="shrink-0 bg-amber-500 text-black hover:bg-amber-400"
                  onClick={() => router.push(`/teach/courses/${item.courseId}/grading`)}
                >
                  Open queue
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {pendingRequests.length > 0 && (
        <Card className="glass-strong border-amber-500/30">
          <CardHeader>
            <CardTitle className="text-xl lg:text-2xl">Enrollment requests</CardTitle>
            <CardDescription>
              Students waiting for access. Approve to grant the course, or reject.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingRequests.map((request) => (
              <div
                key={request.enrollmentId}
                className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{request.studentName}</p>
                  {request.studentEmail && (
                    <p className="text-sm text-muted-foreground truncate">{request.studentEmail}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground truncate">{request.courseTitle}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    disabled={decidingId === request.enrollmentId}
                    onClick={() => handleEnrollmentDecision(request.enrollmentId, 'approve')}
                  >
                    {decidingId === request.enrollmentId ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-1" />
                        Approve
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={decidingId === request.enrollmentId}
                    onClick={() => handleEnrollmentDecision(request.enrollmentId, 'reject')}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="glass-strong">
        <CardHeader className="space-y-3 px-4 sm:px-6">
          <div className="flex items-baseline justify-between gap-3">
            <CardTitle className="text-base sm:text-lg lg:text-xl">
              {isAdminView ? 'All course designs' : 'My Courses'}
            </CardTitle>
            <p className="shrink-0 text-sm text-muted-foreground">{courseCountLabel}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              placeholder="Search courses…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 min-w-0 flex-1"
              aria-label="Search courses"
            />
            <div className="flex gap-2">
              <Select value={sortKey} onValueChange={(v: any) => v && setSortKey(v)}>
                <SelectTrigger size="sm" className="h-9 w-full min-w-0 flex-1 gap-1 sm:w-[160px]" aria-label="Sort">
                  <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-left">
                    <span className="shrink-0 text-muted-foreground">Sort</span>
                    <span className="truncate font-medium">
                      {sortKey === 'newest'
                        ? 'Newest'
                        : sortKey === 'oldest'
                          ? 'Oldest'
                          : sortKey === 'title'
                            ? 'Title'
                            : 'Students'}
                    </span>
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                  <SelectItem value="title">Title A–Z</SelectItem>
                  <SelectItem value="students">Most students</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={`h-9 shrink-0 ${filtersOpen || filterChips.length > 0 ? 'border-bhutan-yellow bg-bhutan-yellow/15' : ''}`}
                aria-expanded={filtersOpen}
                aria-controls="course-filters"
                data-testid="course-filter-toggle"
                onClick={() => setFiltersOpen((open) => !open)}
              >
                <ListFilter className="size-4" />
                Filter
                {filterChips.length > 0 ? (
                  <span className="rounded-full bg-bhutan-yellow px-1.5 text-xs font-semibold text-bhutan-black">
                    {filterChips.length}
                  </span>
                ) : null}
              </Button>
            </div>
          </div>
          {filtersOpen && (
            <div id="course-filters" className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <Select value={statusFilter} onValueChange={(v: any) => v && setStatusFilter(v)}>
                <SelectTrigger size="sm" className="h-9 w-full gap-1 sm:w-[140px]" aria-label="Status">
                  <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-left">
                    <span className="shrink-0 text-muted-foreground">Status</span>
                    <span className="truncate font-medium capitalize">
                      {statusFilter === 'all' ? 'All' : statusFilter}
                    </span>
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={(v) => v && setCategoryFilter(v)}>
                <SelectTrigger size="sm" className="h-9 w-full gap-1 sm:w-[160px]" aria-label="Category">
                  <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-left">
                    <span className="shrink-0 text-muted-foreground">Category</span>
                    <span className="truncate font-medium">
                      {categoryFilter === 'all' ? 'All' : categoryFilter}
                    </span>
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={levelFilter} onValueChange={(v) => v && setLevelFilter(v)}>
                <SelectTrigger size="sm" className="h-9 w-full gap-1 sm:w-[140px]" aria-label="Level">
                  <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-left">
                    <span className="shrink-0 text-muted-foreground">Level</span>
                    <span className="truncate font-medium capitalize">
                      {levelFilter === 'all' ? 'All' : levelFilter}
                    </span>
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  {levels.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isAdminView && (
                <Select value={instructorFilter} onValueChange={(v) => v && setInstructorFilter(v)}>
                  <SelectTrigger size="sm" className="h-9 w-full gap-1 sm:w-[170px]" aria-label="Instructor">
                    <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-left">
                      <span className="shrink-0 text-muted-foreground">Instructor</span>
                      <span className="truncate font-medium">
                        {instructorFilter === 'all'
                          ? 'All'
                          : instructors.find((i) => i.id === instructorFilter)?.name || 'All'}
                      </span>
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All instructors</SelectItem>
                    {instructors.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
          {filterChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {filterChips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={chip.clear}
                  className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-background px-2.5 text-xs font-medium hover:bg-muted"
                >
                  {chip.label}
                  <X className="size-3" />
                  <span className="sr-only">Remove {chip.label} filter</span>
                </button>
              ))}
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearFilters}>
                Clear all
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3 lg:space-y-4 px-4 sm:px-6">
          {filteredCourses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No courses match</h3>
              <p className="text-muted-foreground text-center mb-4 text-sm">
                Try clearing filters or create a new course.
              </p>
              {canCreateCourse && (
              <Button
                onClick={() => router.push('/teach/create')}
                className="bg-bhutan-yellow hover:bg-bhutan-orange"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Course
              </Button>
              )}
            </div>
          ) : (
            <>
              <div
                data-testid="course-bulk-bar"
                className="flex flex-col gap-2 border-b border-border/60 pb-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={allVisibleSelected}
                    indeterminate={someVisibleSelected}
                    onCheckedChange={(checked) => toggleAllVisible(checked)}
                    aria-label={
                      selectedVisible.length === 0
                        ? 'Select all courses'
                        : `${selectedVisible.length} selected. Select all courses`
                    }
                    disabled={bulkWorking !== null || deleting}
                    data-testid="course-select-all"
                  />
                  <span>
                    {selectedVisible.length === 0
                      ? 'Select all'
                      : `${selectedVisible.length} selected`}
                  </span>
                </div>
                {selectedVisible.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={bulkWorking !== null || deleting}
                      onClick={() => void setSelectedPublished(true)}
                    >
                      {bulkWorking === 'publish' ? <Loader2 className="size-4 animate-spin" /> : null}
                      Publish
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={bulkWorking !== null || deleting}
                      onClick={() => setUnpublishOpen(true)}
                    >
                      {bulkWorking === 'unpublish' ? <Loader2 className="size-4 animate-spin" /> : null}
                      Unpublish
                    </Button>
                    {deletableSelected.length > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={bulkWorking !== null || deleting}
                        onClick={() => setDeleteTargets(deletableSelected)}
                      >
                        <Trash2 className="size-4" />
                        Delete
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={bulkWorking !== null || deleting}
                      onClick={() => setSelectedIds(new Set())}
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>
              {filteredCourses.map((course) => {
                const studentCount = Number(course.enrollment_count) || 0
                const pending = pendingByCourse[course.id] || 0
                const ungraded = gradeCounts[course.id] || 0
                const meta = [
                  course.category,
                  course.is_published ? 'Published' : 'Draft',
                  isAdminView ? course.instructor_name : null,
                  `${studentCount} ${studentCount === 1 ? 'student' : 'students'}`,
                ]
                  .filter(Boolean)
                  .join(' · ')
                return (
                  <div
                    key={course.id}
                    data-testid="course-row"
                    className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/50 p-3 transition-colors hover:bg-background"
                  >
                    <Checkbox
                      checked={selectedIds.has(course.id)}
                      onCheckedChange={(checked) => toggleCourseSelected(course.id, checked)}
                      aria-label={`Select ${course.title}`}
                      disabled={bulkWorking !== null || deleting}
                    />
                    <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded bg-gradient-to-br from-bhutan-yellow/20 to-bhutan-orange/20">
                      {course.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={resolveMediaUrl(course.thumbnail_url) || course.thumbnail_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <BookOpen className="size-5 text-bhutan-yellow" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/teach/courses/${course.id}/studio`}
                        className="block truncate text-sm font-semibold hover:underline lg:text-base"
                      >
                        {course.title}
                      </Link>
                      <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:flex-nowrap">
                        <p className="min-w-0 truncate text-xs text-muted-foreground">{meta}</p>
                        {pending > 0 && (
                          <Badge className="shrink-0 bg-amber-500 text-black hover:bg-amber-500">
                            {pending} {pending === 1 ? 'request' : 'requests'}
                          </Badge>
                        )}
                        {ungraded > 0 && (
                          <Badge className="shrink-0 bg-amber-500 text-black hover:bg-amber-500">
                            {ungraded} to grade
                          </Badge>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="inline-flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-muted sm:size-8"
                        aria-label={`Actions for ${course.title}`}
                      >
                        <MoreVertical className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => router.push(`/teach/courses/${course.id}/students`)}>
                          <Users />
                          Students
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/teach/courses/${course.id}/grading`)}>
                          <ClipboardCheck />
                          Grade
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/teach/courses/${course.id}/certificate`)}>
                          <Award />
                          Certificate
                        </DropdownMenuItem>
                        {canDeleteCourse(course) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => setDeleteTargets([course])}>
                              <Trash2 />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )
              })}
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={unpublishOpen} onOpenChange={setUnpublishOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Unpublish {selectedVisible.length === 1 ? 'this course' : `${selectedVisible.length} courses`}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Enrolled learners will lose access until you publish again. Their enrollments are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkWorking === 'unpublish'}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-bhutan-yellow text-black hover:bg-bhutan-orange"
              disabled={bulkWorking === 'unpublish'}
              onClick={(event) => {
                event.preventDefault()
                void setSelectedPublished(false).then(() => setUnpublishOpen(false))
              }}
            >
              Unpublish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteTargets.length > 0}
        onOpenChange={(open) => !open && !deleting && setDeleteTargets([])}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTargets.length > 1 ? `Delete ${deleteTargets.length} courses?` : 'Delete this course?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTargets.length > 1
                ? `${deleteTargets.length} courses and their lessons, enrollments, and student progress will be permanently removed.`
                : `${deleteTargets[0]?.title ? `"${deleteTargets[0].title}"` : 'This course'} and its lessons, enrollments, and student progress will be permanently removed.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault()
                void confirmDeleteCourses()
              }}
            >
              {deleting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              {deleteTargets.length > 1 ? 'Delete courses' : 'Delete course'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
