'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Clock, Trophy, TrendingUp, Loader2, Bell, Megaphone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'
import { DashboardCourseCard } from '@/components/dashboard/course-card'

type Profile = Database['public']['Tables']['profiles']['Row']
type Enrollment = Database['public']['Tables']['enrollments']['Row']
type Course = Database['public']['Tables']['courses']['Row']

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    activeCourses: 0,
    completedLessons: 0,
    achievements: 0,
    studyHours: 0
  })
  const [recentAnnouncements, setRecentAnnouncements] = useState<any[]>([])
  const [announcementCount, setAnnouncementCount] = useState(0)

  const supabase = createClient()

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // Get user session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setLoading(false)
        return
      }

      setUser(session.user)

      // Get user profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      setProfile(profileData)

      // Get enrollments with course data
      const { data: enrollmentsData } = await supabase
        .from('enrollments')
        .select(`
          *,
          courses (
            id,
            title,
            description,
            thumbnail_url,
            category,
            level,
            instructor_id
          )
        `)
        .eq('user_id', session.user.id)
        .eq('status', 'active')

      if (enrollmentsData) {
        setEnrollments(enrollmentsData)
        const coursesData = enrollmentsData.map((e: any) => e.courses).filter(Boolean)
        setCourses(coursesData)
      }

      // Get completed lessons count
      const { count: completedLessons } = await supabase
        .from('lesson_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('completed', true)

      // Get achievements count
      const { count: achievementsCount } = await supabase
        .from('user_badges')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id)

      // Calculate study hours from activity log (simplified - assumes 1 hour per completed lesson)
      const studyHours = Math.floor((completedLessons || 0) * 0.5)

      setStats({
        activeCourses: enrollmentsData?.length || 0,
        completedLessons: completedLessons || 0,
        achievements: achievementsCount || 0,
        studyHours: studyHours
      } as any)

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
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

  const statCards = [
    { label: 'Active Courses', value: stats.activeCourses, hint: 'Enrolled', icon: BookOpen, tint: 'text-bhutan-yellow bg-bhutan-yellow/15' },
    { label: 'Completed', value: stats.completedLessons, hint: 'Lessons', icon: TrendingUp, tint: 'text-bhutan-orange bg-bhutan-orange/10' },
    { label: 'Achievements', value: stats.achievements, hint: 'Badges', icon: Trophy, tint: 'text-bhutan-red bg-bhutan-red/10' },
    { label: 'Study Hours', value: stats.studyHours, hint: 'Learned', icon: Clock, tint: 'text-green-600 bg-green-600/10' },
  ]

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <div className="space-y-6 sm:space-y-8">
        {/* Welcome Section */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">
            Welcome back, {profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0]}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">
            {stats.activeCourses > 0
              ? `Continue your learning journey with ${stats.activeCourses} active course${stats.activeCourses > 1 ? 's' : ''}`
              : 'Start your learning journey by exploring our course catalog'
            }
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {statCards.map((s) => (
            <Card key={s.label} className="glass hover-lift">
              <CardContent className="flex items-start justify-between gap-2 p-4">
                <div className="min-w-0">
                  <div className="text-2xl font-semibold tracking-tight md:text-3xl">{s.value}</div>
                  <p className="mt-0.5 truncate text-xs font-medium">{s.label}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{s.hint}</p>
                </div>
                <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${s.tint}`}>
                  <s.icon className="h-5 w-5" />
                </span>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Active Courses */}
        {courses.length > 0 && (
          <Card className="glass-strong">
            <CardHeader>
              <CardTitle>My Active Courses</CardTitle>
              <CardDescription>
                Continue learning where you left off
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {enrollments.map((enrollment: any) => {
                const course = enrollment.courses
                if (!course) return null
                return (
                  <DashboardCourseCard
                    key={course.id}
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
            </CardContent>
          </Card>
        )}

        {/* Getting Started - Show only if no courses */}
        {courses.length === 0 && (
          <Card className="glass-strong">
            <CardHeader>
              <CardTitle>Getting Started</CardTitle>
              <CardDescription>
                Your Pelbu LMS journey is about to begin
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-bhutan-yellow/10 border border-bhutan-yellow/20">
                <h3 className="font-semibold mb-2">🎯 Explore Courses</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Browse our catalog of courses and start learning with AI-powered features.
                </p>
                <Button
                  size="sm"
                  className="bg-bhutan-yellow hover:bg-bhutan-orange"
                  onClick={() => window.location.href = '/courses'}
                >
                  Browse Courses
                </Button>
              </div>
              <div className="p-4 rounded-lg bg-bhutan-orange/10 border border-bhutan-orange/20">
                <h3 className="font-semibold mb-2">📚 Track Progress</h3>
                <p className="text-sm text-muted-foreground">
                  Monitor your learning journey with detailed analytics and achievements.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-bhutan-red/10 border border-bhutan-red/20">
                <h3 className="font-semibold mb-2">🤖 AI Assistant</h3>
                <p className="text-sm text-muted-foreground">
                  Get 24/7 help from our AI tutor with personalized learning support.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}