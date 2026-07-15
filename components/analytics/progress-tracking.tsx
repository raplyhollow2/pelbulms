'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  BarChart3,
  LineChart,
  PieChart,
  TrendingUp,
  Clock,
  Target,
  Calendar,
  BookOpen,
  Trophy,
  Flame,
  Zap,
  CheckCircle,
  Circle,
  ArrowUp,
  ArrowDown,
  Award,
  Star,
  CalendarDays,
  Hourglass,
  Gauge,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProgressData {
  course_id: string
  course_title: string
  thumbnail_url?: string
  category: string
  level: string
  progress_percentage: number
  modules_completed: number
  total_modules: number
  lessons_completed: number
  total_lessons: number
  time_spent_hours: number
  time_remaining_hours: number
  last_accessed: string
  enrolled_date: string
  completion_date?: string
  average_score: number
  current_streak: number
  next_lesson?: {
    id: string
    title: string
    module_title: string
    duration_minutes: number
  }
}

interface WeeklyActivity {
  date: string
  lessons_completed: number
  time_spent_minutes: number
  xp_earned: number
  day_streak: number
}

interface LearningGoals {
  weekly_goal_hours: number
  weekly_progress_hours: number
  weekly_goal_lessons: number
  weekly_progress_lessons: number
  monthly_goal_courses: number
  monthly_progress_courses: number
  overall_goal_courses: number
  overall_progress_courses: number
}

interface PerformanceMetrics {
  average_completion_rate: number
  total_learning_hours: number
  longest_streak: number
  current_streak: number
  total_certificates: number
  total_xp: number
  current_level: number
  quizzes_passed: number
  quizzes_total: number
  assignments_completed: number
  assignments_total: number
}

