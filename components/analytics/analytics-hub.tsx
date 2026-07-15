'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import {
  TrendingUp,
  TrendingDown,
  Users,
  BookOpen,
  Clock,
  Target,
  Award,
  Calendar,
  Download,
  Filter,
  BarChart3,
  LineChart,
  PieChart,
  Activity,
  Brain,
  CheckCircle2,
  AlertTriangle,
  Star,
  Zap,
  Eye,
  MessageSquare,
  FileText,
  Video,
  Code,
  GraduationCap,
  Timer,
  Flame,
  Trophy,
  Medal,
  Crown
} from 'lucide-react'

interface StudentAnalytics {
  totalHours: number
  coursesCompleted: number
  coursesInProgress: number
  averageScore: number
  currentStreak: number
  longestStreak: number
  totalAchievements: number
  skillLevel: string
  learningVelocity: number
  preferredTopics: string[]
  strongAreas: string[]
  improvementAreas: string[]
  weeklyGoalProgress: number
  monthlyGoalProgress: number
  peerComparison: {
    percentile: number
    rank: number
    totalStudents: number
  }
}

interface InstructorAnalytics {
  totalStudents: number
  activeCourses: number
  averageStudentRating: number
  totalRevenue: number
  courseCompletionRate: number
  studentEngagementRate: number
  topPerformingCourses: {
    id: string
    title: string
    enrollment: number
    completion: number
    rating: number
    revenue: number
  }[]
  studentFeedback: {
    positive: number
    neutral: number
    negative: number
  }
  teachingMetrics: {
    averageResponseTime: number
    forumEngagement: number
    contentUpdates: number
    officeHoursAttendance: number
  }
}

interface AdminAnalytics {
  totalUsers: number
  activeUsers: number
  totalCourses: number
  totalRevenue: number
  monthlyGrowth: number
  platformHealth: {
    uptime: number
    averageResponseTime: number
    errorRate: number
    userSatisfaction: number
  }
  userDemographics: {
    byRole: Record<string, number>
    byRegion: Record<string, number>
    byAgeGroup: Record<string, number>
  }
  systemUsage: {
    totalStorage: number
    usedStorage: number
    apiCalls: number
    bandwidthUsage: number
  }
  institutionalMetrics: {
    totalInstitutions: number
    activeInstitutions: number
    averageInstitutionSize: number
    retentionRate: number
  }
}

interface LearningProgress {
  date: string
  hours: number
  coursesCompleted: number
  quizScores: number[]
  achievements: string[]
}

