'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Clock, Trophy, TrendingUp, Loader2, Bell, Megaphone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-8">
        {/* Welcome Section */}
        <div>
          <h1 className="text-4xl font-bold mb-2">
            Welcome back, {profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0]}!
          </h1>
          <p className="text-xl text-muted-foreground">
            {stats.activeCourses > 0
              ? `Continue your learning journey with ${stats.activeCourses} active course${stats.activeCourses > 1 ? 's' : ''}`
              : 'Start your learning journey by exploring our course catalog'
            }
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <Card className="glass hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium">Active Courses</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl md:text-3xl font-bold text-bhutan-yellow">{stats.activeCourses}</div>
              <p className="text-xs text-muted-foreground mt-1">Enrolled courses</p>
            </CardContent>
          </Card>

          <Card className="glass hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium">Completed Lessons</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl md:text-3xl font-bold text-bhutan-orange">{stats.completedLessons}</div>
              <p className="text-xs text-muted-foreground mt-1">Lessons finished</p>
            </CardContent>
          </Card>

          <Card className="glass hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium">Achievements</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl md:text-3xl font-bold text-bhutan-red">{stats.achievements}</div>
              <p className="text-xs text-muted-foreground mt-1">Badges earned</p>
            </CardContent>
          </Card>

          <Card className="glass hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium">Study Hours</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl md:text-3xl font-bold text-green-600">{stats.studyHours}</div>
              <p className="text-xs text-muted-foreground mt-1">Hours learned</p>
            </CardContent>
          </Card>
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
            <CardContent className="space-y-4">
              {courses.map((course: any, index: number) => {
                const enrollment = enrollments[index]
                return (
                  <div
                    key={course.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-lg bg-background/50 hover:bg-background transition-colors border border-border/50"
                  >
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="w-12 h-12 sm:w-16 sm:h-12 rounded bg-gradient-to-br from-bhutan-yellow/20 to-bhutan-orange/20 flex items-center justify-center flex-shrink-0">
                        {course.thumbnail_url ? (
                          <img
                            src={course.thumbnail_url}
                            alt={course.title}
                            className="w-full h-full object-cover rounded"
                          />
                        ) : (
                          <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-bhutan-yellow" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm sm:text-base truncate">{course.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">{course.category}</Badge>
                          <Badge variant="secondary" className="text-xs">{course.level}</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="text-right">
                        <div className="text-sm font-medium">{enrollment?.progress_percentage || 0}%</div>
                        <div className="text-xs text-muted-foreground">Complete</div>
                      </div>
                      <Button
                        size="sm"
                        className="bg-bhutan-yellow hover:bg-bhutan-orange whitespace-nowrap"
                        onClick={() => window.location.href = `/learn/${course.id}`}
                      >
                        <TrendingUp className="w-4 h-4 mr-1" />
                        <span className="hidden sm:inline">Continue</span>
                        <span className="sm:hidden">Go</span>
                      </Button>
                    </div>
                  </div>
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