import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { VideoPlayerWithLearning } from '@/components/learning/video-player-with-learning'

interface Lesson {
  id: string
  title: string
  description: string
  duration: number
  video_url: string
  is_free: boolean
  completed: boolean
}

interface Section {
  id: string
  title: string
  description: string
  lessons: Lesson[]
}

interface Course {
  id: string
  title: string
  description: string
  category: string
  level: string
  language: string
  duration_minutes: number
  last_updated: string
  requirements?: string[]
  learningObjectives?: string[]
  targetAudience?: string[]
  instructor?: {
    full_name: string
    bio?: string
    avatar_url?: string
  }
}

export default async function LearnCoursePage({ params }: { params: { courseId: string } }) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    },
  )

  // Check authentication
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  const courseId = params.courseId

  // Fetch course data
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select(`
      *,
      instructor:instructor_id (
        full_name,
        bio,
        avatar_url
      )
    `)
    .eq('id', courseId)
    .single()

  if (courseError || !course) {
    redirect('/learn/courses')
  }

  // Fetch sections with lessons
  const { data: sections } = await supabase
    .from('sections')
    .select(`
      *,
      lessons (*)
    `)
    .eq('course_id', courseId)
    .order('order_index', { ascending: true })

  // Fetch user progress for lessons
  const { data: userProgress } = await supabase
    .from('lesson_progress')
    .select('*')
    .eq('user_id', session.user.id)

  // Create a map of completed lessons
  const completedLessonsMap = new Set(
    userProgress?.map(progress => progress.lesson_id).filter(Boolean) || []
  )

  // Transform sections data to include completion status
  const transformedSections: Section[] = (sections || []).map((section: any) => ({
    id: section.id,
    title: section.title,
    description: section.description || '',
    lessons: section.lessons.map((lesson: any) => ({
      id: lesson.id,
      title: lesson.title,
      description: lesson.description || '',
      duration: lesson.duration_minutes || 0,
      video_url: lesson.video_url || '',
      is_free: lesson.is_free || false,
      completed: completedLessonsMap.has(lesson.id)
    }))
  }))

  // Fetch announcements
  const { data: announcements } = await supabase
    .from('announcements')
    .select('*')
    .eq('course_id', courseId)
    .order('created_at', { ascending: false })

  // Fetch reviews
  const { data: reviews } = await supabase
    .from('reviews')
    .select('*')
    .eq('course_id', courseId)
    .order('created_at', { ascending: false })

  // Transform course data
  const transformedCourse: Course = {
    id: course.id,
    title: course.title,
    description: course.description || '',
    category: course.category || 'General',
    level: course.level || 'Beginner',
    language: course.language || 'English',
    duration_minutes: course.duration_minutes || 0,
    last_updated: course.updated_at || course.created_at,
    requirements: course.requirements,
    learningObjectives: course.learning_objectives,
    targetAudience: course.target_audience,
    instructor: course.instructor ? {
      full_name: course.instructor.full_name,
      bio: course.instructor.bio,
      avatar_url: course.instructor.avatar_url
    } : undefined
  }

  return (
    <VideoPlayerWithLearning
      courseId={courseId}
      course={transformedCourse}
      sections={transformedSections}
      announcements={announcements || []}
      reviews={reviews || []}
      currentUserId={session.user.id}
    />
  )
}