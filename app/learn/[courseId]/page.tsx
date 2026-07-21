'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Clock, Users, Star, ArrowLeft, Loader2, CheckCircle, PlayCircle, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Course = Database['public']['Tables']['courses']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']
type Module = Database['public']['Tables']['modules']['Row']
type Lesson = Database['public']['Tables']['lessons']['Row']
type Enrollment = Database['public']['Tables']['enrollments']['Row']

export default function LearningPage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.courseId as string

  const [course, setCourse] = useState<Course | null>(null)
  const [instructor, setInstructor] = useState<Profile | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [lessons, setLessons] = useState<Record<string, Lesson[]>>({})
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set())

  const supabase = createClient()

  useEffect(() => {
    fetchCourseData()
  }, [courseId])

  const fetchCourseData = async () => {
    try {
      setLoading(true)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)

      if (!user) {
        router.push('/auth/login')
        return
      }

      // Fetch course with instructor details
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select(`
          *,
          profiles:instructor_id (
            id,
            full_name,
            avatar_url,
            bio
          )
        `)
        .eq('id', courseId)
        .single()

      if (courseError) throw courseError
      if (!courseData) {
        router.push('/courses')
        return
      }

      setCourse(courseData)
      setInstructor((courseData as any).profiles)

      // Check enrollment — only active/completed can access learning
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from('enrollments')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .maybeSingle()

      if (enrollmentError) {
        console.log('Enrollment check error:', enrollmentError)
      }

      const status = (enrollmentData as any)?.status
      if (!enrollmentData || (status !== 'active' && status !== 'completed')) {
        if (status === 'pending') {
          alert('Your enrollment is waiting for the course creator to approve.')
        } else {
          alert('You need to enroll in this course first.')
        }
        router.push(`/courses/${courseId}`)
        return
      }

      setEnrollment(enrollmentData)

      // Fetch modules for this course
      const { data: modulesData, error: modulesError } = await supabase
        .from('modules')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index', { ascending: true })

      console.log('Modules fetched:', { modulesData, modulesError, courseId })

      setModules(modulesData || [])

      // Fetch all lessons for all modules
      if (modulesData && modulesData.length > 0) {
        const moduleIds = (modulesData as any).map((m: any) => m.id)
        const { data: lessonsData } = await supabase
          .from('lessons')
          .select('*')
          .in('module_id', moduleIds)
          .eq('is_published', true)
          .order('order_index', { ascending: true })

        // Group lessons by module
        const lessonsByModule: Record<string, Lesson[]> = {}
        if (lessonsData) {
          (lessonsData as any).forEach((lesson: any) => {
            if (!lessonsByModule[lesson.module_id]) {
              lessonsByModule[lesson.module_id] = []
            }
            lessonsByModule[lesson.module_id].push(lesson)
          })
        }
        setLessons(lessonsByModule)
      }

      // Fetch completed lessons for this user + course (for checkmarks)
      try {
        const { data: courseProgress } = await supabase
          .from('lesson_progress')
          .select('lesson_id, completed')
          .eq('user_id', user.id)
          .eq('course_id', courseId)

        if (courseProgress) {
          setCompletedLessonIds(
            new Set(
              (courseProgress as any[])
                .filter((r) => r.completed)
                .map((r) => r.lesson_id as string)
            )
          )
        }
      } catch (e) {
        console.log('Course progress fetch error (continuing):', e)
      }
    } catch (error) {
      console.error('Error fetching course data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-bhutan-yellow" />
          <span className="ml-3 text-muted-foreground">Loading your course...</span>
        </div>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Course not found</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push('/courses')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Courses
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Course Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push('/dashboard')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>

          <div className="glass p-6 rounded-lg">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <h1 className="text-3xl font-bold mb-2">{course.title}</h1>
                <p className="text-muted-foreground">{course.description}</p>
              </div>
            </div>

            {/* Progress Bar */}
            {enrollment && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Your Progress</span>
                  <span className="text-sm font-bold text-bhutan-yellow">
                    {enrollment.progress_percentage || 0}%
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-bhutan-yellow h-2 rounded-full transition-all duration-300"
                    style={{ width: `${enrollment.progress_percentage || 0}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Course Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-2xl font-bold mb-4">Course Content</h2>

            {modules.length === 0 ? (
              <Card className="glass">
                <CardContent className="p-8 text-center">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No content available yet. Check back soon!</p>
                </CardContent>
              </Card>
            ) : (
              modules.map((module, moduleIndex) => {
                const moduleLessons = lessons[module.id] || []
                const moduleCompletedCount = moduleLessons.filter((l) =>
                  completedLessonIds.has(l.id)
                ).length

                return (
                  <Card key={module.id} className="glass overflow-hidden">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <span className="w-8 h-8 rounded-full bg-bhutan-yellow/20 flex items-center justify-center">
                              <span className="text-sm font-bold text-bhutan-yellow">{moduleIndex + 1}</span>
                            </span>
                            {module.title}
                          </CardTitle>
                          {module.description && (
                            <CardDescription className="mt-2">{module.description}</CardDescription>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {moduleCompletedCount}/{moduleLessons.length} lessons
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {moduleLessons.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4 text-center">
                            No lessons available yet
                          </p>
                        ) : (
                          moduleLessons.map((lesson, lessonIndex) => (
                            <div
                              key={lesson.id}
                              className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:border-bhutan-yellow/50 transition-colors cursor-pointer group"
                              onClick={() => router.push(`/learn/${courseId}/lesson/${lesson.id}`)}
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                                  {completedLessonIds.has(lesson.id) ? (
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                  ) : (
                                    <PlayCircle className="w-4 h-4 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-medium text-sm group-hover:text-bhutan-yellow transition-colors">
                                    {lesson.title}
                                  </h4>
                                  {lesson.duration_minutes && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      <Clock className="w-3 h-3 inline mr-1" />
                                      {Math.floor(lesson.duration_minutes / 60)} minutes
                                    </p>
                                  )}
                                </div>
                                {lesson.is_free && (
                                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                                    Free Preview
                                  </Badge>
                                )}
                              </div>
                              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-bhutan-yellow transition-colors" />
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Instructor Card */}
            {instructor && (
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="text-lg">Your Instructor</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center text-center gap-3">
                    {instructor.avatar_url && (
                      <img
                        src={instructor.avatar_url}
                        alt={instructor.full_name || 'Instructor'}
                        className="w-20 h-20 rounded-full object-cover"
                      />
                    )}
                    <div>
                      <h3 className="font-semibold">{instructor.full_name}</h3>
                      {instructor.bio && (
                        <p className="text-xs text-muted-foreground mt-1">{instructor.bio}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Course Stats */}
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-lg">Course Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-medium">
                    {course.duration_minutes
                      ? `${Math.floor(course.duration_minutes / 60)}h ${course.duration_minutes % 60}m`
                      : 'Self-paced'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Modules</span>
                  <span className="font-medium">{modules.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Level</span>
                  <Badge variant="secondary" className="text-xs capitalize">
                    {course.level}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Learning Objectives */}
            {course.learning_objectives && course.learning_objectives.length > 0 && (
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="text-lg">What You'll Learn</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {course.learning_objectives.slice(0, 5).map((objective, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span>{objective}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}