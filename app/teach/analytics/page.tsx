'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, TrendingUp, Users, Clock, Award, BookOpen, Loader2, BarChart3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Course = Database['public']['Tables']['courses']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']

type CourseAnalytics = {
  course: Course
  totalEnrollments: number
  activeStudents: number
  completions: number
  averageProgress: number
  averageTimeSpent: number
  recentEnrollments: number
  engagementRate: number
}

type OverallStats = {
  totalStudents: number
  totalCourses: number
  totalCompletions: number
  averageRating: number
  totalRevenue: number
}

export default function TeacherAnalyticsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [overallStats, setOverallStats] = useState<OverallStats | null>(null)
  const [courseAnalytics, setCourseAnalytics] = useState<CourseAnalytics[]>([])

  const supabase = createClient()

  useEffect(() => {
    fetchAnalyticsData()
  }, [])

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }

      // Get user profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!profileData || ((profileData as any).role !== 'instructor' && (profileData as any).role !== 'admin')) {
        alert('Access denied. Analytics is for instructors only.')
        router.push('/dashboard')
        return
      }

      setProfile(profileData)

      // Fetch instructor's courses with analytics
      const { data: coursesData } = await supabase
        .from('courses')
        .select('*')
        .eq('instructor_id', user.id)
        .order('created_at', { ascending: false })

      if (coursesData) {
        // Calculate analytics for each course
        const analytics = await Promise.all(
          (coursesData as any).map(async (course: any) => {
            // Get enrollments
            const { data: enrollments } = await supabase
              .from('enrollments')
              .select('*')
              .eq('course_id', course.id)

            const totalEnrollments = enrollments?.length || 0
            const activeStudents = enrollments?.filter((e: any) => (e as any).status === 'active').length || 0
            const completions = enrollments?.filter((e: any) => (e as any).status === 'completed').length || 0

            // Calculate average progress
            const totalProgress = enrollments?.reduce((sum: number, e: any) => sum + (e.progress_percentage || 0), 0) || 0
            const averageProgress = totalEnrollments > 0 ? Math.round(totalProgress / totalEnrollments) : 0

            // Get recent enrollments (last 30 days)
            const thirtyDaysAgo = new Date()
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
            const recentEnrollments = enrollments?.filter((e: any) =>
              new Date(e.enrolled_at) >= thirtyDaysAgo
            ).length || 0

            // Calculate engagement rate (active + completed in last 30 days)
            const engagedStudents = enrollments?.filter((e: any) =>
              e.last_accessed_at && new Date(e.last_accessed_at) >= thirtyDaysAgo
            ).length || 0
            const engagementRate = totalEnrollments > 0
              ? Math.round((engagedStudents / totalEnrollments) * 100)
              : 0

            return {
              course,
              totalEnrollments,
              activeStudents,
              completions,
              averageProgress,
              averageTimeSpent: 0, // Would need lesson_progress data
              recentEnrollments,
              engagementRate
            } as CourseAnalytics
          })
        )

        setCourseAnalytics(analytics)

        // Calculate overall stats
        const totalStudents = analytics.reduce((sum, a) => sum + a.totalEnrollments, 0)
        const totalCompletions = analytics.reduce((sum, a) => sum + a.completions, 0)
        const overallProgress = analytics.reduce((sum, a) =>
          sum + (a.averageProgress * a.totalEnrollments), 0)
        const averageProgress = totalStudents > 0 ? Math.round(overallProgress / totalStudents) : 0

        setOverallStats({
          totalStudents,
          totalCourses: coursesData.length,
          totalCompletions,
          averageRating: 0, // Would need ratings table
          totalRevenue: 0 // Would need payment table
        } as any)
      }

    } catch (error) {
      console.error('Error fetching analytics data:', error)
      alert('Failed to load analytics data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-bhutan-yellow" />
          <span className="ml-3 text-muted-foreground">Loading analytics...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/teach/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, {profile?.full_name || 'Instructor'}!
            </p>
          </div>
        </div>

        {/* Overall Stats */}
        {overallStats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <Card className="glass hover:shadow-xl transition-all duration-300">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-bhutan-yellow">{overallStats.totalStudents}</div>
                <p className="text-xs text-muted-foreground mt-1">All time enrollments</p>
              </CardContent>
            </Card>

            <Card className="glass hover:shadow-xl transition-all duration-300">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Active Courses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-bhutan-orange">{overallStats.totalCourses}</div>
                <p className="text-xs text-muted-foreground mt-1">Published courses</p>
              </CardContent>
            </Card>

            <Card className="glass hover:shadow-xl transition-all duration-300">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Total Completions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{overallStats.totalCompletions}</div>
                <p className="text-xs text-muted-foreground mt-1">Students finished</p>
              </CardContent>
            </Card>

            <Card className="glass hover:shadow-xl transition-all duration-300">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Avg Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-bhutan-red">
                  {overallStats.totalStudents > 0
                    ? `${Math.round(courseAnalytics.reduce((sum, a) =>
                        sum + (a.averageProgress * a.totalEnrollments), 0) / overallStats.totalStudents)}%`
                    : '0%'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Course completion</p>
              </CardContent>
            </Card>

            <Card className="glass hover:shadow-xl transition-all duration-300">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {overallStats.totalStudents > 0
                    ? `${Math.round((overallStats.totalCompletions / overallStats.totalStudents) * 100)}%`
                    : '0%'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Students completed</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Course Analytics */}
        <Card className="glass-strong">
          <CardHeader>
            <CardTitle>Course Performance</CardTitle>
            <CardDescription>Detailed analytics for each of your courses</CardDescription>
          </CardHeader>
          <CardContent>
            {courseAnalytics.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No courses yet. Create your first course to see analytics.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {courseAnalytics.map((analytics) => (
                  <div
                    key={analytics.course.id}
                    className="p-6 border rounded-lg hover:border-bhutan-yellow/50 transition-all duration-300"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold">{analytics.course.title}</h3>
                          <Badge variant="outline" className="text-xs">
                            {analytics.course.category}
                          </Badge>
                          <Badge
                            variant={(analytics.course as any).is_published ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {(analytics.course as any).is_published ? 'Published' : 'Draft'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {analytics.course.description || 'No description'}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/teach/courses/${analytics.course.id}/students`)}
                      >
                        <Users className="w-4 h-4 mr-2" />
                        View Students
                      </Button>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-bhutan-yellow">
                          {analytics.totalEnrollments}
                        </div>
                        <p className="text-xs text-muted-foreground">Total Students</p>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {analytics.activeStudents}
                        </div>
                        <p className="text-xs text-muted-foreground">Active Now</p>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-bhutan-orange">
                          {analytics.completions}
                        </div>
                        <p className="text-xs text-muted-foreground">Completed</p>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {analytics.averageProgress}%
                        </div>
                        <p className="text-xs text-muted-foreground">Avg Progress</p>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {analytics.recentEnrollments}
                        </div>
                        <p className="text-xs text-muted-foreground">New (30d)</p>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-pink-600">
                          {analytics.engagementRate}%
                        </div>
                        <p className="text-xs text-muted-foreground">Engagement</p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Course Progress Distribution</span>
                        <span className="font-medium">{analytics.averageProgress}% avg</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-bhutan-yellow to-bhutan-orange h-2 rounded-full transition-all duration-300"
                          style={{ width: `${analytics.averageProgress}%` }}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/teach/courses/${analytics.course.id}/edit`)}
                      >
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Edit Course
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/learn/${analytics.course.id}`)}
                      >
                        <BookOpen className="w-4 h-4 mr-2" />
                        Preview
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance Insights */}
        <Card className="glass">
          <CardHeader>
            <CardTitle>Performance Insights</CardTitle>
            <CardDescription>Key metrics to help you improve your courses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <h4 className="font-semibold">Top Performing Course</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  {courseAnalytics.length > 0
                    ? courseAnalytics.reduce((a, b) =>
                        a.completions > b.completions ? a : b
                      ).course.title
                    : 'No courses yet'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {courseAnalytics.length > 0
                    ? `${courseAnalytics.reduce((a, b) =>
                        a.completions > b.completions ? a : b
                      ).completions} completions`
                    : ''}
                </p>
              </div>

              <div className="p-4 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="w-5 h-5 text-bhutan-yellow" />
                  <h4 className="font-semibold">Most Popular Course</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  {courseAnalytics.length > 0
                    ? courseAnalytics.reduce((a, b) =>
                        a.totalEnrollments > b.totalEnrollments ? a : b
                      ).course.title
                    : 'No courses yet'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {courseAnalytics.length > 0
                    ? `${courseAnalytics.reduce((a, b) =>
                        a.totalEnrollments > b.totalEnrollments ? a : b
                      ).totalEnrollments} students enrolled`
                    : ''}
                </p>
              </div>

              <div className="p-4 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold">Highest Engagement</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  {courseAnalytics.length > 0
                    ? courseAnalytics.reduce((a, b) =>
                        a.engagementRate > b.engagementRate ? a : b
                      ).course.title
                    : 'No courses yet'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {courseAnalytics.length > 0
                    ? `${courseAnalytics.reduce((a, b) =>
                        a.engagementRate > b.engagementRate ? a : b
                      ).engagementRate}% engagement rate`
                    : ''}
                </p>
              </div>

              <div className="p-4 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Award className="w-5 h-5 text-bhutan-orange" />
                  <h4 className="font-semibold">Best Completion Rate</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  {courseAnalytics.length > 0
                    ? courseAnalytics.reduce((a, b) => {
                        const rateA = a.totalEnrollments > 0 ? a.completions / a.totalEnrollments : 0
                        const rateB = b.totalEnrollments > 0 ? b.completions / b.totalEnrollments : 0
                        return rateA > rateB ? a : b
                      }).course.title
                    : 'No courses yet'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {courseAnalytics.length > 0
                    ? `${Math.round(
                        courseAnalytics.reduce((best, course) => {
                          const bestRate = best.totalEnrollments > 0 ? best.completions / best.totalEnrollments : 0
                          const courseRate = course.totalEnrollments > 0 ? course.completions / course.totalEnrollments : 0
                          return courseRate > bestRate ? course : best
                        }, courseAnalytics[0]).completions /
                        courseAnalytics.reduce((best, course) => {
                          const bestRate = best.totalEnrollments > 0 ? best.completions / best.totalEnrollments : 0
                          const courseRate = course.totalEnrollments > 0 ? course.completions / course.totalEnrollments : 0
                          return courseRate > bestRate ? course : best
                        }, courseAnalytics[0]).totalEnrollments * 100
                      )}% completion rate`
                    : ''}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}