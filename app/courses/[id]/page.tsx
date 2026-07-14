'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Clock, Users, Star, ArrowLeft, Loader2, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Course = Database['public']['Tables']['courses']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']

export default function CourseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.id as string

  const [course, setCourse] = useState<Course | null>(null)
  const [instructor, setInstructor] = useState<Profile | null>(null)
  const [modules, setModules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isEnrolled, setIsEnrolled] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchCourseDetails()
  }, [courseId])

  const fetchCourseDetails = async () => {
    try {
      setLoading(true)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)

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

      setCourse(courseData as any)
      setInstructor((courseData as any).profiles)

      // Fetch modules for this course
      const { data: modulesData } = await supabase
        .from('modules')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index', { ascending: true })

      setModules(modulesData || [])

      // Check if user is enrolled
      if (user) {
        const { data: enrollmentData } = await supabase
          .from('enrollments')
          .select('*')
          .eq('user_id', user.id)
          .eq('course_id', courseId)
          .single()

        setIsEnrolled(!!enrollmentData)
      }
    } catch (error) {
      console.error('Error fetching course details:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEnroll = async () => {
    if (!currentUser) {
      router.push('/auth/login')
      return
    }

    try {
      const { error } = await (supabase as any)
        .from('enrollments')
        .insert({
          user_id: currentUser.id,
          course_id: courseId,
          status: 'active' as const,
          progress_percentage: 0
        } as any)

      if (error) {
        if (error.code === '23505') {
          alert('You are already enrolled in this course!')
        } else {
          throw error
        }
      } else {
        alert('Successfully enrolled! Redirecting to your course...')
        setIsEnrolled(true)
        setTimeout(() => {
          router.push(`/learn/${courseId}`)
        }, 1000)
      }
    } catch (error) {
      console.error('Enrollment error:', error)
      alert('Failed to enroll. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-bhutan-yellow" />
          <span className="ml-3 text-muted-foreground">Loading course details...</span>
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
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => router.push('/courses')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Courses
        </Button>

        {/* Course Header */}
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="text-xs">{course.category}</Badge>
                <Badge variant="secondary" className="text-xs capitalize">{course.level}</Badge>
                {course.is_featured && (
                  <Badge className="text-xs bg-bhutan-yellow text-bhutan-black">⭐ Featured</Badge>
                )}
              </div>
              <h1 className="text-4xl font-bold mb-2">{course.title}</h1>
              <p className="text-lg text-muted-foreground">{course.description}</p>
            </div>
          </div>

          {/* Course Stats */}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span>{course.duration_minutes ? `${Math.floor(course.duration_minutes / 60)}h ${course.duration_minutes % 60}m` : 'Self-paced'}</span>
            </div>
            {course.tags && course.tags.length > 0 && (
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-muted-foreground" />
                <div className="flex gap-1">
                  {course.tags.slice(0, 3).map((tag: any) => (
                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Instructor */}
        {instructor && (
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg">Your Instructor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                {instructor.avatar_url && (
                  <img
                    src={instructor.avatar_url}
                    alt={instructor.full_name || 'Instructor'}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                )}
                <div>
                  <h3 className="font-semibold text-lg">{instructor.full_name}</h3>
                  {instructor.bio && (
                    <p className="text-sm text-muted-foreground mt-1">{instructor.bio}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Learning Objectives */}
        {course.learning_objectives && course.learning_objectives.length > 0 && (
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg">What You'll Learn</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {course.learning_objectives.map((objective, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{objective}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Course Modules */}
        {modules.length > 0 && (
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg">Course Content</CardTitle>
              <CardDescription>{modules.length} modules • {course.duration_minutes ? `${Math.floor(course.duration_minutes / 60)} hours` : 'Self-paced'} content</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {modules.map((module, index) => (
                  <div
                    key={module.id}
                    className="p-4 rounded-lg border border-border/50 hover:border-bhutan-yellow/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-bhutan-yellow/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-bhutan-yellow">{index + 1}</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold">{module.title}</h4>
                        {module.description && (
                          <p className="text-sm text-muted-foreground mt-1">{module.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Requirements */}
        {course.requirements && course.requirements.length > 0 && (
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg">Requirements</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {course.requirements.map((requirement, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-bhutan-yellow mt-1.5 flex-shrink-0" />
                    <span>{requirement}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Action Button */}
        <div className="flex justify-center">
          {isEnrolled ? (
            <Button
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => router.push(`/learn/${courseId}`)}
            >
              <BookOpen className="w-5 h-5 mr-2" />
              Continue Learning
            </Button>
          ) : (
            <Button
              size="lg"
              className="bg-bhutan-yellow hover:bg-bhutan-orange"
              onClick={handleEnroll}
            >
              <BookOpen className="w-5 h-5 mr-2" />
              Enroll Now
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}