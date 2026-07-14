'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Users, Search, TrendingUp, Clock, Loader2, Award } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Course = Database['public']['Tables']['courses']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']
type Enrollment = Database['public']['Tables']['enrollments']['Row']

type StudentWithProgress = Profile & {
  enrollment: Enrollment
  completed_lessons: number
  total_lessons: number
}

export default function CourseStudentsPage() {
  const router = useRouter()
  const params = useParams()
  const courseId = params.courseId as string

  const [loading, setLoading] = useState(true)
  const [course, setCourse] = useState<Course | null>(null)
  const [students, setStudents] = useState<StudentWithProgress[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  const supabase = createClient()

  useEffect(() => {
    fetchStudentsData()
  }, [courseId])

  const fetchStudentsData = async () => {
    try {
      setLoading(true)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }

      // Fetch course details
      const { data: courseData } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single()

      if (!courseData) {
        alert('Course not found')
        router.push('/teach/dashboard')
        return
      }

      // Check if user is the instructor
      if (courseData.instructor_id !== user.id) {
        alert('Access denied. You can only view students for your own courses.')
        router.push('/teach/dashboard')
        return
      }

      setCourse(courseData)

      // Fetch enrollments with student profiles
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('*, profiles(*)')
        .eq('course_id', courseId)
        .order('enrolled_at', { ascending: false })

      if (enrollments) {
        // Count total lessons in course
        const { data: modules } = await supabase
          .from('modules')
          .select('id')
          .eq('course_id', courseId)

        let totalLessons = 0
        if (modules) {
          for (const module of modules) {
            const { count } = await supabase
              .from('lessons')
              .select('*', { count: 'exact', head: true })
              .eq('module_id', module.id)

            totalLessons += count || 0
          }
        }

        // Get progress data for each student
        const studentsWithProgress = await Promise.all(
          enrollments.map(async (enrollment: any) => {
            const { count } = await supabase
              .from('lesson_progress')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', enrollment.user_id)
              .eq('course_id', courseId)
              .eq('completed', true)

            return {
              ...enrollment.profiles,
              enrollment: enrollment,
              completed_lessons: count || 0,
              total_lessons: totalLessons
            } as StudentWithProgress
          })
        )

        setStudents(studentsWithProgress)
      }

    } catch (error) {
      console.error('Error fetching students data:', error)
      alert('Failed to load students data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const filteredStudents = students.filter(student =>
    student.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getProgressPercentage = (student: StudentWithProgress) => {
    if (student.total_lessons === 0) return 0
    return Math.round((student.completed_lessons / student.total_lessons) * 100)
  }

  const getAverageProgress = () => {
    if (students.length === 0) return 0
    const total = students.reduce((sum, student) => sum + getProgressPercentage(student), 0)
    return Math.round(total / students.length)
  }

  const getCompletedCount = () => {
    return students.filter(student => student.enrollment.status === 'completed').length
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-bhutan-yellow" />
          <span className="ml-3 text-muted-foreground">Loading students...</span>
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
            <h1 className="text-3xl font-bold">Student Management</h1>
            <p className="text-muted-foreground">{course?.title}</p>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="glass hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-bhutan-yellow">{students.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Enrolled students</p>
            </CardContent>
          </Card>

          <Card className="glass hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{getCompletedCount()}</div>
              <p className="text-xs text-muted-foreground mt-1">Finished course</p>
            </CardContent>
          </Card>

          <Card className="glass hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Average Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-bhutan-orange">{getAverageProgress()}%</div>
              <p className="text-xs text-muted-foreground mt-1">Course completion</p>
            </CardContent>
          </Card>

          <Card className="glass hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Active Now</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-bhutan-red">
                {students.filter(s => s.enrollment.status === 'active').length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Currently learning</p>
            </CardContent>
          </Card>
        </div>

        {/* Students List */}
        <Card className="glass-strong">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Students</CardTitle>
                <CardDescription>View individual student progress and performance</CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredStudents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {searchTerm ? 'No students found matching your search.' : 'No students enrolled yet.'}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredStudents.map((student) => {
                  const progressPercentage = getProgressPercentage(student)
                  const enrolledDate = new Date(student.enrollment.enrolled_at).toLocaleDateString()

                  return (
                    <div
                      key={student.id}
                      className="p-4 border rounded-lg hover:border-bhutan-yellow/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-bhutan-yellow/20 to-bhutan-orange/20 flex items-center justify-center">
                            {student.avatar_url ? (
                              <img
                                src={student.avatar_url}
                                alt={student.full_name || 'Student'}
                                className="w-full h-full object-cover rounded-full"
                              />
                            ) : (
                              <Users className="w-6 h-6 text-bhutan-yellow" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold">{student.full_name || 'Anonymous'}</h3>
                            {student.email && (
                              <p className="text-sm text-muted-foreground">{student.email}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                <Clock className="w-3 h-3 mr-1" />
                                Enrolled {enrolledDate}
                              </Badge>
                              <Badge
                                variant={student.enrollment.status === 'completed' ? 'default' : 'secondary'}
                                className="text-xs capitalize"
                              >
                                {student.enrollment.status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-bhutan-yellow">
                            {progressPercentage}%
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {student.completed_lessons}/{student.total_lessons} lessons
                          </p>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-2">
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-bhutan-yellow to-bhutan-orange h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progressPercentage}%` }}
                          />
                        </div>

                        {/* Additional Stats */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              Last active: {student.enrollment.last_accessed_at
                                ? new Date(student.enrollment.last_accessed_at).toLocaleDateString()
                                : 'Never'}
                            </span>
                            {student.enrollment.completed_at && (
                              <span className="flex items-center gap-1">
                                <Award className="w-3 h-3" />
                                Completed: {new Date(student.enrollment.completed_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7"
                            onClick={() => router.push(`/teach/courses/${courseId}/students/${student.id}`)}
                          >
                            View Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}