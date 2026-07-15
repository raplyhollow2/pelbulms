'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Plus, BookOpen, Users, TrendingUp, FileQuestion, Loader2, Edit, Trash2, Play, BarChart3, Menu, Home, GraduationCap, Settings, User, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'
import { haptic } from '@/lib/utils'

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const supabase = createClient()

  const menuItems = [
    { icon: Home, label: 'Dashboard', href: '/dashboard' },
    { icon: GraduationCap, label: 'My Courses', href: '/teach/dashboard' },
    { icon: BookOpen, label: 'All Courses', href: '/courses' },
    { icon: BarChart3, label: 'Analytics', href: '/teach/analytics' },
    { icon: Users, label: 'Students', href: '/teach/students' },
    { icon: User, label: 'Profile', href: '/dashboard' },
    { icon: Settings, label: 'Settings', href: '/dashboard' },
  ]

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

        // Get total enrollments across all courses
        const courseIds = coursesData.map((m: any) => m.id)
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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const navigateTo = (href: string) => {
    setMobileMenuOpen(false)
    router.push(href)
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
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="lg:hidden sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="touch-feedback">
                  <Menu className="w-6 h-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80">
                <div className="flex flex-col space-y-4 mt-8">
                  <div className="px-4 py-2 border-b">
                    <h2 className="text-lg font-semibold">Teacher Menu</h2>
                    <p className="text-sm text-muted-foreground">{profile?.full_name || 'Instructor'}</p>
                  </div>
                  <nav className="space-y-2 px-2">
                    {menuItems.map((item) => (
                      <Button
                        key={item.href}
                        variant="ghost"
                        className="w-full justify-start touch-feedback"
                        onClick={() => navigateTo(item.href)}
                      >
                        <item.icon className="w-5 h-5 mr-3" />
                        {item.label}
                      </Button>
                    ))}
                    <Button
                      variant="ghost"
                      className="w-full justify-start touch-feedback text-red-600 hover:text-red-700"
                      onClick={handleLogout}
                    >
                      <LogOut className="w-5 h-5 mr-3" />
                      Logout
                    </Button>
                  </nav>
                </div>
              </SheetContent>
            </Sheet>
            <div>
              <h1 className="text-lg font-semibold">Teacher Dashboard</h1>
              <p className="text-xs text-muted-foreground">Welcome back!</p>
            </div>
          </div>
          <Button
            onClick={handleCreateCourse}
            size="sm"
            className="bg-bhutan-yellow hover:bg-bhutan-orange touch-feedback"
          >
            <Plus className="w-4 h-4 mr-1" />
            Create
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 lg:py-8 space-y-6 lg:space-y-8">
          {/* Desktop Header */}
          <div className="hidden lg:block">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold mb-2">Teacher Dashboard</h1>
                <p className="text-lg lg:text-xl text-muted-foreground">
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
          </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <Card className="glass hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium">My Courses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl lg:text-3xl font-bold text-bhutan-yellow">{courses.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Active courses</p>
            </CardContent>
          </Card>

          <Card className="glass hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium">Total Students</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl lg:text-3xl font-bold text-bhutan-orange">{totalEnrollments}</div>
              <p className="text-xs text-muted-foreground mt-1">Across all courses</p>
            </CardContent>
          </Card>

          <Card className="glass hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium">Avg Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl lg:text-3xl font-bold text-bhutan-red">--%</div>
              <p className="text-xs text-muted-foreground mt-1">Course completion</p>
            </CardContent>
          </Card>

          <Card className="glass hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium">Active Quizzes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl lg:text-3xl font-bold text-green-600">--</div>
              <p className="text-xs text-muted-foreground mt-1">Published quizzes</p>
            </CardContent>
          </Card>
        </div>

        {/* My Courses */}
        {courses.length > 0 ? (
          <Card className="glass-strong">
            <CardHeader>
              <CardTitle className="text-xl lg:text-2xl">My Courses</CardTitle>
              <CardDescription>Manage your course content and students</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 lg:space-y-4">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 lg:p-4 rounded-lg bg-background/50 hover:bg-background transition-colors border border-border/50 gap-3"
                >
                  <div className="flex items-center gap-3 lg:gap-4 w-full sm:w-auto">
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
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{course.category}</Badge>
                        <Badge variant="secondary" className="text-xs">
                          {(course as any).is_published ? 'Published' : 'Draft'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewStudents(course.id)}
                      className="flex-1 sm:flex-initial touch-feedback"
                    >
                      <Users className="w-4 h-4 mr-1" />
                      <span className="hidden sm:inline">Students</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleEditCourse(course.id)}
                      className="flex-1 sm:flex-initial touch-feedback"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      <span className="hidden sm:inline">Edit</span>
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
              <p className="text-muted-foreground text-center mb-4 px-4">
                Create your first course to start teaching on Pelbu LMS
              </p>
              <Button
                onClick={handleCreateCourse}
                className="bg-bhutan-yellow hover:bg-bhutan-orange touch-feedback"
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