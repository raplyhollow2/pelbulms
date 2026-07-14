'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Clock, ArrowLeft, Loader2, CheckCircle, ChevronLeft, ChevronRight, Play, StickyNote, Save, Trash2, FileQuestion } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'
import { QuizPlayer } from '@/components/quiz/quiz-player'

type Course = Database['public']['Tables']['courses']['Row']
type Module = Database['public']['Tables']['modules']['Row']
type Lesson = Database['public']['Tables']['lessons']['Row']
type Enrollment = Database['public']['Tables']['enrollments']['Row']
type Note = Database['public']['Tables']['notes']['Row']
type LessonProgress = Database['public']['Tables']['lesson_progress']['Row']
type Quiz = Database['public']['Tables']['quizzes']['Row']

export default function LessonViewPage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.courseId as string
  const lessonId = params.lessonId as string

  const [course, setCourse] = useState<Course | null>(null)
  const [module, setModule] = useState<Module | null>(null)
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [allLessons, setAllLessons] = useState<Lesson[]>([])
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)

  // Progress tracking state
  const [lessonProgress, setLessonProgress] = useState<LessonProgress | null>(null)
  const [isCompleted, setIsCompleted] = useState(false)
  const [savingProgress, setSavingProgress] = useState(false)

  // Notes state
  const [notes, setNotes] = useState<Note[]>([])
  const [newNote, setNewNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [showNotesPanel, setShowNotesPanel] = useState(true)

  // Quiz state
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [quizQuestions, setQuizQuestions] = useState<any[]>([])
  const [showQuiz, setShowQuiz] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchLessonData()
  }, [courseId, lessonId])

  // Auto-save notes every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (newNote.trim()) {
        saveNote(true) // Auto-save
      }
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [newNote])

  const fetchLessonData = async () => {
    try {
      setLoading(true)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)

      if (!user) {
        router.push('/auth/login')
        return
      }

      // Check enrollment status
      const { data: enrollmentData } = await supabase
        .from('enrollments')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .maybeSingle()

      if (enrollmentData) {
        setEnrollment(enrollmentData)
      }

      // Fetch lesson details
      const { data: lessonData, error: lessonError } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', lessonId)
        .single()

      if (lessonError) throw lessonError
      if (!lessonData) {
        router.push(`/learn/${courseId}`)
        return
      }

      setLesson(lessonData as Lesson)

      // Fetch module for this lesson
      const { data: moduleData } = await supabase
        .from('modules')
        .select('*')
        .eq('id', (lessonData as Lesson).module_id)
        .single()

      if (moduleData) {
        setModule(moduleData)
      }

      // Fetch course details
      const { data: courseData } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single()

      if (courseData) {
        setCourse(courseData)
      }

      // Fetch all lessons in this module for navigation
      const { data: moduleLessons } = await supabase
        .from('lessons')
        .select('*')
        .eq('module_id', (lessonData as Lesson).module_id)
        .eq('is_published', true)
        .order('order_index', { ascending: true })

      if (moduleLessons) {
        setAllLessons(moduleLessons as Lesson[])
        const index = (moduleLessons as Lesson[]).findIndex(l => l.id === lessonId)
        setCurrentLessonIndex(index >= 0 ? index : 0)
      }

      // Fetch lesson progress
      try {
        console.log('Fetching lesson progress...')
        const { data: progressData } = await supabase
          .from('lesson_progress')
          .select('*')
          .eq('user_id', user.id)
          .eq('lesson_id', lessonId)
          .maybeSingle()

        if (progressData) {
          setLessonProgress(progressData as LessonProgress)
          setIsCompleted((progressData as LessonProgress).completed || false)
        }
        console.log('Lesson progress fetched successfully')
      } catch (progressError) {
        console.log('Lesson progress fetch error (continuing anyway):', progressError)
      }

      // Fetch notes for this lesson
      try {
        console.log('Fetching notes...')
        const { data: notesData } = await supabase
          .from('notes')
          .select('*')
          .eq('user_id', user.id)
          .eq('lesson_id', lessonId)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })

        if (notesData) {
          setNotes(notesData)
        }
        console.log('Notes fetched successfully')
      } catch (notesError) {
        console.log('Notes fetch error (continuing anyway):', notesError)
      }

      // Fetch quiz for this lesson (get first published quiz)
      console.log('Fetching quiz for lesson:', lessonId)
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('lesson_id', lessonId)
        .eq('is_published', true)
        .limit(1)
        .maybeSingle()

      console.log('Quiz fetch result:', { quizData, quizError })

      if (quizError) {
        console.log('Quiz fetch error:', quizError)
      }

      if (quizData) {
        console.log('Setting quiz data:', quizData)
        setQuiz(quizData as any)

        // Fetch quiz questions for this quiz
        try {
          console.log('Fetching quiz questions for quiz:', (quizData as any).id)
          const { data: questionsData } = await supabase
            .from('quiz_questions')
            .select('*')
            .eq('quiz_id', (quizData as any).id)
            .order('order_index', { ascending: true })

          if (questionsData && questionsData.length > 0) {
            console.log('Quiz questions fetched:', questionsData.length)
            setQuizQuestions(questionsData)
          } else {
            console.log('No quiz questions found')
          }
        } catch (questionsError) {
          console.log('Error fetching quiz questions (continuing anyway):', questionsError)
        }
      } else {
        console.log('No quiz data found for lesson:', lessonId)
        // Temporary: Force quiz to show for testing
        console.log('Setting test quiz for debugging')
        const testQuiz = {
          id: '950e8400-e29b-41d4-a716-446655440001',
          lesson_id: lessonId,
          title: 'HTML & CSS Fundamentals Quiz',
          description: 'Test your knowledge of HTML5 and CSS3 fundamentals.',
          time_limit_minutes: 30,
          passing_score: 70,
          max_attempts: 3,
          is_published: true,
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        console.log('Test quiz object:', testQuiz)
        setQuiz(testQuiz)

        // Fetch quiz questions for the test quiz
        try {
          console.log('Fetching quiz questions for test quiz:', testQuiz.id)
          const { data: testQuestionsData } = await supabase
            .from('quiz_questions')
            .select('*')
            .eq('quiz_id', testQuiz.id)
            .order('order_index', { ascending: true })

          if (testQuestionsData && testQuestionsData.length > 0) {
            console.log('Test quiz questions fetched:', testQuestionsData.length)
            setQuizQuestions(testQuestionsData)
          } else {
            console.log('No test quiz questions found')
          }
        } catch (testQuestionsError) {
          console.log('Error fetching test quiz questions:', testQuestionsError)
        }

        console.log('Quiz state should be set now')
      }

    } catch (error) {
      console.error('Error fetching lesson data:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveNote = async (autoSave = false) => {
    if (!newNote.trim() || !currentUser) return

    try {
      setSavingNote(true)

      const supabaseInsert = supabase as any
      const { data, error } = await supabaseInsert
        .from('notes')
        .insert({
          user_id: currentUser.id,
          lesson_id: lessonId,
          course_id: courseId,
          content: newNote.trim(),
          timestamp: Math.floor(Date.now() / 1000)
        } as any)
        .select()
        .single()

      if (error) throw error

      setNotes([data, ...notes] as any)
      if (!autoSave) {
        setNewNote('') // Clear input only on manual save
      }
    } catch (error) {
      console.error('Error saving note:', error)
      if (!autoSave) {
        alert('Failed to save note. Please try again.')
      }
    } finally {
      setSavingNote(false)
    }
  }

  const deleteNote = async (noteId: string) => {
    if (!currentUser) return

    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId)
        .eq('user_id', currentUser.id)

      if (error) throw error

      setNotes(notes.filter((note: any) => note.id !== noteId))
    } catch (error) {
      console.error('Error deleting note:', error)
      alert('Failed to delete note. Please try again.')
    }
  }

  const toggleLessonComplete = async () => {
    if (!currentUser || !lesson) return

    try {
      setSavingProgress(true)

      if (lessonProgress) {
        // Update existing progress
        const supabaseUpdate = supabase as any
        const { error } = await supabaseUpdate
          .from('lesson_progress')
          .update({
            completed: !isCompleted,
            completed_at: !isCompleted ? new Date().toISOString() : null,
            last_accessed_at: new Date().toISOString()
          })
          .eq('id', lessonProgress.id)

        if (error) throw error
      } else {
        // Create new progress record
        const supabaseInsert = supabase as any
        const { error } = await supabaseInsert
          .from('lesson_progress')
          .insert({
            user_id: currentUser.id,
            lesson_id: lessonId,
            completed: !isCompleted,
            completed_at: !isCompleted ? new Date().toISOString() : null,
            time_spent_seconds: 0,
            last_accessed_at: new Date().toISOString()
          })

        if (error) throw error
      }

      // Update local state
      setIsCompleted(!isCompleted)

      // Refresh enrollment data to show updated progress
      const { data: updatedEnrollment } = await supabase
        .from('enrollments')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('course_id', courseId)
        .single()

      if (updatedEnrollment) {
        setEnrollment(updatedEnrollment)
      }

    } catch (error) {
      console.error('Error updating progress:', error)
      alert('Failed to update progress. Please try again.')
    } finally {
      setSavingProgress(false)
    }
  }

  const goToNextLesson = () => {
    if (currentLessonIndex < allLessons.length - 1) {
      const nextLesson = allLessons[currentLessonIndex + 1]
      router.push(`/learn/${courseId}/lesson/${nextLesson.id}`)
    }
  }

  const goToPreviousLesson = () => {
    if (currentLessonIndex > 0) {
      const prevLesson = allLessons[currentLessonIndex - 1]
      router.push(`/learn/${courseId}/lesson/${prevLesson.id}`)
    }
  }

  const goBackToModules = () => {
    router.push(`/learn/${courseId}`)
  }

  // Get YouTube embed URL with proper parameters
  const getYoutubeEmbedUrl = (url: string) => {
    if (!url) return ''
    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/)?.[1]
    if (!videoId) return url
    return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&rel=0&modestbranding=1`
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-bhutan-yellow" />
          <span className="ml-3 text-muted-foreground">Loading lesson...</span>
        </div>
      </div>
    )
  }

  if (!lesson || !module) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Lesson not found</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push(`/learn/${courseId}`)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Course
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={goBackToModules}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Course
          </Button>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Badge variant="outline" className="mb-2">{module.title}</Badge>
              <h1 className="text-3xl font-bold mb-2">{lesson.title}</h1>
              {lesson.description && (
                <p className="text-muted-foreground">{lesson.description}</p>
              )}
            </div>
            <Button
              onClick={toggleLessonComplete}
              disabled={savingProgress}
              className={`${isCompleted ? 'bg-green-600 hover:bg-green-700' : 'bg-bhutan-yellow hover:bg-bhutan-orange'}`}
            >
              {savingProgress ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : isCompleted ? (
                <CheckCircle className="w-5 h-5 mr-2" />
              ) : (
                <CheckCircle className="w-5 h-5 mr-2" />
              )}
              {isCompleted ? 'Completed' : 'Mark Complete'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content Area */}
          <div className="lg:col-span-3 space-y-6">
            {/* Video Player Section */}
            <div className="mb-6">
              <Card className="glass overflow-hidden">
                <CardContent className="p-0">
                  <div className="aspect-video bg-black flex items-center justify-center">
                    {lesson.video_url ? (
                      <div className="w-full h-full">
                        <iframe
                          src={getYoutubeEmbedUrl(lesson.video_url)}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                          title={lesson.title}
                        />
                      </div>
                    ) : (
                      <div className="text-center text-white">
                        <Play className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg opacity-75">No video available</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Notes Section */}
            <Card className="glass">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <StickyNote className="w-5 h-5" />
                    Your Notes
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowNotesPanel(!showNotesPanel)}
                  >
                    {showNotesPanel ? 'Hide' : 'Show'}
                  </Button>
                </div>
              </CardHeader>
              {showNotesPanel && (
                <CardContent className="space-y-4">
                  {/* Notes List */}
                  {notes.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {notes.map((note) => (
                        <div key={note.id} className="p-3 bg-secondary/30 rounded-lg">
                          <div className="flex justify-between items-start gap-2">
                            <p className="text-sm flex-1">{note.content}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteNote(note.id)}
                              className="h-6 w-6 p-0"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            {new Date(note.created_at).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* New Note Input */}
                  <div className="flex gap-2">
                    <textarea
                      placeholder="Take notes while watching..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      className="flex-1 min-h-[80px] p-3 border rounded-lg resize-none bg-background focus:outline-none focus:ring-2 focus:ring-bhutan-yellow"
                      disabled={savingNote}
                    />
                    <Button
                      onClick={() => saveNote()}
                      disabled={!newNote.trim() || savingNote}
                      className="self-end bg-bhutan-yellow hover:bg-bhutan-orange"
                    >
                      {savingNote ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Save className="w-5 h-5" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Notes auto-save every 30 seconds
                  </p>
                </CardContent>
              )}
            </Card>

            {/* Quiz Section */}
            {(() => {
              console.log('Quiz section render check:', { quiz, showQuiz, quizExists: !!quiz })
              return quiz && (
                <Card className="glass">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <FileQuestion className="w-5 h-5" />
                      Lesson Quiz
                    </CardTitle>
                    {!showQuiz && (
                      <Button
                        size="sm"
                        onClick={() => setShowQuiz(true)}
                        className="bg-bhutan-yellow hover:bg-bhutan-orange"
                      >
                        Start Quiz
                      </Button>
                    )}
                  </div>
                  {quiz.description && (
                    <CardDescription>{quiz.description}</CardDescription>
                  )}
                </CardHeader>
                {showQuiz && (
                  <CardContent>
                    <QuizPlayer
                      quizId={quiz.id}
                      lessonId={lessonId}
                      courseId={courseId}
                      quizData={quiz}
                      questionsData={quizQuestions}
                      onComplete={(attempt) => {
                        setShowQuiz(false)
                        // Optionally refresh progress data
                      }}
                      onClose={() => setShowQuiz(false)}
                    />
                  </CardContent>
                )}
              </Card>
              )
            })()}

            {/* Progress Tracking */}
            {enrollment && (
              <Card className="glass">
                <CardHeader>
                  <CardTitle>Your Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span>Course Progress</span>
                      <span className="font-bold text-bhutan-yellow">
                        {enrollment.progress_percentage || 0}%
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-bhutan-yellow h-2 rounded-full transition-all duration-300"
                        style={{ width: `${enrollment.progress_percentage || 0}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {allLessons.filter((_, i) => i < currentLessonIndex).length} of {allLessons.length} lessons completed
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Lesson Navigation */}
          <div className="space-y-6">
            {/* Navigation Controls */}
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-lg">Lesson Navigation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={goToPreviousLesson}
                  disabled={currentLessonIndex === 0}
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>

                <div className="text-center text-sm text-muted-foreground">
                  {currentLessonIndex + 1} of {allLessons.length}
                </div>

                <Button
                  className="w-full bg-bhutan-yellow hover:bg-bhutan-orange"
                  onClick={goToNextLesson}
                  disabled={currentLessonIndex === allLessons.length - 1}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            {/* Module Lessons List */}
            {allLessons.length > 0 && (
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="text-lg">In This Module</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {allLessons.map((l, index) => {
                      const isPastLesson = index < currentLessonIndex
                      const isCurrentLesson = l.id === lesson.id

                      return (
                        <div
                          key={l.id}
                          className={`p-3 rounded-lg cursor-pointer transition-colors ${
                            isCurrentLesson
                              ? 'bg-bhutan-yellow/20 border border-bhutan-yellow/50'
                              : 'hover:bg-secondary/50'
                          }`}
                          onClick={() => router.push(`/learn/${courseId}/lesson/${l.id}`)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
                              {isPastLesson ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              ) : (
                                <span className="text-xs font-medium">{index + 1}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm truncate">{l.title}</h4>
                              {l.duration_minutes && (
                                <p className="text-xs text-muted-foreground">
                                  <Clock className="w-3 h-3 inline mr-1" />
                                  {Math.floor(l.duration_minutes / 60)}m
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Course Stats */}
            {course && (
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
                    <span className="text-muted-foreground">Level</span>
                    <Badge variant="secondary" className="text-xs capitalize">
                      {course.level}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}