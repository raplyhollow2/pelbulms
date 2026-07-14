'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, BookOpen, Clock, Trophy, TrendingUp, Loader2, CheckCircle, Circle, Flame, Calendar } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Enrollment = Database['public']['Tables']['enrollments']['Row']
type Course = Database['public']['Tables']['courses']['Row']
type LessonProgress = Database['public']['Tables']['lesson_progress']['Row']
type Module = Database['public']['Tables']['modules']['Row']
type Lesson = Database['public']['Tables']['lessons']['Row']

export default function ProgressPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  // Data states
  const [enrollments, setEnrollments] = useState<(Enrollment & { courses: Course })[]>([])
  const [lessonProgress, setLessonProgress] = useState<LessonProgress[]>([])
  const [modules, setModules] = useState<(Module & { lessons: Lesson[] })[]>([])

  // Analytics states
  const [overallStats, setOverallStats] = useState({
    totalCourses: 0,
    completedCourses: 0,
    inProgressCourses: 0,
    totalLessons: 0,
    completedLessons: 0,
    totalTimeSpent: 0,
    averageProgress: 0,
    learningStreak: 0,
    thisWeekActivity: 0
  })

  const [recentActivity, setRecentActivity] = useState<Array<{
    type: 'lesson' | 'course'
    title: string
    completedAt: string
    progress?: number
  }>>([])

  const supabase = createClient()

  useEffect(() => {
    fetchProgressData()
  }, [])

  const fetchProgressData = async () => {
    try {
      setLoading(true)

      // Get user session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/auth/login')
        return
      }

      setUser(session.user)

      // Fetch enrollments with course data
      const { data: enrollmentsData } = await supabase
        .from('enrollments')
        .select(`
          *,
          courses (*)
        `)
        .eq('user_id', session.user.id)
        .order('last_accessed_at', { ascending: false })

      if (enrollmentsData) {
        setEnrollments(enrollmentsData as any)

        // Calculate course stats
        const completedCourses = enrollmentsData.filter((e: any) => e.completed_at).length
        const inProgressCourses = enrollmentsData.filter((e: any) => !e.completed_at).length
        const averageProgress = enrollmentsData.reduce((sum: number, e: any) => sum + (e.progress_percentage || 0), 0) / (enrollmentsData.length || 1)

        setOverallStats(prev => ({
          ...prev,
          totalCourses: enrollmentsData.length,
          completedCourses,
          inProgressCourses,
          averageProgress: Math.round(averageProgress)
        }))
      }

      // Fetch all lesson progress
      const { data: lessonProgressData } = await supabase
        .from('lesson_progress')
        .select('*')
        .eq('user_id', session.user.id)
        .order('last_accessed_at', { ascending: false })

      if (lessonProgressData) {
        setLessonProgress(lessonProgressData as LessonProgress[])

        // Calculate lesson stats
        const completedLessons = lessonProgressData.filter((lp: LessonProgress) => lp.completed).length
        const totalTimeSpent = lessonProgressData.reduce((sum: number, lp: LessonProgress) => sum + (lp.time_spent_seconds || 0), 0)

        setOverallStats(prev => ({
          ...prev,
          totalLessons: lessonProgressData.length,
          completedLessons,
          totalTimeSpent
        }))

        // Create recent activity from lesson progress
        const recentActivityData = (lessonProgressData as LessonProgress[]).slice(0, 10).map(lp => ({
          type: 'lesson' as const,
          title: `Lesson completed`,
          completedAt: lp.completed_at || lp.last_accessed_at,
          progress: lp.completed ? 100 : 0
        }))
        setRecentActivity(recentActivityData)
      }

      // Fetch all modules and lessons for detailed progress
      if (enrollmentsData && enrollmentsData.length > 0) {
        const courseIds = enrollmentsData.map((e: any) => e.course_id)

        const { data: modulesData } = await supabase
          .from('modules')
          .select(`
            *,
            lessons (*)
          `)
          .in('course_id', courseIds)
          .order('order_index', { ascending: true })

        if (modulesData) {
          setModules(modulesData as any)

          // Calculate total lessons across all courses
          const totalLessons = (modulesData as any).reduce((sum: number, mod: any) =>
            sum + (mod.lessons?.length || 0), 0)

          setOverallStats(prev => ({ ...prev, totalLessons }))
        }
      }

      // Calculate learning streak (completed lessons in consecutive days)
      const streak = await calculateLearningStreak(session.user.id)
      setOverallStats(prev => ({ ...prev, learningStreak: streak }))

    } catch (error) {
      console.error('Error fetching progress data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateLearningStreak = async (userId: string) => {
    try {
      // Get completed lesson dates from last 30 days
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data: recentProgress } = await supabase
        .from('lesson_progress')
        .select('completed_at')
        .eq('user_id', userId)
        .eq('completed', true)
        .gte('completed_at', thirtyDaysAgo.toISOString())
        .order('completed_at', { ascending: false })

      if (!recentProgress || recentProgress.length === 0) return 0

      // Calculate consecutive days with activity
      const uniqueDates = new Set(
        recentProgress.map((lp: LessonProgress) => new Date(lp.completed_at || '').toDateString())
      )

      return uniqueDates.size
    } catch (error) {
      console.error('Error calculating streak:', error)
      return 0
    }
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)

    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60))
        return diffMinutes === 0 ? 'Just now' : `${diffMinutes}m ago`
      }
      return `${diffHours}h ago`
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-bhutan-yellow" />
          <span className="ml-3 text-muted-foreground">Loading progress...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold">Learning Progress</h1>
        </div>

        {/* Overall Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <Card className="glass hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium">In Progress</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl md:text-3xl font-bold text-bhutan-yellow">
                {overallStats.inProgressCourses}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Active courses</p>
            </CardContent>
          </Card>

          <Card className="glass hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium">Completed</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl md:text-3xl font-bold text-green-600">
                {overallStats.completedCourses}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Courses finished</p>
            </CardContent>
          </Card>

          <Card className="glass hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium">Total Time</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl md:text-3xl font-bold text-bhutan-orange">
                {formatTime(overallStats.totalTimeSpent)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Learning time</p>
            </CardContent>
          </Card>

          <Card className="glass hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium">Learning Streak</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-2">
                <Flame className="w-6 h-6 text-orange-500" />
                <div className="text-2xl md:text-3xl font-bold text-orange-500">
                  {overallStats.learningStreak}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Days active</p>
            </CardContent>
          </Card>
        </div>

        {/* Course Progress */}
        <Card className="glass-strong">
          <CardHeader>
            <CardTitle>Course Progress</CardTitle>
            <CardDescription>Your progress across all enrolled courses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {enrollments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No courses enrolled yet. Start your learning journey!
              </div>
            ) : (
              enrollments.map((enrollment) => {
                const course = enrollment.courses
                const isCompleted = !!enrollment.completed_at
                const progress = enrollment.progress_percentage || 0

                return (
                  <div
                    key={enrollment.id}
                    className="p-4 border rounded-lg hover:border-bhutan-yellow/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/learn/${enrollment.course_id}`)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{course?.title}</h3>
                          {isCompleted && (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {isCompleted ? 'Completed on ' + formatDate(enrollment.completed_at || '') :
                           'Last accessed ' + formatDate(enrollment.last_accessed_at)}
                        </p>
                      </div>
                      <Badge
                        variant={isCompleted ? "default" : "secondary"}
                        className={isCompleted ? "bg-green-600" : ""}
                      >
                        {progress}%
                      </Badge>
                    </div>

                    <div className="space-y-1">
                      <Progress
                        value={progress}
                        className="h-2"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{progress}% complete</span>
                        <span>{isCompleted ? 'Finished' : 'In progress'}</span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="glass-strong">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest learning activity</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No recent activity. Start learning to track your progress!
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-background/50 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-bhutan-yellow/20 flex items-center justify-center flex-shrink-0">
                      {activity.type === 'lesson' ? (
                        <BookOpen className="w-5 h-5 text-bhutan-yellow" />
                      ) : (
                        <Trophy className="w-5 h-5 text-bhutan-orange" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(activity.completedAt)}</p>
                    </div>
                    {activity.progress !== undefined && (
                      <Badge variant="secondary" className="text-xs">
                        {activity.progress}%
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Learning Insights */}
        <Card className="glass-strong">
          <CardHeader>
            <CardTitle>Learning Insights</CardTitle>
            <CardDescription>Statistics about your learning journey</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-background/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="w-5 h-5 text-bhutan-yellow" />
                  <h3 className="font-semibold">Total Lessons</h3>
                </div>
                <p className="text-2xl font-bold">
                  {overallStats.completedLessons} <span className="text-lg text-muted-foreground">/ {overallStats.totalLessons}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">Lessons completed</p>
              </div>

              <div className="p-4 bg-background/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <h3 className="font-semibold">Average Progress</h3>
                </div>
                <p className="text-2xl font-bold">{overallStats.averageProgress}%</p>
                <p className="text-xs text-muted-foreground mt-1">Across all courses</p>
              </div>

              <div className="p-4 bg-background/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-bhutan-orange" />
                  <h3 className="font-semibold">Total Study Time</h3>
                </div>
                <p className="text-2xl font-bold">{formatTime(overallStats.totalTimeSpent)}</p>
                <p className="text-xs text-muted-foreground mt-1">Time invested in learning</p>
              </div>

              <div className="p-4 bg-background/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <h3 className="font-semibold">Learning Streak</h3>
                </div>
                <p className="text-2xl font-bold">{overallStats.learningStreak} days</p>
                <p className="text-xs text-muted-foreground mt-1">Consecutive days of activity</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}