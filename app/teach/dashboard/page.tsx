'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, BookOpen, Users, Loader2, Edit, BarChart3, Award, HardDrive, Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'
import { resolveMediaUrl } from '@/lib/media'
import { canAccessAdmin, canAccessTeaching } from '@/lib/roles'

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
  const [decidingId, setDecidingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [levelFilter, setLevelFilter] = useState('all')
  const [instructorFilter, setInstructorFilter] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('newest')

  const supabase = createClient()
  const isAdminView = canAccessAdmin((profile as any)?.role)

  useEffect(() => {
    fetchTeacherData()
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
    <div className="container mx-auto px-4 py-6 lg:py-8 space-y-6 lg:space-y-8">
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
          <Button
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-initial"
            onClick={() => router.push('/teach/media')}
          >
            <HardDrive className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2" />
            <span className="ml-1 sm:ml-0">Media</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-initial"
            onClick={() => router.push('/teach/analytics')}
          >
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2" />
            <span className="ml-1 sm:ml-0">Analytics</span>
          </Button>
          <Button
            onClick={() => router.push('/teach/create')}
            className="flex-1 sm:flex-initial bg-bhutan-yellow hover:bg-bhutan-orange"
            size="sm"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2" />
            <span className="ml-1 sm:ml-0">Create Course</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-6">
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
        <CardHeader className="px-4 sm:px-6 space-y-4">
          <div>
            <CardTitle className="text-xl lg:text-2xl">
              {isAdminView ? 'All course designs' : 'My Courses'}
            </CardTitle>
            <CardDescription>
              Newest courses first by default. Use filters to change the view.
            </CardDescription>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
            <Input
              placeholder="Search courses…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="xl:col-span-2"
            />
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
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
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Level" />
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
            <Select value={sortKey} onValueChange={(v: any) => setSortKey(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="title">Title A–Z</SelectItem>
                <SelectItem value="students">Most students</SelectItem>
              </SelectContent>
            </Select>
            {isAdminView && (
              <Select value={instructorFilter} onValueChange={setInstructorFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Instructor" />
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
        </CardHeader>
        <CardContent className="space-y-3 lg:space-y-4 px-4 sm:px-6">
          {filteredCourses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No courses match</h3>
              <p className="text-muted-foreground text-center mb-4 text-sm">
                Try clearing filters or create a new course.
              </p>
              <Button
                onClick={() => router.push('/teach/create')}
                className="bg-bhutan-yellow hover:bg-bhutan-orange"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Course
              </Button>
            </div>
          ) : (
            filteredCourses.map((course) => (
              <div
                key={course.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 lg:p-4 rounded-lg bg-background/50 hover:bg-background transition-colors border border-border/50 gap-3"
              >
                <div className="flex items-center gap-3 lg:gap-4 w-full sm:w-auto min-w-0">
                  <div className="w-12 h-12 lg:w-16 lg:h-12 rounded bg-gradient-to-br from-bhutan-yellow/20 to-bhutan-orange/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {course.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveMediaUrl(course.thumbnail_url) || course.thumbnail_url}
                        alt={course.title}
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <BookOpen className="w-5 h-5 lg:w-6 lg:h-6 text-bhutan-yellow" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm lg:text-base truncate">{course.title}</h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {course.category}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {(course as any).is_published ? 'Published' : 'Draft'}
                      </Badge>
                      {isAdminView && course.instructor_name && (
                        <Badge variant="outline" className="text-xs">
                          {course.instructor_name}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/teach/courses/${course.id}/students`)}
                    className="flex-1 sm:flex-initial"
                  >
                    <Users className="w-4 h-4 mr-1" />
                    Students
                    {pendingByCourse[course.id] > 0 && (
                      <Badge className="ml-1.5 bg-amber-500 text-black hover:bg-amber-500">
                        {pendingByCourse[course.id]}
                      </Badge>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/teach/courses/${course.id}/certificate`)}
                    className="flex-1 sm:flex-initial"
                  >
                    <Award className="w-4 h-4 mr-1" />
                    Certificate
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => router.push(`/teach/courses/${course.id}/edit`)}
                    className="flex-1 sm:flex-initial"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