export function AnalyticsHub() {
  const [activeTab, setActiveTab] = useState<'student' | 'instructor' | 'admin'>('student')
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month')
  const [studentAnalytics, setStudentAnalytics] = useState<StudentAnalytics | null>(null)
  const [instructorAnalytics, setInstructorAnalytics] = useState<InstructorAnalytics | null>(null)
  const [adminAnalytics, setAdminAnalytics] = useState<AdminAnalytics | null>(null)
  const [learningProgress, setLearningProgress] = useState<LearningProgress[]>([])
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)

  useEffect(() => {
    fetchAnalyticsData()
  }, [timeRange])

  const fetchAnalyticsData = async () => {
    // Mock analytics data
    setStudentAnalytics({
      totalHours: 127,
      coursesCompleted: 8,
      coursesInProgress: 3,
      averageScore: 87,
      currentStreak: 14,
      longestStreak: 28,
      totalAchievements: 42,
      skillLevel: 'Advanced',
      learningVelocity: 1.8,
      preferredTopics: ['Web Development', 'Data Science', 'Machine Learning'],
      strongAreas: ['JavaScript', 'React', 'Python'],
      improvementAreas: ['Database Design', 'System Architecture'],
      weeklyGoalProgress: 75,
      monthlyGoalProgress: 68,
      peerComparison: {
        percentile: 85,
        rank: 156,
        totalStudents: 1234
      }
    })

    setInstructorAnalytics({
      totalStudents: 2341,
      activeCourses: 12,
      averageStudentRating: 4.7,
      totalRevenue: 45600,
      courseCompletionRate: 78,
      studentEngagementRate: 82,
      topPerformingCourses: [
        { id: '1', title: 'Complete Web Development', enrollment: 892, completion: 85, rating: 4.8, revenue: 12450 },
        { id: '2', title: 'Python for Data Science', enrollment: 654, completion: 72, rating: 4.6, revenue: 9800 },
        { id: '3', title: 'React Masterclass', enrollment: 543, completion: 91, rating: 4.9, revenue: 8900 }
      ],
      studentFeedback: {
        positive: 156,
        neutral: 23,
        negative: 8
      },
      teachingMetrics: {
        averageResponseTime: 2.4,
        forumEngagement: 87,
        contentUpdates: 15,
        officeHoursAttendance: 78
      }
    })

    setAdminAnalytics({
      totalUsers: 5678,
      activeUsers: 2341,
      totalCourses: 234,
      totalRevenue: 123456,
      monthlyGrowth: 12.5,
      platformHealth: {
        uptime: 99.95,
        averageResponseTime: 142,
        errorRate: 0.02,
        userSatisfaction: 4.7
      },
      userDemographics: {
        byRole: { student: 4567, instructor: 892, admin: 219 },
        byRegion: { 'North America': 2341, 'Europe': 1876, 'Asia': 1234, 'Other': 227 },
        byAgeGroup: { '18-24': 2890, '25-34': 1987, '35-44': 654, '45+': 147 }
      },
      systemUsage: {
        totalStorage: 500,
        usedStorage: 234,
        apiCalls: 1234567,
        bandwidthUsage: 45.6
      },
      institutionalMetrics: {
        totalInstitutions: 45,
        activeInstitutions: 38,
        averageInstitutionSize: 126,
        retentionRate: 87
      }
    })

    // Generate mock progress data
    const progressData: LearningProgress[] = []
    const today = new Date()
    for (let i = 30; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      progressData.push({
        date: date.toISOString().split('T')[0],
        hours: Math.random() * 4 + 1,
        coursesCompleted: Math.random() > 0.9 ? 1 : 0,
        quizScores: Array.from({ length: Math.floor(Math.random() * 3) }, () => Math.floor(Math.random() * 30) + 70),
        achievements: Math.random() > 0.8 ? ['New Achievement'] : []
      })
    }
    setLearningProgress(progressData)
  }

  const generateReport = async () => {
    setIsGeneratingReport(true)
    // Simulate report generation
    await new Promise(resolve => setTimeout(resolve, 2000))
    setIsGeneratingReport(false)
  }

  const exportData = () => {
    const data = activeTab === 'student' ? studentAnalytics :
                 activeTab === 'instructor' ? instructorAnalytics : adminAnalytics
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeTab}-analytics-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics & Reporting</h2>
          <p className="text-gray-600 dark:text-gray-400">Comprehensive insights for students, instructors, and administrators</p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={(value) => setTimeRange(value as any)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Last Week</SelectItem>
              <SelectItem value="month">Last Month</SelectItem>
              <SelectItem value="quarter">Last Quarter</SelectItem>
              <SelectItem value="year">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={exportData}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="student">
            <GraduationCap className="w-4 h-4 mr-2" />
            Student
          </TabsTrigger>
          <TabsTrigger value="instructor">
            <BookOpen className="w-4 h-4 mr-2" />
            Instructor
          </TabsTrigger>
          <TabsTrigger value="admin">
            <BarChart3 className="w-4 h-4 mr-2" />
            Admin
          </TabsTrigger>
        </TabsList>

        {/* Student Analytics Tab */}
        <TabsContent value="student" className="space-y-4">
          {studentAnalytics && (
            <>
              <div className="grid md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total Learning Hours</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{studentAnalytics.totalHours}h</div>
                    <p className="text-xs text-green-500 mt-1">
                      <TrendingUp className="w-3 h-3 inline mr-1" />
                      +12% from last period
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold flex items-center gap-2">
                      <Flame className="w-6 h-6 text-orange-600" />
                      {studentAnalytics.currentStreak}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">days in a row</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{studentAnalytics.averageScore}%</div>
                    <p className="text-xs text-green-500 mt-1">Above average</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Achievements</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{studentAnalytics.totalAchievements}</div>
                    <p className="text-xs text-gray-500 mt-1">Total earned</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Learning Progress</CardTitle>
                    <CardDescription>Daily learning hours over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 flex items-center justify-center text-gray-400">
                      <LineChart className="w-12 h-12" />
                      <span className="ml-2">Chart visualization</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Skill Development</CardTitle>
                    <CardDescription>Your strongest and improving areas</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <h4 className="font-medium flex items-center gap-2 mb-2">
                        <Star className="w-4 h-4 text-yellow-600" />
                        Strong Areas
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {studentAnalytics.strongAreas.map(area => (
                          <Badge key={area} variant="secondary">{area}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        Areas to Improve
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {studentAnalytics.improvementAreas.map(area => (
                          <Badge key={area} variant="outline">{area}</Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Goal Progress</CardTitle>
                  <CardDescription>Track your learning objectives</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Weekly Goal (5 hours)</span>
                      <span className="text-sm font-medium">{studentAnalytics.weeklyGoalProgress}%</span>
                    </div>
                    <Progress value={studentAnalytics.weeklyGoalProgress} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Monthly Goal (20 hours)</span>
                      <span className="text-sm font-medium">{studentAnalytics.monthlyGoalProgress}%</span>
                    </div>
                    <Progress value={studentAnalytics.monthlyGoalProgress} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Peer Comparison</CardTitle>
                  <CardDescription>How you rank among other students</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-600">
                        {studentAnalytics.peerComparison.percentile}%
                      </div>
                      <p className="text-sm text-gray-600">Top Percentile</p>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold">
                        #{studentAnalytics.peerComparison.rank}
                      </div>
                      <p className="text-sm text-gray-600">Current Rank</p>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold">
                        {studentAnalytics.peerComparison.totalStudents}
                      </div>
                      <p className="text-sm text-gray-600">Total Students</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Instructor Analytics Tab */}
        <TabsContent value="instructor" className="space-y-4">
          {instructorAnalytics && (
            <>
              <div className="grid md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{instructorAnalytics.totalStudents}</div>
                    <p className="text-xs text-green-500 mt-1">
                      <TrendingUp className="w-3 h-3 inline mr-1" />
                      +8% this month
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold flex items-center gap-1">
                      <Star className="w-5 h-5 text-yellow-600" />
                      {instructorAnalytics.averageStudentRating}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Out of 5.0</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Course Completion</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{instructorAnalytics.courseCompletionRate}%</div>
                    <p className="text-xs text-green-500 mt-1">Above platform average</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${instructorAnalytics.totalRevenue.toLocaleString()}</div>
                    <p className="text-xs text-gray-500 mt-1">All time earnings</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Top Performing Courses</CardTitle>
                  <CardDescription>Your best courses by enrollment and revenue</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {instructorAnalytics.topPerformingCourses.map((course, index) => (
                      <div key={course.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            index === 0 ? 'bg-yellow-100 text-yellow-700' :
                            index === 1 ? 'bg-gray-100 text-gray-700' :
                            index === 2 ? 'bg-orange-100 text-orange-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {index < 3 ? (
                              index === 0 ? <Trophy className="w-4 h-4" /> :
                              index === 1 ? <Medal className="w-4 h-4" /> :
                              <Award className="w-4 h-4" />
                            ) : (
                              <span>#{index + 1}</span>
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{course.title}</p>
                            <p className="text-sm text-gray-500">
                              {course.enrollment} students • {course.completion}% completion
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">${course.revenue.toLocaleString()}</p>
                          <div className="flex items-center gap-1 text-yellow-600">
                            <Star className="w-3 h-3" />
                            <span className="text-sm">{course.rating}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Student Feedback</CardTitle>
                    <CardDescription>Sentiment analysis of student reviews</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Positive</span>
                        <Badge variant="default" className="bg-green-600">
                          {instructorAnalytics.studentFeedback.positive}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Neutral</span>
                        <Badge variant="secondary">
                          {instructorAnalytics.studentFeedback.neutral}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Needs Improvement</span>
                        <Badge variant="destructive">
                          {instructorAnalytics.studentFeedback.negative}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Teaching Metrics</CardTitle>
                    <CardDescription>Your engagement and responsiveness</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-blue-600" />
                        <span className="text-sm">Response Time</span>
                      </div>
                      <span className="font-medium">{instructorAnalytics.teachingMetrics.averageResponseTime}h</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-purple-600" />
                        <span className="text-sm">Forum Engagement</span>
                      </div>
                      <span className="font-medium">{instructorAnalytics.teachingMetrics.forumEngagement}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-green-600" />
                        <span className="text-sm">Content Updates</span>
                      </div>
                      <span className="font-medium">{instructorAnalytics.teachingMetrics.contentUpdates}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* Admin Analytics Tab */}
        <TabsContent value="admin" className="space-y-4">
          {adminAnalytics && (
            <>
              <div className="grid md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{adminAnalytics.totalUsers.toLocaleString()}</div>
                    <p className="text-xs text-green-500 mt-1">
                      <TrendingUp className="w-3 h-3 inline mr-1" />
                      +{adminAnalytics.monthlyGrowth}% growth
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{adminAnalytics.activeUsers.toLocaleString()}</div>
                    <p className="text-xs text-gray-500 mt-1">Currently active</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{adminAnalytics.totalCourses}</div>
                    <p className="text-xs text-gray-500 mt-1">Across platform</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Platform Revenue</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${adminAnalytics.totalRevenue.toLocaleString()}</div>
                    <p className="text-xs text-green-500 mt-1">All time total</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>User Demographics</CardTitle>
                    <CardDescription>Distribution by role, region, and age</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium mb-2">By Role</h4>
                        <div className="space-y-2">
                          {Object.entries(adminAnalytics.userDemographics.byRole).map(([role, count]) => (
                            <div key={role} className="flex items-center justify-between">
                              <span className="text-sm capitalize">{role}</span>
                              <Badge variant="outline">{count}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-2">By Region</h4>
                        <div className="space-y-2">
                          {Object.entries(adminAnalytics.userDemographics.byRegion).map(([region, count]) => (
                            <div key={region} className="flex items-center justify-between">
                              <span className="text-sm">{region}</span>
                              <Badge variant="outline">{count}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Platform Health</CardTitle>
                    <CardDescription>System performance metrics</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Uptime</span>
                      <Badge variant="default">{adminAnalytics.platformHealth.uptime}%</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Avg Response Time</span>
                      <span className="text-sm">{adminAnalytics.platformHealth.averageResponseTime}ms</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Error Rate</span>
                      <span className="text-sm">{adminAnalytics.platformHealth.errorRate}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">User Satisfaction</span>
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-600" />
                        <span className="text-sm">{adminAnalytics.platformHealth.userSatisfaction}/5</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>System Usage</CardTitle>
                    <CardDescription>Storage and bandwidth consumption</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">Storage Used</span>
                        <span className="text-sm">{adminAnalytics.systemUsage.usedStorage} GB</span>
                      </div>
                      <Progress value={(adminAnalytics.systemUsage.usedStorage / adminAnalytics.systemUsage.totalStorage) * 100} className="h-2" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">API Calls (Monthly)</span>
                      <span className="text-sm">{adminAnalytics.systemUsage.apiCalls.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Bandwidth Usage</span>
                      <span className="text-sm">{adminAnalytics.systemUsage.bandwidthUsage} TB</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Institutional Metrics</CardTitle>
                    <CardDescription>Organization-level statistics</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-blue-600" />
                        <span className="text-sm">Total Institutions</span>
                      </div>
                      <span className="font-medium">{adminAnalytics.institutionalMetrics.totalInstitutions}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-green-600" />
                        <span className="text-sm">Active Institutions</span>
                      </div>
                      <span className="font-medium">{adminAnalytics.institutionalMetrics.activeInstitutions}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-purple-600" />
                        <span className="text-sm">Avg Size</span>
                      </div>
                      <span className="font-medium">{adminAnalytics.institutionalMetrics.averageInstitutionSize}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-orange-600" />
                        <span className="text-sm">Retention Rate</span>
                      </div>
                      <span className="font-medium">{adminAnalytics.institutionalMetrics.retentionRate}%</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Generate Reports</CardTitle>
                  <CardDescription>Create comprehensive analytics reports</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4">
                    <Button variant="outline" onClick={generateReport} disabled={isGeneratingReport}>
                      {isGeneratingReport ? (
                        <>Generating...</>
                      ) : (
                        <>
                          <FileText className="w-4 h-4 mr-2" />
                          User Report
                        </>
                      )}
                    </Button>
                    <Button variant="outline" onClick={generateReport} disabled={isGeneratingReport}>
                      {isGeneratingReport ? (
                        <>Generating...</>
                      ) : (
                        <>
                          <BarChart3 className="w-4 h-4 mr-2" />
                          Performance Report
                        </>
                      )}
                    </Button>
                    <Button variant="outline" onClick={generateReport} disabled={isGeneratingReport}>
                      {isGeneratingReport ? (
                        <>Generating...</>
                      ) : (
                        <>
                          <TrendingUp className="w-4 h-4 mr-2" />
                          Growth Report
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}