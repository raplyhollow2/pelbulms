'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, BookOpen, Users, Loader2, Edit, BarChart3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Course = Database['public']['Tables']['courses']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']

export default function TeacherDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [totalEnrollments, setTotalEnrollments] = useState(0)
  const [avgProgress, setAvgProgress] = useState<number | null>(null)
  const [activeQuizzes, setActiveQuizzes] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    fetchTeacherData()
  }, [])

  const fetchTeacherData = async () => {
    try {
      setLoading(true)

      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        router.push('/auth/login')
        return
      }

      setUser(authUser)

      // Get user profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (!profileData || ((profileData as any).role !== 'instructor' && (profileData as any).role !== 'admin')) {
        alert('Access denied. Teacher dashboard is for instructors only.')
        router.push('/dashboard')
        return
      }

      setProfile(profileData)

      // Fetch instructor's courses
      const { data: coursesData } = await supabase
        .from('courses')
        .select('*')
        .eq('instructor_id', authUser.id)
        .order('created_at', { ascending: false })

      if (coursesData) {
        setCourses(coursesData)

        // Get enrollments across all courses (count + average progress)
        const courseIds = coursesData.map((m: any) => m.id)
        if (courseIds.length > 0) {
          const { data: enrollRows, count } = await supabase
            .from('enrollments')
            .select('progress_percentage', { count: 'exact' })
            .in('course_id', courseIds)

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

          // Count published quizzes across the instructor's lessons
          const { data: mods } = await supabase
            .from('modules')
            .select('id')
            .in('course_id', courseIds)
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
      }

    } catch (error) {
      console.error('Error fetching teacher data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCourse = () => {
    router.push('/teach/courses/new')
  }

  const handleEditCourse = (courseId: string) => {
    router.push(`/teach/courses/${courseId}/edit`)
  }

  const handleViewStudents = (courseId: string) => {
    router.push(`/teach/courses/${courseId}/students`)
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
    <div className="container mx-auto px-4 py-6 lg:py-8 space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-1 sm:mb-2">
            Teacher Dashboard
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
            onClick={() => router.push('/teach/analytics')}
          >
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2" />
            <span className="ml-1 sm:ml-0">Analytics</span>
          </Button>
          <Button
            onClick={handleCreateCourse}
            className="flex-1 sm:flex-initial bg-bhutan-yellow hover:bg-bhutan-orange"
            size="sm"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2" />
            <span className="ml-1 sm:ml-0">Create Course</span>
          </Button>
        </div>
      </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          <Card className="glass hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs lg:text-sm font-medium">My Courses</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-2xl lg:text-3xl font-bold text-bhutan-yellow">{courses.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Active courses</p>
            </CardContent>
          </Card>

          <Card className="glass hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs lg:text-sm font-medium">Total Students</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-2xl lg:text-3xl font-bold text-bhutan-orange">{totalEnrollments}</div>
              <p className="text-xs text-muted-foreground mt-1">Across all courses</p>
            </CardContent>
          </Card>

          <Card className="glass hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs lg:text-sm font-medium">Avg Progress</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-2xl lg:text-3xl font-bold text-bhutan-red">
                {avgProgress === null ? '--' : `${avgProgress}%`}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Course completion</p>
            </CardContent>
          </Card>

          <Card className="glass hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs lg:text-sm font-medium">Active Quizzes</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-2xl lg:text-3xl font-bold text-green-600">
                {activeQuizzes === null ? '--' : activeQuizzes}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Published quizzes</p>
            </CardContent>
          </Card>
        </div>

        {/* My Courses */}
        {courses.length > 0 ? (
          <Card className="glass-strong">
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="text-xl lg:text-2xl">My Courses</CardTitle>
              <CardDescription>Manage your course content and students</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 lg:space-y-4 px-4 sm:px-6">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 lg:p-4 rounded-lg bg-background/50 hover:bg-background transition-colors border border-border/50 gap-3"
                >
                  <div className="flex items-center gap-3 lg:gap-4 w-full sm:w-auto min-w-0">
                    <div className="w-12 h-12 lg:w-16 lg:h-12 rounded bg-gradient-to-br from-bhutan-yellow/20 to-bhutan-orange/20 flex items-center justify-center flex-shrink-0">
                      {course.thumbnail_url ? (
                        <img
                          src={course.thumbnail_url}
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
                        <Badge variant="outline" className="text-xs">{course.category}</Badge>
                        <Badge variant="secondary" className="text-xs">
                          {(course as any).is_published ? 'Published' : 'Draft'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewStudents(course.id)}
                      className="flex-1 sm:flex-initial"
                    >
                      <Users className="w-4 h-4 mr-1" />
                      Students
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleEditCourse(course.id)}
                      className="flex-1 sm:flex-initial"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-strong">
            <CardContent className="flex flex-col items-center justify-center py-12 px-4">
              <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No courses yet</h3>
              <p className="text-muted-foreground text-center mb-4 px-4 text-sm">
                Create your first course to start teaching on Pelbu LMS
              </p>
              <Button
                onClick={handleCreateCourse}
                className="bg-bhutan-yellow hover:bg-bhutan-orange"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Course
              </Button>
            </CardContent>
          </Card>
        )}
    </div>
  )
}