export function ProgressTracking() {
  const [loading, setLoading] = useState(true)
  const [progressData, setProgressData] = useState<ProgressData[]>([])
  const [weeklyActivity, setWeeklyActivity] = useState<WeeklyActivity[]>([])
  const [learningGoals, setLearningGoals] = useState<LearningGoals>({
    weekly_goal_hours: 10,
    weekly_progress_hours: 6.5,
    weekly_goal_lessons: 15,
    weekly_progress_lessons: 8,
    monthly_goal_courses: 2,
    monthly_progress_courses: 1,
    overall_goal_courses: 10,
    overall_progress_courses: 3,
  })
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    average_completion_rate: 68,
    total_learning_hours: 47,
    longest_streak: 14,
    current_streak: 7,
    total_certificates: 3,
    total_xp: 1250,
    current_level: 5,
    quizzes_passed: 12,
    quizzes_total: 15,
    assignments_completed: 4,
    assignments_total: 6,
  })

  useEffect(() => {
    // Simulate loading progress data
    setTimeout(() => {
      setProgressData([
        {
          course_id: '1',
          course_title: 'React for Beginners',
          category: 'Web Development',
          level: 'Beginner',
          progress_percentage: 85,
          modules_completed: 4,
          total_modules: 5,
          lessons_completed: 17,
          total_lessons: 20,
          time_spent_hours: 12,
          time_remaining_hours: 2,
          last_accessed: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          enrolled_date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
          average_score: 87,
          current_streak: 5,
          next_lesson: {
            id: 'lesson-18',
            title: 'State Management Basics',
            module_title: 'Advanced React Concepts',
            duration_minutes: 25,
          },
        },
        {
          course_id: '2',
          course_title: 'TypeScript Masterclass',
          category: 'Programming',
          level: 'Intermediate',
          progress_percentage: 45,
          modules_completed: 3,
          total_modules: 6,
          lessons_completed: 12,
          total_lessons: 24,
          time_spent_hours: 18,
          time_remaining_hours: 22,
          last_accessed: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          enrolled_date: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
          average_score: 82,
          current_streak: 3,
          next_lesson: {
            id: 'lesson-13',
            title: 'Generic Types',
            module_title: 'Advanced TypeScript',
            duration_minutes: 30,
          },
        },
        {
          course_id: '3',
          course_title: 'UI/UX Design Principles',
          category: 'Design',
          level: 'Beginner',
          progress_percentage: 100,
          modules_completed: 4,
          total_modules: 4,
          lessons_completed: 16,
          total_lessons: 16,
          time_spent_hours: 15,
          time_remaining_hours: 0,
          last_accessed: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          enrolled_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          completion_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          average_score: 92,
          current_streak: 7,
        },
      ])

      // Generate weekly activity data
      const activity: WeeklyActivity[] = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        activity.push({
          date: date.toISOString().split('T')[0],
          lessons_completed: Math.floor(Math.random() * 5) + 1,
          time_spent_minutes: Math.floor(Math.random() * 120) + 30,
          xp_earned: Math.floor(Math.random() * 200) + 50,
          day_streak: i < 2 ? 7 - i : 7 - i,
        })
      }
      setWeeklyActivity(activity)

      setLoading(false)
    }, 1000)
  }, [])

  const getProgressColor = (percentage: number) => {
    if (percentage >= 75) return 'text-green-600'
    if (percentage >= 50) return 'text-blue-600'
    if (percentage >= 25) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getProgressVariant = (percentage: number) => {
    if (percentage >= 75) return 'success' as const
    if (percentage >= 50) return 'default' as const
    if (percentage >= 25) return 'warning' as const
    return 'destructive' as const
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatDuration = (hours: number) => {
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="glass">
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="w-12 h-12 bg-muted rounded-lg" />
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Performance Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-bhutan-yellow/20 flex items-center justify-center">
                <Target className="w-6 h-6 text-bhutan-yellow" />
              </div>
              <div>
                <p className="text-2xl font-bold">{performanceMetrics.average_completion_rate}%</p>
                <p className="text-sm text-muted-foreground">Avg. Completion</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-600/20 flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{performanceMetrics.total_learning_hours}h</p>
                <p className="text-sm text-muted-foreground">Total Learning</p>
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
                <p className="text-2xl font-bold">{performanceMetrics.current_streak}</p>
                <p className="text-sm text-muted-foreground">Day Streak</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-purple-600/20 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{performanceMetrics.total_certificates}</p>
                <p className="text-sm text-muted-foreground">Certificates</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="courses" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="courses">Course Progress</TabsTrigger>
          <TabsTrigger value="activity">Weekly Activity</TabsTrigger>
          <TabsTrigger value="goals">Learning Goals</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        {/* Course Progress Tab */}
        <TabsContent value="courses" className="space-y-4">
          {progressData.map((course) => (
            <Card key={course.course_id} className="glass">
              <CardContent className="p-6">
                <div className="flex items-start gap-6">
                  {/* Course Thumbnail */}
                  <div className="w-32 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                    {course.thumbnail_url ? (
                      <img
                        src={course.thumbnail_url}
                        alt={course.course_title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-bhutan-yellow/20 to-bhutan-orange/20 flex items-center justify-center">
                        <BookOpen className="w-8 h-8 text-bhutan-yellow" />
                      </div>
                    )}
                  </div>

                  {/* Course Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-lg">{course.course_title}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{course.category}</Badge>
                          <Badge className="bg-bhutan-yellow text-black">{course.level}</Badge>
                          {course.completion_date && (
                            <Badge className="bg-green-600">Completed</Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={cn("text-2xl font-bold", getProgressColor(course.progress_percentage))}>
                          {course.progress_percentage}%
                        </div>
                        <p className="text-xs text-muted-foreground">Complete</p>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <BookOpen className="w-3 h-3" />
                          <span>Modules</span>
                        </div>
                        <p className="font-semibold">{course.modules_completed}/{course.total_modules}</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <CheckCircle className="w-3 h-3" />
                          <span>Lessons</span>
                        </div>
                        <p className="font-semibold">{course.lessons_completed}/{course.total_lessons}</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>Time Spent</span>
                        </div>
                        <p className="font-semibold">{formatDuration(course.time_spent_hours)}</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Star className="w-3 h-3" />
                          <span>Avg. Score</span>
                        </div>
                        <p className="font-semibold">{course.average_score}%</p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <Progress value={course.progress_percentage} className="h-2" />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Last accessed: {formatDate(course.last_accessed)}</span>
                        <span>Enrolled: {formatDate(course.enrolled_date)}</span>
                      </div>
                    </div>

                    {/* Next Lesson */}
                    {!course.completion_date && course.next_lesson && (
                      <div className="mt-3 p-3 rounded-lg bg-bhutan-yellow/10 border border-bhutan-yellow/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">Next Lesson</p>
                            <p className="text-xs text-muted-foreground">{course.next_lesson.title}</p>
                            <p className="text-xs text-muted-foreground">{course.next_lesson.module_title}</p>
                          </div>
                          <Button size="sm" className="bg-bhutan-yellow hover:bg-bhutan-orange text-black">
                            Continue
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Weekly Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Weekly Learning Activity
              </CardTitle>
              <CardDescription>Your learning patterns over the past 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {weeklyActivity.map((day) => (
                  <div key={day.date} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="w-24 text-sm font-medium">
                      {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Progress value={(day.lessons_completed / 5) * 100} className="h-2 flex-1" />
                        <span className="text-sm font-medium w-8">{day.lessons_completed}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{Math.floor(day.time_spent_minutes / 60)}h {day.time_spent_minutes % 60}m</span>
                        <span>+{day.xp_earned} XP</span>
                        {day.day_streak > 0 && (
                          <div className="flex items-center gap-1 text-orange-500">
                            <Flame className="w-3 h-3" />
                            <span>{day.day_streak} day streak</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="glass">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  <div>
                    <p className="text-2xl font-bold">
                      {weeklyActivity.reduce((sum, day) => sum + day.lessons_completed, 0)}
                    </p>
                    <p className="text-sm text-muted-foreground">Lessons This Week</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Clock className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">
                      {Math.floor(weeklyActivity.reduce((sum, day) => sum + day.time_spent_minutes, 0) / 60)}h
                    </p>
                    <p className="text-sm text-muted-foreground">Time This Week</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Trophy className="w-5 h-5 text-purple-500" />
                  <div>
                    <p className="text-2xl font-bold">
                      {weeklyActivity.reduce((sum, day) => sum + day.xp_earned, 0)}
                    </p>
                    <p className="text-sm text-muted-foreground">XP This Week</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Learning Goals Tab */}
        <TabsContent value="goals" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Weekly Goals */}
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-lg">Weekly Goals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">Learning Hours</span>
                    <span className="font-medium">{learningGoals.weekly_progress_hours}/{learningGoals.weekly_goal_hours}h</span>
                  </div>
                  <Progress
                    value={(learningGoals.weekly_progress_hours / learningGoals.weekly_goal_hours) * 100}
                    className="h-2"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">Lessons Completed</span>
                    <span className="font-medium">{learningGoals.weekly_progress_lessons}/{learningGoals.weekly_goal_lessons}</span>
                  </div>
                  <Progress
                    value={(learningGoals.weekly_progress_lessons / learningGoals.weekly_goal_lessons) * 100}
                    className="h-2"
                  />
                </div>

                <div className="p-3 rounded-lg bg-bhutan-yellow/10 border border-bhutan-yellow/30">
                  <div className="flex items-center gap-2 text-sm">
                    <Flame className="w-4 h-4 text-orange-500" />
                    <span className="font-medium">Keep it up! You're on track</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Monthly Goals */}
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-lg">Monthly Goals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">Courses Completed</span>
                    <span className="font-medium">{learningGoals.monthly_progress_courses}/{learningGoals.monthly_goal_courses}</span>
                  </div>
                  <Progress
                    value={(learningGoals.monthly_progress_courses / learningGoals.monthly_goal_courses) * 100}
                    className="h-2"
                  />
                </div>

                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                    <span className="font-medium">1 more course to reach monthly goal</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Overall Goals */}
            <Card className="glass md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Overall Learning Goals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">Total Courses Target</span>
                      <span className="font-medium">{learningGoals.overall_progress_courses}/{learningGoals.overall_goal_courses}</span>
                    </div>
                    <Progress
                      value={(learningGoals.overall_progress_courses / learningGoals.overall_goal_courses) * 100}
                      className="h-2"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <p className="text-2xl font-bold text-bhutan-yellow">{progressData.length}</p>
                      <p className="text-xs text-muted-foreground">Active Courses</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <p className="text-2xl font-bold text-green-600">{progressData.filter(c => c.progress_percentage === 100).length}</p>
                      <p className="text-xs text-muted-foreground">Completed</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <p className="text-2xl font-bold text-blue-600">{performanceMetrics.total_learning_hours}h</p>
                      <p className="text-xs text-muted-foreground">Total Hours</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Assessment Performance */}
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-lg">Assessment Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">Quizzes Passed</span>
                    <span className="font-medium">{performanceMetrics.quizzes_passed}/{performanceMetrics.quizzes_total}</span>
                  </div>
                  <Progress
                    value={(performanceMetrics.quizzes_passed / performanceMetrics.quizzes_total) * 100}
                    className="h-2"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">Assignments Completed</span>
                    <span className="font-medium">{performanceMetrics.assignments_completed}/{performanceMetrics.assignments_total}</span>
                  </div>
                  <Progress
                    value={(performanceMetrics.assignments_completed / performanceMetrics.assignments_total) * 100}
                    className="h-2"
                  />
                </div>

                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm">Great progress! Keep maintaining your scores.</span>
                </div>
              </CardContent>
            </Card>

            {/* Learning Stats */}
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-lg">Learning Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-bhutan-yellow">{performanceMetrics.current_level}</div>
                    <p className="text-xs text-muted-foreground">Current Level</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{performanceMetrics.total_xp}</div>
                    <p className="text-xs text-muted-foreground">Total XP</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{performanceMetrics.longest_streak}</div>
                    <p className="text-xs text-muted-foreground">Longest Streak</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{performanceMetrics.total_certificates}</div>
                    <p className="text-xs text-muted-foreground">Certificates</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-border/50">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">Overall Performance Rating</p>
                    <div className="flex items-center justify-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={cn(
                            "w-6 h-6",
                            star <= 4 ? "fill-yellow-400 text-yellow-400" : "text-gray-400"
                          )}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Top 25% of learners
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Progress Timeline */}
            <Card className="glass md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Learning Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {progressData.map((course, index) => (
                    <div key={course.course_id} className="flex items-start gap-4">
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          "w-4 h-4 rounded-full",
                          course.progress_percentage === 100 ? "bg-green-600" : "bg-bhutan-yellow"
                        )} />
                        {index < progressData.length - 1 && (
                          <div className="w-0.5 h-full bg-border" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold">{course.course_title}</h4>
                            <p className="text-sm text-muted-foreground">
                              {course.progress_percentage === 100 ? 'Completed' : 'In Progress'} • {formatDate(course.enrolled_date)}
                            </p>
                          </div>
                          <Badge className={cn(
                            course.progress_percentage === 100 ? "bg-green-600" : "bg-bhutan-yellow text-black"
                          )}>
                            {course.progress_percentage}%
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}