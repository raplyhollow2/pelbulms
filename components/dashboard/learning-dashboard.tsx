'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  BookOpen,
  Clock,
  TrendingUp,
  Award,
  Calendar,
  Target,
  Flame,
  Star,
  Play,
  ChevronRight,
  Trophy,
  Zap,
  CheckCircle,
  Circle,
  BarChart3,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'
import { resolveMediaUrl } from '@/lib/media'

type Course = Database['public']['Tables']['courses']['Row']
type Enrollment = Database['public']['Tables']['enrollments']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']

interface LearningStats {
  totalCourses: number
  completedCourses: number
  inProgressCourses: number
  totalHours: number
  currentStreak: number
  totalCertificates: number
  averageProgress: number
  weeklyGoal: number
  weeklyProgress: number
}

interface RecentActivity {
  id: string
  type: 'lesson_completed' | 'course_started' | 'achievement_unlocked' | 'certificate_earned'
  title: string
  description: string
  timestamp: string
  course_id?: string
  course_title?: string
}

interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  unlocked: boolean
  unlocked_at?: string
  progress?: number
  total?: number
}

export function LearningDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<Profile | null>(null)
  const [stats, setStats] = useState<LearningStats>({
    totalCourses: 0,
    completedCourses: 0,
    inProgressCourses: 0,
    totalHours: 0,
    currentStreak: 0,
    totalCertificates: 0,
    averageProgress: 0,
    weeklyGoal: 5,
    weeklyProgress: 0,
  })
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [enrolledCourses, setEnrolledCourses] = useState<
    Array<Course & { progress: number; last_accessed: string }>
  >([])

  const supabase = createClient()

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        router.push('/auth/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      setUser(profile)

      // Fetch enrollments with course data
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
            duration_minutes,
            instructor_id,
            profiles:instructor_id (
              full_name,
              avatar_url
            )
          )
        `)
        .eq('user_id', authUser.id)
        .order('last_accessed', { ascending: false })

      if (enrollmentsData) {
        const courses = enrollmentsData.map((e: any) => ({
          ...e.courses,
          progress: e.progress_percentage || 0,
          last_accessed: e.last_accessed,
        })) as any

        setEnrolledCourses(courses)

        // Calculate stats
        const completedCourses = courses.filter((c: any) => c.progress === 100).length
        const inProgressCourses = courses.filter((c: any) => c.progress > 0 && c.progress < 100).length
        const totalHours = courses.reduce((sum: number, c: any) => {
          const courseHours = (c.duration_minutes || 0) / 60
          return sum + (courseHours * (c.progress / 100))
        }, 0)
        const averageProgress = courses.length > 0
          ? courses.reduce((sum: number, c: any) => sum + c.progress, 0) / courses.length
          : 0

        setStats((prev) => ({
          ...prev,
          totalCourses: courses.length,
          completedCourses,
          inProgressCourses,
          totalHours: Math.round(totalHours),
          averageProgress: Math.round(averageProgress),
        }))
      }

      // Generate mock recent activities
      setRecentActivities([
        {
          id: '1',
          type: 'lesson_completed',
          title: 'Lesson Completed',
          description: 'You completed "Introduction to React Hooks"',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          course_id: enrolledCourses[0]?.id,
          course_title: enrolledCourses[0]?.title,
        },
        {
          id: '2',
          type: 'achievement_unlocked',
          title: 'Achievement Unlocked',
          description: 'You earned "Quick Learner" badge',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: '3',
          type: 'course_started',
          title: 'Course Started',
          description: 'You enrolled in "Advanced TypeScript Patterns"',
          timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
          course_id: enrolledCourses[1]?.id,
          course_title: enrolledCourses[1]?.title,
        },
      ])

      // Generate mock achievements
      setAchievements([
        {
          id: '1',
          title: 'First Steps',
          description: 'Complete your first lesson',
          icon: '🎯',
          unlocked: true,
          unlocked_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: '2',
          title: 'Quick Learner',
          description: 'Complete 5 lessons in one day',
          icon: '⚡',
          unlocked: true,
          unlocked_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: '3',
          title: 'Dedicated Student',
          description: '7-day learning streak',
          icon: '🔥',
          unlocked: true,
          progress: 5,
          total: 7,
        },
        {
          id: '4',
          title: 'Course Master',
          description: 'Complete your first course',
          icon: '🏆',
          unlocked: false,
          progress: 1,
          total: 1,
        },
        {
          id: '5',
          title: 'Knowledge Seeker',
          description: 'Enroll in 5 courses',
          icon: '📚',
          unlocked: false,
          progress: 3,
          total: 5,
        },
      ])

      // Calculate weekly progress (mock)
      setStats((prev) => ({
        ...prev,
        currentStreak: 5,
        weeklyProgress: 3,
        totalCertificates: prev.completedCourses, // Use the value that was already set
      }))
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getActivityIcon = (type: RecentActivity['type']) => {
    switch (type) {
      case 'lesson_completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'course_started':
        return <BookOpen className="w-5 h-5 text-blue-600" />
      case 'achievement_unlocked':
        return <Trophy className="w-5 h-5 text-yellow-600" />
      case 'certificate_earned':
        return <Award className="w-5 h-5 text-purple-600" />
      default:
        return <Circle className="w-5 h-5" />
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-bhutan-yellow border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading your learning dashboard...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16 border-2 border-bhutan-yellow">
              <AvatarImage src={user?.avatar_url} />
              <AvatarFallback className="bg-bhutan-yellow text-black font-bold">
                {getInitials(user?.full_name || 'User')}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold">Welcome back, {user?.full_name?.split(' ')[0]}!</h1>
              <p className="text-muted-foreground">Continue your learning journey</p>
            </div>
          </div>
          <Button
            className="bg-bhutan-yellow hover:bg-bhutan-orange text-black"
            onClick={() => router.push('/courses')}
          >
            <BookOpen className="w-4 h-4 mr-2" />
            Browse Courses
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="glass">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-bhutan-yellow/20 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-bhutan-yellow" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalCourses}</p>
                  <p className="text-sm text-muted-foreground">Enrolled Courses</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-green-600/20 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.completedCourses}</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-orange-600/20 flex items-center justify-center">
                  <Flame className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.currentStreak}</p>
                  <p className="text-sm text-muted-foreground">Day Streak</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-purple-600/20 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalHours}h</p>
                  <p className="text-sm text-muted-foreground">Learning Time</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Weekly Goal Progress */}
        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">Weekly Learning Goal</h3>
                <p className="text-sm text-muted-foreground">
                  {stats.weeklyProgress} of {stats.weeklyGoal} hours this week
                </p>
              </div>
              <Badge className="bg-bhutan-yellow text-black">
                {Math.round((stats.weeklyProgress / stats.weeklyGoal) * 100)}%
              </Badge>
            </div>
            <Progress value={(stats.weeklyProgress / stats.weeklyGoal) * 100} className="h-3" />
            <p className="text-xs text-muted-foreground mt-2">
              {stats.weeklyGoal - stats.weeklyProgress} more hours to reach your weekly goal
            </p>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs defaultValue="continue" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="continue">Continue Learning</TabsTrigger>
            <TabsTrigger value="activity">Recent Activity</TabsTrigger>
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Continue Learning Tab */}
          <TabsContent value="continue" className="space-y-4">
            {enrolledCourses.length === 0 ? (
              <Card className="glass">
                <CardContent className="p-12 text-center">
                  <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No courses yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Start your learning journey by enrolling in your first course
                  </p>
                  <Button
                    className="bg-bhutan-yellow hover:bg-bhutan-orange text-black"
                    onClick={() => router.push('/courses')}
                  >
                    Browse Courses
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {enrolledCourses.map((course) => (
                  <Card
                    key={course.id}
                    className="glass hover:shadow-lg transition-all cursor-pointer group"
                    onClick={() => router.push(`/learn/${course.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="aspect-video mb-4 rounded-lg overflow-hidden bg-muted">
                        {course.thumbnail_url ? (
                          <img
                            src={resolveMediaUrl(course.thumbnail_url) || course.thumbnail_url}
                            alt={course.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-bhutan-yellow/20 to-bhutan-orange/20 flex items-center justify-center">
                            <BookOpen className="w-8 h-8 text-bhutan-yellow" />
                          </div>
                        )}
                      </div>

                      <h4 className="font-semibold mb-2 line-clamp-2 group-hover:text-bhutan-yellow transition-colors">
                        {course.title}
                      </h4>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">{course.progress}%</span>
                        </div>
                        <Progress value={course.progress} className="h-2" />
                      </div>

                      <Button
                        className="w-full bg-bhutan-yellow hover:bg-bhutan-orange text-black"
                        size="sm"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Continue
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Recent Activity Tab */}
          <TabsContent value="activity" className="space-y-4">
            <Card className="glass">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Your latest learning activities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-4 p-4 rounded-lg border border-border/50 hover:border-bhutan-yellow/30 transition-colors"
                    >
                      <div className="flex-shrink-0">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-semibold">{activity.title}</h4>
                          <span className="text-xs text-muted-foreground">
                            {new Date(activity.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{activity.description}</p>
                        {activity.course_title && (
                          <Button
                            variant="link"
                            className="p-0 h-auto text-bhutan-yellow"
                            onClick={() => activity.course_id && router.push(`/learn/${activity.course_id}`)}
                          >
                            View Course
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Achievements Tab */}
          <TabsContent value="achievements" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {achievements.map((achievement) => (
                <Card
                  key={achievement.id}
                  className={`glass ${
                    achievement.unlocked
                      ? 'border-bhutan-yellow/30'
                      : 'opacity-60'
                  }`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="text-4xl">{achievement.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">{achievement.title}</h4>
                          {achievement.unlocked && (
                            <Badge className="bg-green-600">Unlocked</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          {achievement.description}
                        </p>

                        {achievement.progress !== undefined && achievement.total !== undefined && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span>Progress</span>
                              <span>
                                {achievement.progress}/{achievement.total}
                              </span>
                            </div>
                            <Progress
                              value={(achievement.progress / achievement.total) * 100}
                              className="h-2"
                            />
                          </div>
                        )}

                        {achievement.unlocked && achievement.unlocked_at && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Unlocked {new Date(achievement.unlocked_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Learning Progress
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm">Average Course Progress</span>
                        <span className="font-semibold">{stats.averageProgress}%</span>
                      </div>
                      <Progress value={stats.averageProgress} className="h-2" />
                    </div>

                    <div className="pt-4 border-t border-border/50">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold text-bhutan-yellow">
                            {stats.inProgressCourses}
                          </p>
                          <p className="text-xs text-muted-foreground">In Progress</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-green-600">
                            {stats.completedCourses}
                          </p>
                          <p className="text-xs text-muted-foreground">Completed</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-purple-600">
                            {stats.totalCertificates}
                          </p>
                          <p className="text-xs text-muted-foreground">Certificates</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Learning Goals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-bhutan-yellow/10 border border-bhutan-yellow/30">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Weekly Goal</span>
                        <Badge className="bg-bhutan-yellow text-black">
                          {stats.weeklyProgress}/{stats.weeklyGoal}h
                        </Badge>
                      </div>
                      <Progress
                        value={(stats.weeklyProgress / stats.weeklyGoal) * 100}
                        className="h-2"
                      />
                    </div>

                    <div className="p-4 rounded-lg bg-orange-600/10 border border-orange-600/30">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Current Streak</span>
                        <Badge className="bg-orange-600">
                          <Flame className="w-3 h-3 mr-1" />
                          {stats.currentStreak} days
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Keep learning to maintain your streak!
                      </p>
                    </div>

                    <div className="p-4 rounded-lg bg-purple-600/10 border border-purple-600/30">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Total Learning</span>
                        <Badge className="bg-purple-600">
                          <Clock className="w-3 h-3 mr-1" />
                          {stats.totalHours}h
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Great progress! Keep up the excellent work.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Learning Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-3xl font-bold text-bhutan-yellow mb-1">
                      {stats.totalCourses}
                    </p>
                    <p className="text-sm text-muted-foreground">Courses Enrolled</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-3xl font-bold text-green-600 mb-1">
                      {stats.completedCourses}
                    </p>
                    <p className="text-sm text-muted-foreground">Completed</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-3xl font-bold text-blue-600 mb-1">
                      {stats.inProgressCourses}
                    </p>
                    <p className="text-sm text-muted-foreground">In Progress</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-3xl font-bold text-purple-600 mb-1">
                      {stats.totalHours}h
                    </p>
                    <p className="text-sm text-muted-foreground">Total Hours</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}