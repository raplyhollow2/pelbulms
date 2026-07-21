'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  BookOpen,
  Clock,
  Trophy,
  TrendingUp,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowRight,
  PlayCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'
import { DashboardCourseCard } from '@/components/dashboard/course-card'
import { resolveMediaUrl } from '@/lib/media'
import { cn } from '@/lib/utils'

type Profile = Database['public']['Tables']['profiles']['Row']

const PAGE_SIZE = 8

type EnrollmentRow = {
  id: string
  progress_percentage?: number | null
  courses: {
    id: string
    title: string
    description?: string | null
    thumbnail_url?: string | null
    category?: string | null
    level?: string | null
  } | null
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    activeCourses: 0,
    completedLessons: 0,
    achievements: 0,
    studyHours: 0,
  })
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'not_started' | 'completed'>(
    'all'
  )
  const [page, setPage] = useState(1)

  const supabase = createClient()

  useEffect(() => {
    fetchDashboardData()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [query, statusFilter])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user) {
        setLoading(false)
        return
      }

      setUser(session.user)

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      setProfile(profileData)

      const { data: enrollmentsData } = await supabase
        .from('enrollments')
        .select(
          `
          id,
          progress_percentage,
          courses (
            id,
            title,
            description,
            thumbnail_url,
            category,
            level
          )
        `
        )
        .eq('user_id', session.user.id)
        .eq('status', 'active')

      if (enrollmentsData) {
        setEnrollments(enrollmentsData as any)
      }

      const { count: completedLessons } = await supabase
        .from('lesson_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('completed', true)

      const { count: achievementsCount } = await supabase
        .from('user_badges')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id)

      const studyHours = Math.floor((completedLessons || 0) * 0.5)

      setStats({
        activeCourses: enrollmentsData?.length || 0,
        completedLessons: completedLessons || 0,
        achievements: achievementsCount || 0,
        studyHours,
      })
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return enrollments.filter((e) => {
      const course = e.courses
      if (!course) return false
      const pct = Math.round(e.progress_percentage || 0)
      if (statusFilter === 'completed' && pct < 100) return false
      if (statusFilter === 'not_started' && pct > 0) return false
      if (statusFilter === 'in_progress' && (pct <= 0 || pct >= 100)) return false
      if (!q) return true
      return (
        course.title?.toLowerCase().includes(q) ||
        course.category?.toLowerCase().includes(q) ||
        course.level?.toLowerCase().includes(q)
      )
    })
  }, [enrollments, query, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageSafe = Math.min(page, totalPages)
  const pageItems = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE)

  const continueCourse = useMemo(() => {
    const inProgress = enrollments
      .filter((e) => e.courses && (e.progress_percentage || 0) > 0 && (e.progress_percentage || 0) < 100)
      .sort((a, b) => (b.progress_percentage || 0) - (a.progress_percentage || 0))
    if (inProgress[0]) return inProgress[0]
    return enrollments.find((e) => e.courses && (e.progress_percentage || 0) < 100) || null
  }, [enrollments])

  if (loading) {
    return (
      <div className="container mx-auto flex items-center justify-center px-4 py-16">
        <Loader2 className="h-8 w-8 animate-spin text-bhutan-yellow" />
        <span className="ml-3 text-muted-foreground">Loading dashboard...</span>
      </div>
    )
  }

  const firstName =
    profile?.full_name?.split(' ')[0] ||
    user?.user_metadata?.full_name?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'Learner'

  const filters: { id: typeof statusFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'in_progress', label: 'In progress' },
    { id: 'not_started', label: 'Not started' },
    { id: 'completed', label: 'Done' },
  ]

  const continueThumb = resolveMediaUrl(continueCourse?.courses?.thumbnail_url)
  const continuePct = Math.round(continueCourse?.progress_percentage || 0)

  return (
    <div className="container mx-auto max-w-6xl px-4 py-5 sm:py-7 pb-[calc(2rem+env(safe-area-inset-bottom))] lg:pb-8">
      {/* Compact header */}
      <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Learning hub
          </p>
          <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
            Welcome back, {firstName}
          </h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 rounded-full sm:w-auto"
          render={<Link href="/courses" />}
        >
          Browse catalog
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Dense stats strip */}
      <div className="mb-5 grid grid-cols-4 gap-2 sm:mb-6 sm:gap-3">
        {[
          { label: 'Courses', value: stats.activeCourses, icon: BookOpen },
          { label: 'Lessons', value: stats.completedLessons, icon: TrendingUp },
          { label: 'Badges', value: stats.achievements, icon: Trophy },
          { label: 'Hours', value: stats.studyHours, icon: Clock },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-border/50 bg-card/70 px-2.5 py-2.5 sm:px-3 sm:py-3"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-lg font-semibold tabular-nums tracking-tight sm:text-xl">
                {s.value}
              </span>
              <s.icon className="h-3 w-3 text-muted-foreground" />
            </div>
            <p className="mt-0.5 truncate text-[10px] font-medium text-muted-foreground sm:text-xs">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_280px] lg:gap-6">
        <div className="min-w-0 space-y-5">
          {/* Continue learning — one featured slot */}
          {continueCourse?.courses && (
            <section className="overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-bhutan-yellow/10 via-card to-bhutan-orange/5">
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
                <div className="relative h-20 w-full shrink-0 overflow-hidden rounded-lg bg-muted sm:h-16 sm:w-28">
                  {continueThumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={continueThumb}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <BookOpen className="h-5 w-5 text-bhutan-orange/60" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3 w-3 text-bhutan-orange" />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-bhutan-orange">
                      Continue learning
                    </span>
                  </div>
                  <h2 className="line-clamp-2 text-sm font-semibold leading-snug sm:text-base">
                    {continueCourse.courses.title}
                  </h2>
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-bhutan-yellow to-bhutan-orange"
                        style={{ width: `${continuePct}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">
                      {continuePct}%
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="h-8 w-full shrink-0 gap-1.5 bg-bhutan-yellow text-black hover:bg-bhutan-orange sm:w-auto"
                  render={<Link href={`/learn/${continueCourse.courses.id}`} />}
                >
                  <PlayCircle className="h-3.5 w-3.5" />
                  Resume
                </Button>
              </div>
            </section>
          )}

          {/* Course library — searchable + paginated */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-tight sm:text-base">My courses</h2>
              <span className="text-xs text-muted-foreground tabular-nums">
                {filtered.length} of {enrollments.length}
              </span>
            </div>

            {enrollments.length > 0 ? (
              <>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search your courses…"
                      className="h-10 pl-9"
                    />
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
                    {filters.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setStatusFilter(f.id)}
                        className={cn(
                          'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                          statusFilter === f.id
                            ? 'border-transparent bg-gradient-to-r from-bhutan-yellow to-bhutan-orange text-black'
                            : 'border-border/60 bg-background/60 text-muted-foreground'
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {pageItems.map((enrollment) => {
                    const course = enrollment.courses
                    if (!course) return null
                    return (
                      <DashboardCourseCard
                        key={enrollment.id}
                        id={course.id}
                        title={course.title}
                        description={course.description}
                        category={course.category}
                        level={course.level}
                        thumbnailUrl={course.thumbnail_url}
                        progress={enrollment.progress_percentage || 0}
                      />
                    )
                  })}
                  {pageItems.length === 0 && (
                    <div className="col-span-full rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                      No courses match this filter.
                    </div>
                  )}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <p className="text-xs text-muted-foreground">
                      Page {pageSafe} of {totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1"
                        disabled={pageSafe <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Prev
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1"
                        disabled={pageSafe >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      >
                        Next
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                  <BookOpen className="h-6 w-6 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">No enrollments yet</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Browse the catalog and enroll to start learning.
                    </p>
                  </div>
                  <Button
                    className="mt-1 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
                    render={<Link href="/courses" />}
                  >
                    Explore courses
                  </Button>
                </CardContent>
              </Card>
            )}
          </section>
        </div>

        {/* Desktop side rail */}
        <aside className="hidden space-y-4 lg:block">
          <div className="rounded-2xl border border-border/50 bg-card/70 p-4">
            <h3 className="text-sm font-semibold">Quick actions</h3>
            <div className="mt-3 space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-full justify-start gap-2 text-xs"
                render={<Link href="/courses" />}
              >
                <BookOpen className="h-3.5 w-3.5" />
                Course catalog
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-full justify-start gap-2 text-xs"
                render={<Link href="/learn/progress" />}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                My progress
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-full justify-start gap-2 text-xs"
                render={<Link href="/announcements" />}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Announcements
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 bg-card/70 p-4">
            <h3 className="text-sm font-semibold">At a glance</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center justify-between gap-2">
                <span>In progress</span>
                <Badge variant="secondary" className="tabular-nums">
                  {
                    enrollments.filter((e) => {
                      const p = e.progress_percentage || 0
                      return p > 0 && p < 100
                    }).length
                  }
                </Badge>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span>Completed</span>
                <Badge variant="secondary" className="tabular-nums">
                  {enrollments.filter((e) => (e.progress_percentage || 0) >= 100).length}
                </Badge>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span>Not started</span>
                <Badge variant="secondary" className="tabular-nums">
                  {enrollments.filter((e) => (e.progress_percentage || 0) <= 0).length}
                </Badge>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
