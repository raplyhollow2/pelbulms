'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, BookOpen, Clock, Users, Star, Filter, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Course = Database['public']['Tables']['courses']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']

type CourseWithInstructor = Course & { profiles?: Profile | null }

export default function CoursesPage() {
  const router = useRouter()
  const [courses, setCourses] = useState<CourseWithInstructor[]>([])
  const [filteredCourses, setFilteredCourses] = useState<CourseWithInstructor[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedLevel, setSelectedLevel] = useState('All')

  const supabase = createClient()

  // Fetch current user and courses
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        setCurrentUser(profile)
      }

      // Fetch published courses with instructor info
      const { data: coursesData, error } = await supabase
        .from('courses')
        .select(`
          *,
          profiles:instructor_id (
            full_name,
            avatar_url,
            bio
          )
        `)
        .eq('is_published', true)
        .order('created_at', { ascending: false })

      if (error) throw error

      setCourses((coursesData || []) as CourseWithInstructor[])
      setFilteredCourses((coursesData || []) as CourseWithInstructor[])

      // Fetch user's enrollments
      if (user) {
        const { data: enrollmentsData } = await supabase
          .from('enrollments')
          .select('course_id')
          .eq('user_id', user.id)

        if (enrollmentsData) {
          const enrolledIds = new Set(enrollmentsData.map((e: any) => e.course_id))
          setEnrolledCourseIds(enrolledIds)
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter courses based on search and filters
  useEffect(() => {
    let filtered = courses

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(course =>
        course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (course.description && course.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (course.tags && course.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
      )
    }

    // Filter by category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter((course: any) => course.category === selectedCategory)
    }

    // Filter by level
    if (selectedLevel !== 'All') {
      filtered = filtered.filter((course: any) => course.level === selectedLevel)
    }

    setFilteredCourses(filtered)
  }, [searchTerm, selectedCategory, selectedLevel, courses])

  const handleEnroll = async (courseId: string) => {
    if (!currentUser) {
      // Redirect to login if not authenticated
      window.location.href = '/auth/login'
      return
    }

    // Check if already enrolled
    if (enrolledCourseIds.has(courseId)) {
      // Go to learning page if already enrolled
      window.location.href = `/learn/${courseId}`
      return
    }

    try {
      const supabaseInsert = supabase as any
      const { error: enrollmentError } = await supabaseInsert
        .from('enrollments')
        .insert({
          user_id: currentUser.id,
          course_id: courseId,
          status: 'active' as const,
          progress_percentage: 0
        } as any)

      if (enrollmentError) {
        // Check if already enrolled
        if (enrollmentError.code === '23505') {
          alert('You are already enrolled in this course!')
          // Add to enrolled set
          setEnrolledCourseIds(prev => new Set(prev).add(courseId))
        } else {
          throw enrollmentError
        }
      } else {
        alert('Successfully enrolled! Redirecting to your course...')
        // Add to enrolled set
        setEnrolledCourseIds(prev => new Set(prev).add(courseId))
        setTimeout(() => {
          window.location.href = `/learn/${courseId}`
        }, 1000)
      }
    } catch (error) {
      console.error('Enrollment error:', error)
      alert('Failed to enroll. Please try again.')
    }
  }

  // Get unique categories and levels from courses
  const categories = ['All', ...Array.from(new Set(courses.map((c: any) => c.category)))]
  const levels = ['All', ...Array.from(new Set(courses.map((c: any) => c.level)))]

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-bhutan-yellow" />
          <span className="ml-3 text-muted-foreground">Loading courses...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold mb-2">Course Catalog</h1>
          <p className="text-xl text-muted-foreground">
            Discover and enroll in courses from our diverse catalog
          </p>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input
              type="text"
              placeholder="Search courses by title, description, or tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12 glass-strong"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Category:</span>
            </div>
            {categories.map((category: any) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className={selectedCategory === category ? "bg-bhutan-yellow hover:bg-bhutan-orange" : ""}
              >
                {category}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Level:</span>
            </div>
            {levels.map((level: any) => (
              <Button
                key={level}
                variant={selectedLevel === level ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedLevel(level)}
                className={selectedLevel === level ? "bg-bhutan-yellow hover:bg-bhutan-orange" : ""}
              >
                {level}
              </Button>
            ))}
          </div>
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {filteredCourses.length} of {courses.length} courses
          </p>
        </div>

        {/* Course Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredCourses.map((course) => {
            const instructor = (course as any).profiles
            return (
              <Card key={course.id} className="glass hover:shadow-xl transition-all duration-300 overflow-hidden group cursor-pointer flex flex-col" onClick={() => router.push(`/courses/${course.id}`)}>
                {/* Course Thumbnail */}
                <div className="h-40 sm:h-48 bg-gradient-to-br from-bhutan-yellow/20 to-bhutan-orange/20 flex items-center justify-center flex-shrink-0">
                  {course.thumbnail_url ? (
                    <img
                      src={course.thumbnail_url}
                      alt={course.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <BookOpen className="w-12 h-12 text-bhutan-yellow" />
                  )}
                </div>

                <CardHeader className="pb-3 flex-shrink-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">
                      {course.category}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {course.level}
                    </Badge>
                  </div>
                  <CardTitle className="text-base sm:text-lg line-clamp-2 group-hover:text-bhutan-yellow transition-colors">
                    {course.title}
                  </CardTitle>
                  <CardDescription className="line-clamp-2 text-sm">
                    {course.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3 sm:space-y-4 flex-1 flex flex-col">
                  {/* Course Stats */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span className="text-xs sm:text-sm">{course.duration_minutes ? `${Math.floor(course.duration_minutes / 60)}h ${course.duration_minutes % 60}m` : 'Self-paced'}</span>
                    </div>
                    {course.price === 0 ? (
                      <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">Free</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs bg-bhutan-yellow text-bhutan-black">Premium</Badge>
                    )}
                  </div>

                  {/* Instructor */}
                  <div className="text-sm">
                    <span className="text-muted-foreground">Instructor:</span>{' '}
                    <span className="font-medium text-xs sm:text-sm">{instructor?.full_name || 'TBD'}</span>
                  </div>

                  {/* Tags */}
                  {course.tags && course.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {course.tags.slice(0, 3).map((tag: any) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Spacer to push button to bottom */}
                  <div className="flex-1" />

                  {/* Action Button */}
                  <Button
                    className="w-full bg-bhutan-yellow hover:bg-bhutan-orange transition-colors"
                    onClick={(e) => {
                      e.stopPropagation() // Prevent card click
                      handleEnroll(course.id)
                    }}
                    disabled={enrolledCourseIds.has(course.id)}
                  >
                    <BookOpen className="w-4 h-4 mr-2" />
                    {enrolledCourseIds.has(course.id) ? 'Continue' : 'Enroll Now'}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Empty State */}
        {filteredCourses.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No courses found</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search or filters to find what you're looking for.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('')
                setSelectedCategory('All')
                setSelectedLevel('All')
              }}
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}