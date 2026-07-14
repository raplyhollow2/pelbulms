'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, BookOpen, Users, TrendingUp, FileQuestion, Loader2, Edit, Trash2, Play, BarChart3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Course = Database['public']['Tables']['courses']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']
type Enrollment = Database['public']['Tables']['enrollments']['Row']

export default function TeacherDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [totalEnrollments, setTotalEnrollments] = useState(0)
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

      if (profileData?.role !== 'instructor' && profileData?.role !== 'admin') {
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

        // Get total enrollments across all courses
        const courseIds = coursesData.map(c => c.id)
        if (courseIds.length > 0) {
          const { count } = await supabase
            .from('enrollments')
            .select('*', { count: 'exact', head: true })
            .in('course_id', courseIds)

          setTotalEnrollments(count || 0)
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
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-8">
        {/* Welcome Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Teacher Dashboard</h1>
            <p className="text-xl text-muted-foreground">
              Welcome back, {profile?.full_name || user?.user_metadata?.full_name || 'Instructor'}!
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => router.push('/teach/analytics')}
            >
              <BarChart3 className="w-5 h-5 mr-2" />
              Analytics
            </Button>
            <Button
              onClick={handleCreateCourse}
              className="bg-bhutan-yellow hover:bg-bhutan-orange"
              size="lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create New Course
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="glass hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-sm font-medium">My Courses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-bhutan-yellow">{courses.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Active courses</p>
            </CardContent>
          </Card>

          <Card className="glass hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-bhutan-orange">{totalEnrollments}</div>
              <p className="text-xs text-muted-foreground mt-1">Across all courses</p>
            </CardContent>
          </Card>

          <Card className="glass hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Avg Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-bhutan-red">--%</div>
              <p className="text-xs text-muted-foreground mt-1">Course completion</p>
            </CardContent>
          </Card>

          <Card className="glass hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Active Quizzes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">--</div>
              <p className="text-xs text-muted-foreground mt-1">Published quizzes</p>
            </CardContent>
          </Card>
        </div>

        {/* My Courses */}
        {courses.length > 0 ? (
          <Card className="glass-strong">
            <CardHeader>
              <CardTitle>My Courses</CardTitle>
              <CardDescription>Manage your course content and students</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-background/50 hover:bg-background transition-colors border border-border/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-12 rounded bg-gradient-to-br from-bhutan-yellow/20 to-bhutan-orange/20 flex items-center justify-center">
                      {course.thumbnail_url ? (
                        <img
                          src={course.thumbnail_url}
                          alt={course.title}
                          className="w-full h-full object-cover rounded"
                        />
                      ) : (
                        <BookOpen className="w-6 h-6 text-bhutan-yellow" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold">{course.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{course.category}</Badge>
                        <Badge variant="secondary" className="text-xs">
                          {course.is_published ? 'Published' : 'Draft'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewStudents(course.id)}
                    >
                      <Users className="w-4 h-4 mr-1" />
                      Students
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleEditCourse(course.id)}
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
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No courses yet</h3>
              <p className="text-muted-foreground text-center mb-4">
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
    </div>
  )
}