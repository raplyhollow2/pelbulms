'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, BookOpen, Clock, Users, Star, Filter, Loader2, Command } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { CourseCard } from '@/components/courses/course-card'
import { CourseGridSkeleton } from '@/components/courses/course-card-skeleton'
import { Skeleton } from '@/components/ui/skeleton'
import { InstructorShowcase } from '@/components/courses/instructor-showcase'
import { AdvancedSearchModal } from '@/components/courses/advanced-search-modal'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Course = Database['public']['Tables']['courses']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']
type Module = Database['public']['Tables']['modules']['Row']
type Enrollment = Database['public']['Tables']['enrollments']['Row']

type CourseWithInstructor = Course & { profiles?: Profile | null, modules?: Module[] }

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
  const [instructors, setInstructors] = useState<any[]>([])

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

        // Fetch instructors with their stats
        const { data: instructorsData } = await supabase
          .from('profiles')
          .select('*')
          .in('role', ['instructor', 'admin'])
          .limit(10)

        if (instructorsData) {
          // Enhance instructor data with course counts
          const instructorsWithStats = await Promise.all(
            instructorsData.map(async (instructor: any) => {
              const { count: coursesCount } = await supabase
                .from('courses')
                .select('*', { count: 'exact', head: true })
                .eq('instructor_id', instructor.id)
                .eq('is_published', true)

              return {
                ...instructor,
                courses_count: coursesCount || 0,
                students_count: Math.floor(Math.random() * 10000), // Mock data for now
                rating: (4 + Math.random()).toFixed(1), // Mock data for now
                expertise: ['Web Development', 'React', 'TypeScript'], // Mock data for now
              }
            })
          )

          setInstructors(instructorsWithStats)
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
        <div className="space-y-8">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-10 w-48 mb-2" />
              <Skeleton className="h-6 w-96" />
            </div>
            <Skeleton className="h-12 w-40" />
          </div>

          {/* Search and Filters Skeleton */}
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <div className="flex gap-3">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-32" />
            </div>
          </div>

          {/* Course Grid Skeleton */}
          <CourseGridSkeleton count={6} />
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
            <Button
              variant="ghost"
              size="lg"
              className="touch-feedback"
              onClick={() => router.push('/dashboard')}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                  clipRule="evenodd"
                />
              </svg>
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-4xl font-bold mb-2">Course Catalog</h1>
              <p className="text-xl text-muted-foreground">
                Discover and enroll in courses from our diverse catalog
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="lg"
              className="glass touch-feedback"
              onClick={() => {
                // Trigger command palette via keyboard event
                const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true })
                document.dispatchEvent(event)
              }}
            >
              <Command className="w-5 h-5 mr-2" />
              Search (⌘K)
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4">
          {/* Search Bar with Mobile Filters */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                type="text"
                placeholder="Search courses by title, description, or tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12 glass-strong"
              />
            </div>

            {/* Advanced Search Button */}
            <AdvancedSearchModal
              availableCategories={categories.filter((c: any) => c !== 'All')}
              availableLevels={levels.filter((l: any) => l !== 'All')}
              onSearch={(advancedFilters) => {
                // Update all filters based on advanced search
                setSearchTerm(advancedFilters.searchTerm)
                setSelectedCategory(advancedFilters.categories[0] || 'All')
                setSelectedLevel(advancedFilters.levels[0] || 'All')

                // Apply advanced filtering to courses
                let filtered = courses

                // Search term
                if (advancedFilters.searchTerm) {
                  filtered = filtered.filter(course =>
                    course.title.toLowerCase().includes(advancedFilters.searchTerm.toLowerCase()) ||
                    (course.description && course.description.toLowerCase().includes(advancedFilters.searchTerm.toLowerCase())) ||
                    (course.tags && course.tags.some((tag: string) => tag.toLowerCase().includes(advancedFilters.searchTerm.toLowerCase())))
                  )
                }

                // Categories
                if (advancedFilters.categories.length > 0) {
                  filtered = filtered.filter((course: any) =>
                    advancedFilters.categories.includes(course.category)
                  )
                }

                // Levels
                if (advancedFilters.levels.length > 0) {
                  filtered = filtered.filter((course: any) =>
                    advancedFilters.levels.includes(course.level)
                  )
                }

                // Price range
                filtered = filtered.filter((course: any) => {
                  const price = course.price || 0
                  return price >= advancedFilters.priceRange[0] && price <= advancedFilters.priceRange[1]
                })

                // Rating (mock filter for now)
                if (advancedFilters.rating > 0) {
                  filtered = filtered.filter((course: any) => {
                    const rating = (course as any).rating || 0
                    return rating >= advancedFilters.rating
                  })
                }

                // Duration (mock filter for now)
                if (advancedFilters.duration > 0) {
                  filtered = filtered.filter((course: any) => {
                    const durationHours = course.duration_minutes ? course.duration_minutes / 60 : 0
                    return durationHours <= advancedFilters.duration
                  })
                }

                setFilteredCourses(filtered)
              }}
            />

            {/* Mobile Filter Sheet */}
            <Sheet>
              <SheetTrigger>
                <Button variant="outline" size="icon" className="lg:hidden touch-feedback">
                  <Filter className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                  <SheetDescription>
                    Refine your course search
                  </SheetDescription>
                </SheetHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Category</label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category: any) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Level</label>
                    <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {levels.map((level: any) => (
                          <SelectItem key={level} value={level}>
                            {level}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
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

        {/* Enhanced Course Grid with Hover Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredCourses.map((course) => {
            const isEnrolled = enrolledCourseIds.has(course.id)
            const progress = (course as any).progress || 0

            return (
              <CourseCard
                key={course.id}
                course={course}
                isEnrolled={isEnrolled}
                progress={progress}
              />
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

        {/* Instructor Showcase */}
        {!loading && instructors.length > 0 && (
          <div className="mt-12 pt-8 border-t border-border/50">
            <InstructorShowcase
              instructors={instructors}
              layout="grid"
              maxShow={6}
            />
          </div>
        )}
      </div>
    </div>
  )
}