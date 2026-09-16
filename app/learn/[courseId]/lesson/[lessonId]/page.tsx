'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2, CheckCircle, Award } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'
import { QuizPlayer } from '@/components/quiz/quiz-player'
import { GeminiTutor } from '@/components/ai/gemini-tutor'
import { ScenarioPlayer } from '@/components/learning/scenario-player'
import { CurriculumRail } from '@/components/learning/curriculum-rail'
import { LessonPlayerHeader } from '@/components/learning/lesson-player-header'
import { LessonNextBar } from '@/components/learning/lesson-next-bar'
import { CourseLearningTabs } from '@/components/course/course-learning-tabs'
import { LessonBlocks } from '@/components/course/lesson-blocks'
import { LessonContentStage } from '@/components/learning/lesson-content-stage'
import { CourseCompletionDialog } from '@/components/learning/course-completion-dialog'
import { type VideoProgressData } from '@/components/learning/tracked-video-player'
import { parseLessonBlocks, readCourseAiMetadata } from '@/lib/lesson-blocks'
import {
  mergeGateSettings,
  canViewResourcesAndFlashcards,
  canGoToNextLesson,
  isLessonUnlocked,
  type LessonProgressLite,
} from '@/lib/progression-gates'

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
  const [allModules, setAllModules] = useState<Module[]>([])
  const [instructor, setInstructor] = useState<{
    id?: string
    full_name?: string | null
    avatar_url?: string | null
    bio?: string | null
  } | null>(null)
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)

  // Progress tracking state
  const [lessonProgress, setLessonProgress] = useState<LessonProgress | null>(null)
  const [isCompleted, setIsCompleted] = useState(false)
  const [activityCompleted, setActivityCompleted] = useState(false)
  const [mandatoryTotal, setMandatoryTotal] = useState(0)
  const [mandatoryCompleted, setMandatoryCompleted] = useState(0)
  const [activityProgressById, setActivityProgressById] = useState<
    Record<string, { id: string; completed?: boolean; source?: string | null }>
  >({})
  const [markingActivityId, setMarkingActivityId] = useState<string | null>(null)
  const [videoWatchSatisfied, setVideoWatchSatisfied] = useState(false)
  const [savingProgress, setSavingProgress] = useState(false)
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set())
  const [progressByLesson, setProgressByLesson] = useState<Map<string, LessonProgressLite>>(
    new Map()
  )
  const [certificateUrl, setCertificateUrl] = useState<string | null>(null)
  const [issuingCert, setIssuingCert] = useState(false)
  const [focusLearningTab, setFocusLearningTab] = useState<string | null>(null)
  const [autoAdvanceNotice, setAutoAdvanceNotice] = useState<string | null>(null)
  const [showCompletionDialog, setShowCompletionDialog] = useState(false)
  const lessonProgressIdRef = useRef<string | null>(null)
  const timeSpentBaseRef = useRef(0)
  const certAutoRequestedRef = useRef(false)
  const congratsShownRef = useRef(false)
  const completingLessonRef = useRef(false)
  const activeLessonIdRef = useRef(lessonId)
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  activeLessonIdRef.current = lessonId

  // Notes state
  const [notes, setNotes] = useState<Note[]>([])
  const [newNote, setNewNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [showNotesPanel, setShowNotesPanel] = useState(true)

  // Quiz state
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [quizQuestions, setQuizQuestions] = useState<any[]>([])
  const [showQuiz, setShowQuiz] = useState(false)

  // Video ref for timestamp notes
  const videoRef = useRef<HTMLVideoElement>(null)

  const supabase = createClient()

  const clearAutoAdvance = () => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current)
      autoAdvanceTimerRef.current = null
    }
    setAutoAdvanceNotice(null)
  }

  // Drop previous-lesson watch/complete flags before the new lesson's data lands.
  useEffect(() => {
    setVideoWatchSatisfied(false)
    setIsCompleted(false)
    setActivityCompleted(false)
    setLessonProgress(null)
    setMandatoryTotal(0)
    setMandatoryCompleted(0)
    setActivityProgressById({})
    setFocusLearningTab(null)
    lessonProgressIdRef.current = null
    completingLessonRef.current = false
    clearAutoAdvance()
  }, [lessonId])

  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current)
    }
  }, [])

  useEffect(() => {
    fetchLessonData()
  }, [courseId, lessonId])

  // If sequential unlock is enabled and this lesson isn't open yet, bounce back (no alert spam)
  useEffect(() => {
    if (loading || !lesson || allLessons.length === 0) return
    const ordered = allLessons.map((l) => l.id)
    const settingsFor = (id: string) => {
      const les = allLessons.find((l) => l.id === id)
      const mod = allModules.find((m) => m.id === (les as any)?.module_id) || module
      return mergeGateSettings((mod as any)?.metadata, (les as any)?.metadata)
    }
    const unlocked = isLessonUnlocked({
      orderedLessonIds: ordered,
      targetLessonId: lessonId,
      progressByLesson,
      settingsForLesson: settingsFor,
    })
    if (!unlocked) {
      const firstOpen = ordered.find((id) =>
        isLessonUnlocked({
          orderedLessonIds: ordered,
          targetLessonId: id,
          progressByLesson,
          settingsForLesson: settingsFor,
        })
      )
      if (firstOpen && firstOpen !== lessonId) {
        router.replace(`/learn/${courseId}/lesson/${firstOpen}`)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, lessonId, allLessons, progressByLesson, module, allModules])

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

      // Check enrollment — only active/completed can access lessons
      const { data: enrollmentData } = await supabase
        .from('enrollments')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .maybeSingle()

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

      try {
        await (supabase as any)
          .from('enrollments')
          .update({
            last_lesson_id: lessonId,
            last_accessed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', (enrollmentData as any).id)
      } catch {
        /* non-fatal */
      }

      // Fetch lesson details
      const { data: lessonData, error: lessonError } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', lessonId)
        .single()

      if (lessonError) throw lessonError
      if (!lessonData) {
        router.push('/dashboard')
        return
      }

      setLesson(lessonData as Lesson)
      setIsCompleted(false)
      setVideoWatchSatisfied(!(lessonData as Lesson).video_url)

      // Fetch all modules for this course
      const { data: modulesData } = await supabase
        .from('modules')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index', { ascending: true })

      if (modulesData) {
        setAllModules(modulesData as Module[])
      }

      // Fetch module for this lesson
      const { data: moduleData } = await supabase
        .from('modules')
        .select('*')
        .eq('id', (lessonData as Lesson).module_id)
        .single()

      if (moduleData) {
        setModule(moduleData)
      }

      // Fetch course details + instructor
      const { data: courseData } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single()

      if (courseData) {
        setCourse(courseData)
        const instructorId = (courseData as any).instructor_id
        if (instructorId) {
          const { data: instructorProfile } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, bio')
            .eq('id', instructorId)
            .maybeSingle()
          if (instructorProfile) setInstructor(instructorProfile as any)
        }
      }

      // Course-wide ordered lessons (modules by order, then lessons by order)
      const moduleList = (modulesData || []) as Module[]
      if (moduleList.length > 0) {
        const moduleIds = moduleList.map((m) => m.id)
        const { data: courseLessons } = await supabase
          .from('lessons')
          .select('*')
          .in('module_id', moduleIds)
          .eq('is_published', true)
          .order('order_index', { ascending: true })

        const byModule = new Map<string, Lesson[]>()
        for (const l of (courseLessons || []) as Lesson[]) {
          const list = byModule.get(l.module_id) || []
          list.push(l)
          byModule.set(l.module_id, list)
        }
        const ordered: Lesson[] = []
        for (const m of moduleList) {
          const lessonsInModule = byModule.get(m.id) || []
          lessonsInModule.sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
          ordered.push(...lessonsInModule)
        }
        setAllLessons(ordered)
        const index = ordered.findIndex((l) => l.id === lessonId)
        setCurrentLessonIndex(index >= 0 ? index : 0)
      } else {
        setAllLessons([])
        setCurrentLessonIndex(0)
      }

      // Fetch lesson progress for THIS lesson
      let thisLessonCompleted = false
      try {
        const { data: progressData } = await supabase
          .from('lesson_progress')
          .select('*')
          .eq('user_id', user.id)
          .eq('lesson_id', lessonId)
          .maybeSingle()

        if (progressData) {
          const pd = progressData as any
          thisLessonCompleted = Boolean(pd.completed)
          setLessonProgress(pd as LessonProgress)
          setIsCompleted(thisLessonCompleted)
          setActivityCompleted(Boolean(pd.activity_completed))
          lessonProgressIdRef.current = pd.id
          timeSpentBaseRef.current = pd.time_spent_seconds || 0
          setVideoWatchSatisfied(
            !(lessonData as Lesson).video_url || (pd.progress_percentage || 0) >= 90
          )
          if (thisLessonCompleted) {
            setCompletedLessonIds((prev) => {
              const next = new Set(prev)
              next.add(lessonId)
              return next
            })
          }
        } else {
          lessonProgressIdRef.current = null
          timeSpentBaseRef.current = 0
          setIsCompleted(false)
          setActivityCompleted(false)
          setVideoWatchSatisfied(!(lessonData as Lesson).video_url)
        }
      } catch (progressError) {
        console.log('Lesson progress fetch error (continuing anyway):', progressError)
      }

      // Fetch completed-lesson ids across the whole course (for checkmarks/progress)
      try {
        const { data: courseProgress, error: courseProgressError } = await supabase
          .from('lesson_progress')
          .select('lesson_id, completed, activity_completed')
          .eq('user_id', user.id)
          .eq('course_id', courseId)

        if (courseProgressError) {
          // Fallback without activity_completed for older DBs
          const { data: fallback } = await supabase
            .from('lesson_progress')
            .select('lesson_id, completed')
            .eq('user_id', user.id)
            .eq('course_id', courseId)
          if (fallback) {
            const map = new Map<string, LessonProgressLite>()
            for (const r of fallback as any[]) {
              map.set(r.lesson_id, {
                lesson_id: r.lesson_id,
                completed: r.completed,
                activity_completed: Boolean(r.completed),
              })
            }
            if (thisLessonCompleted) {
              map.set(lessonId, {
                lesson_id: lessonId,
                completed: true,
                activity_completed: map.get(lessonId)?.activity_completed ?? true,
              })
            }
            setProgressByLesson(map)
            setCompletedLessonIds(
              new Set(
                (fallback as any[])
                  .filter((r) => r.completed)
                  .map((r) => r.lesson_id as string)
                  .concat(thisLessonCompleted ? [lessonId] : [])
              )
            )
          }
        } else if (courseProgress) {
          const map = new Map<string, LessonProgressLite>()
          for (const r of courseProgress as any[]) {
            map.set(r.lesson_id, {
              lesson_id: r.lesson_id,
              completed: r.completed,
              activity_completed:
                r.activity_completed == null
                  ? Boolean(r.completed)
                  : Boolean(r.activity_completed),
            })
          }
          if (thisLessonCompleted) {
            const cur = map.get(lessonId)
            map.set(lessonId, {
              lesson_id: lessonId,
              completed: true,
              activity_completed: cur?.activity_completed ?? true,
            })
          }
          setProgressByLesson(map)
          const ids = (courseProgress as any[])
            .filter((r) => r.completed)
            .map((r) => r.lesson_id as string)
          if (thisLessonCompleted && !ids.includes(lessonId)) ids.push(lessonId)
          setCompletedLessonIds(new Set(ids))
        }
      } catch (e) {
        console.log('Course progress fetch error (continuing anyway):', e)
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
        setQuiz(quizData as any)
        try {
          const { data: questionsData } = await supabase
            .from('quiz_questions')
            .select('*')
            .eq('quiz_id', (quizData as any).id)
            .order('order_index', { ascending: true })

          if (questionsData && questionsData.length > 0) {
            setQuizQuestions(questionsData)
          }
        } catch (questionsError) {
          console.log('Error fetching quiz questions (continuing anyway):', questionsError)
        }
      } else {
        setQuiz(null)
        setQuizQuestions([])
      }

      // Per-activity mandatory progress (syncs quiz passes + activity_completed)
      try {
        const res = await fetch(`/api/lessons/${lessonId}/activity-progress`)
        if (res.ok) {
          const data = await res.json()
          applyActivityProgressPayload(data)
        }
      } catch (e) {
        console.log('Activity progress fetch error (continuing):', e)
      }

    } catch (error) {
      console.error('Error fetching lesson data:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyActivityProgressPayload = (data: any) => {
    const map: Record<string, { id: string; completed?: boolean; source?: string | null }> = {}
    for (const a of data.activities || []) {
      map[a.id] = {
        id: a.id,
        completed: Boolean(a.completed),
        source: a.source || null,
      }
    }
    setActivityProgressById(map)
    setMandatoryTotal(Number(data.mandatoryTotal) || 0)
    setMandatoryCompleted(Number(data.mandatoryCompleted) || 0)
    const done = Boolean(data.activityCompleted)
    setActivityCompleted(done)
    setProgressByLesson((prev) => {
      const next = new Map(prev)
      const cur = next.get(lessonId)
      next.set(lessonId, {
        lesson_id: lessonId,
        // Never wipe a known completed flag when activity sync lands first
        completed: Boolean(cur?.completed) || completedLessonIds.has(lessonId),
        activity_completed: done,
      })
      return next
    })
  }

  const refreshActivityProgress = async (opts?: { action?: 'sync'; activityId?: string }) => {
    try {
      if (opts?.activityId || opts?.action === 'sync') {
        const res = await fetch(`/api/lessons/${lessonId}/activity-progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            opts.activityId
              ? { activityId: opts.activityId, action: 'ack' }
              : { action: 'sync' }
          ),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to update activity progress')
        applyActivityProgressPayload(data)
        return data
      }
      const res = await fetch(`/api/lessons/${lessonId}/activity-progress`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load activity progress')
      applyActivityProgressPayload(data)
      return data
    } catch (e) {
      console.error('refreshActivityProgress failed:', e)
      throw e
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

  // Persist watch progress (throttled by the player). Never un-completes.
  const persistWatchProgress = async (data: VideoProgressData) => {
    if (!currentUser || !lesson) return
    if (data.percent >= 90 && activeLessonIdRef.current === lessonId) {
      setVideoWatchSatisfied(true)
    }
    const payload: any = {
      course_id: courseId,
      progress_percentage: data.percent,
      last_position_seconds: data.positionSeconds,
      time_spent_seconds: timeSpentBaseRef.current + data.watchedSeconds,
      last_accessed_at: new Date().toISOString(),
    }
    try {
      const db = supabase as any
      if (lessonProgressIdRef.current) {
        await db.from('lesson_progress').update(payload).eq('id', lessonProgressIdRef.current)
      } else {
        const { data: inserted } = await db
          .from('lesson_progress')
          .insert({ user_id: currentUser.id, lesson_id: lessonId, completed: false, ...payload })
          .select()
          .single()
        if (inserted) lessonProgressIdRef.current = (inserted as any).id
      }
      if (enrollment?.id) {
        await (supabase as any)
          .from('enrollments')
          .update({
            last_lesson_id: lessonId,
            last_accessed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', (enrollment as any).id)
      }
    } catch (error) {
      // Non-fatal: progress will be retried on the next tick
      console.log('persistWatchProgress error (continuing):', error)
    }
  }

  // Set the completed flag for the current lesson and refresh rollups.
  const setLessonCompletedState = async (completed: boolean): Promise<boolean> => {
    if (!currentUser || !lesson) return false
    if (completingLessonRef.current) return false
    if (activeLessonIdRef.current !== lessonId) return false
    // Avoid no-op writes that still trip the enrollment trigger
    if (completed === isCompleted && lessonProgressIdRef.current) return true

    completingLessonRef.current = true
    try {
      setSavingProgress(true)
      const now = new Date().toISOString()
      const payload: Record<string, unknown> = {
        user_id: currentUser.id,
        lesson_id: lessonId,
        course_id: courseId,
        completed,
        // Keep legacy column in sync when present
        is_completed: completed,
        completed_at: completed ? now : null,
        last_accessed_at: now,
        time_spent_seconds: timeSpentBaseRef.current,
      }
      const db = supabase as any

      const { data: upserted, error } = await db
        .from('lesson_progress')
        .upsert(payload, { onConflict: 'user_id,lesson_id' })
        .select('id, completed, activity_completed')
        .single()

      if (error) {
        // Retry without legacy is_completed if the column write is rejected
        if (String(error.message || '').toLowerCase().includes('is_completed')) {
          delete payload.is_completed
          const retry = await db
            .from('lesson_progress')
            .upsert(payload, { onConflict: 'user_id,lesson_id' })
            .select('id, completed, activity_completed')
            .single()
          if (retry.error) throw retry.error
          if (retry.data) lessonProgressIdRef.current = retry.data.id
        } else {
          throw error
        }
      } else if (upserted) {
        lessonProgressIdRef.current = upserted.id
      }

      setIsCompleted(completed)
      setCompletedLessonIds((prev) => {
        const next = new Set(prev)
        if (completed) next.add(lessonId)
        else next.delete(lessonId)
        return next
      })
      setProgressByLesson((prev) => {
        const next = new Map(prev)
        const cur = next.get(lessonId)
        next.set(lessonId, {
          lesson_id: lessonId,
          completed,
          activity_completed: cur?.activity_completed || false,
        })
        return next
      })

      // Refresh enrollment (the DB trigger recomputes % and completion)
      const { data: updatedEnrollment } = await supabase
        .from('enrollments')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('course_id', courseId)
        .maybeSingle()

      if (updatedEnrollment) {
        setEnrollment(updatedEnrollment)
        if ((updatedEnrollment as any).progress_percentage >= 100) {
          celebrateCourseCompletion()
        }
      }
      return true
    } catch (error: any) {
      const message =
        error?.message ||
        error?.error_description ||
        error?.details ||
        (typeof error === 'string' ? error : 'Unknown error')
      console.warn('Error updating progress:', message, error?.code || '', error?.details || '')
      alert(`Failed to update progress: ${message}`)
      return false
    } finally {
      completingLessonRef.current = false
      setSavingProgress(false)
    }
  }

  // Auto completion mode: video threshold (or no video) + mandatory activities
  useEffect(() => {
    if (loading || !lesson || lesson.id !== lessonId || isCompleted || savingProgress) return
    const settings = mergeGateSettings(
      (module as any)?.metadata,
      (lesson as any)?.metadata
    )
    if (settings.completionMode !== 'auto') return
    // No mandatory activities ⇒ treated as done (avoids stuck false before/without API row)
    if (!activityCompleted && mandatoryTotal > 0) return
    if (lesson.video_url && !videoWatchSatisfied) return
    void setLessonCompletedState(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    loading,
    lesson,
    lessonId,
    module,
    isCompleted,
    savingProgress,
    activityCompleted,
    mandatoryTotal,
    videoWatchSatisfied,
  ])

  // Greet learners when the course is fully complete (fresh completion or revisit)
  useEffect(() => {
    if (loading) return
    const pct =
      enrollment?.progress_percentage ??
      (allLessons.length > 0
        ? Math.round((completedLessonIds.size / allLessons.length) * 100)
        : 0)
    const allDone =
      pct >= 100 ||
      (allLessons.length > 0 && completedLessonIds.size >= allLessons.length)
    if (!allDone) return
    celebrateCourseCompletion()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, enrollment?.progress_percentage, completedLessonIds, allLessons.length])

  const toggleLessonComplete = () => {
    if (!isCompleted) {
      const settings = mergeGateSettings(
        (module as any)?.metadata,
        (lesson as any)?.metadata
      )
      if (settings.gateNextUntilActivitiesDone && !activityCompleted && mandatoryTotal > 0) {
        alert('Finish mandatory activities for this lesson before marking it complete.')
        return
      }
    }
    void setLessonCompletedState(!isCompleted)
  }

  const markActivityDone = async (activityId: string) => {
    if (!currentUser || !lesson) return
    try {
      setMarkingActivityId(activityId)
      await refreshActivityProgress({ activityId })
    } catch (e: any) {
      console.error('markActivityDone failed:', e)
      alert(e?.message || 'Failed to mark activity done. Please try again.')
    } finally {
      setMarkingActivityId(null)
    }
  }

  const syncAfterQuiz = async (outcome?: {
    passed: boolean
    attemptsExhausted: boolean
  }) => {
    try {
      if (outcome?.passed) {
        await refreshActivityProgress({ action: 'sync' })
      }
    } catch (e) {
      console.log('Quiz activity sync failed (continuing):', e)
    }
  }

  const redoLessonAfterFailedQuiz = async () => {
    setShowQuiz(false)
    if (!currentUser || !lesson) return
    try {
      setSavingProgress(true)
      const payload: any = {
        course_id: courseId,
        completed: false,
        completed_at: null,
        activity_completed: false,
        activity_completed_at: null,
        progress_percentage: 0,
        last_position_seconds: 0,
        last_accessed_at: new Date().toISOString(),
      }
      const db = supabase as any
      if (lessonProgressIdRef.current) {
        await db.from('lesson_progress').update(payload).eq('id', lessonProgressIdRef.current)
      } else {
        const { data: inserted } = await db
          .from('lesson_progress')
          .insert({
            user_id: currentUser.id,
            lesson_id: lessonId,
            time_spent_seconds: 0,
            ...payload,
          })
          .select()
          .single()
        if (inserted) lessonProgressIdRef.current = inserted.id
      }

      // Clear per-activity acknowledgements so mandatory work must be redone
      await db
        .from('lesson_activity_progress')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('lesson_id', lessonId)

      setIsCompleted(false)
      setActivityCompleted(false)
      setMandatoryCompleted(0)
      setActivityProgressById({})
      setVideoWatchSatisfied(!lesson.video_url)
      setCompletedLessonIds((prev) => {
        const next = new Set(prev)
        next.delete(lessonId)
        return next
      })
      setProgressByLesson((prev) => {
        const next = new Map(prev)
        next.set(lessonId, {
          lesson_id: lessonId,
          completed: false,
          activity_completed: false,
        })
        return next
      })
      window.scrollTo({ top: 0, behavior: 'smooth' })
      alert(
        'You have used all quiz attempts. This lesson was reset — review the content, then try the quiz again if your teacher allows more attempts.'
      )
    } catch (e) {
      console.error('redoLessonAfterFailedQuiz failed:', e)
      alert('Could not reset the lesson. Please refresh and try again.')
    } finally {
      setSavingProgress(false)
    }
  }

  const handleThresholdReached = () => {
    if (activeLessonIdRef.current !== lessonId) return
    setVideoWatchSatisfied(true)
  }

  // Latest lesson runtime — video player callbacks stay stable via ref
  const videoEndRuntimeRef = useRef({
    lessonId,
    courseId,
    currentLessonIndex,
    allLessons,
    module,
    lesson,
    isCompleted,
    activityCompleted,
    mandatoryTotal,
    savingProgress,
    setLessonCompletedState,
    router,
  })
  videoEndRuntimeRef.current = {
    lessonId,
    courseId,
    currentLessonIndex,
    allLessons,
    module,
    lesson,
    isCompleted,
    activityCompleted,
    mandatoryTotal,
    savingProgress,
    setLessonCompletedState,
    router,
  }

  const handleVideoEnded = useCallback(() => {
    const ctx = videoEndRuntimeRef.current
    if (activeLessonIdRef.current !== ctx.lessonId) return
    setVideoWatchSatisfied(true)

    void (async () => {
      const settings = mergeGateSettings(
        (ctx.module as any)?.metadata,
        (ctx.lesson as any)?.metadata
      )
      const activitiesDone = ctx.activityCompleted || ctx.mandatoryTotal === 0

      let completedNow = ctx.isCompleted
      if (
        settings.completionMode === 'auto' &&
        activitiesDone &&
        !ctx.isCompleted &&
        !ctx.savingProgress
      ) {
        completedNow = await ctx.setLessonCompletedState(true)
      }

      // Course structure: finish mandatory tasks before jumping ahead
      if (!activitiesDone && ctx.mandatoryTotal > 0) {
        setFocusLearningTab('resources')
        setAutoAdvanceNotice(
          'Video finished — complete the required activities below, then continue.'
        )
        requestAnimationFrame(() => {
          document
            .getElementById('lesson-learning-tabs')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
        return
      }

      const allowed = canGoToNextLesson({
        settings,
        lessonCompleted: completedNow || ctx.isCompleted,
        activityCompleted: activitiesDone,
      })
      if (!allowed) {
        if (settings.gateNextUntilActivitiesDone || settings.sequentialUnlock) {
          setAutoAdvanceNotice(
            'Mark this lesson complete (and finish required activities) before the next lecture unlocks.'
          )
        }
        return
      }

      if (ctx.currentLessonIndex >= ctx.allLessons.length - 1) return
      const nextLesson = ctx.allLessons[ctx.currentLessonIndex + 1]
      if (!nextLesson) return

      clearAutoAdvance()
      setAutoAdvanceNotice('Up next — continuing to the next lecture…')
      autoAdvanceTimerRef.current = setTimeout(() => {
        if (activeLessonIdRef.current !== ctx.lessonId) return
        ctx.router.push(`/learn/${ctx.courseId}/lesson/${nextLesson.id}`)
      }, 1600)
    })()
  }, [])

  // Issue (or fetch existing) certificate; returns the PDF URL if available
  const issueCertificate = async (force = false): Promise<string | null> => {
    try {
      setIssuingCert(true)
      const res = await fetch('/api/certificates/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, force }),
      })
      const json = await res.json().catch(() => ({}))
      const url = json?.certificate?.certificate_url || null
      if (url) setCertificateUrl(url)
      return url
    } catch (e) {
      console.log('Certificate issuance request failed:', e)
      return null
    } finally {
      setIssuingCert(false)
    }
  }

  const celebrateCourseCompletion = (opts?: { force?: boolean }) => {
    if (typeof window !== 'undefined') {
      const key = `pelbu-cert-congrats-${courseId}`
      if (!opts?.force && sessionStorage.getItem(key) === '1') return
      sessionStorage.setItem(key, '1')
    }
    if (congratsShownRef.current && !opts?.force) return
    congratsShownRef.current = true
    clearAutoAdvance()
    setShowCompletionDialog(true)
    if (!certAutoRequestedRef.current) {
      certAutoRequestedRef.current = true
      void issueCertificate(true)
    }
  }

  const handleGetCertificate = async () => {
    const url = (await issueCertificate(true)) || certificateUrl
    if (url) {
      const bust = url.includes('?') ? `${url}&t=${Date.now()}` : `${url}?t=${Date.now()}`
      window.open(bust, '_blank')
    }
  }

  const goToNextLesson = () => {
    clearAutoAdvance()
    const settings = mergeGateSettings(
      (module as any)?.metadata,
      (lesson as any)?.metadata
    )
    const allowed = canGoToNextLesson({
      settings,
      lessonCompleted: isCompleted,
      activityCompleted: activityCompleted || mandatoryTotal === 0,
    })
    if (!allowed) {
      if (settings.gateNextUntilActivitiesDone && !activityCompleted && mandatoryTotal > 0) {
        alert('Finish mandatory activities for this lesson before continuing.')
      } else {
        alert('Complete this lesson before continuing to the next one.')
      }
      return
    }
    if (currentLessonIndex < allLessons.length - 1) {
      const nextLesson = allLessons[currentLessonIndex + 1]
      router.push(`/learn/${courseId}/lesson/${nextLesson.id}`)
    }
  }

  const goToPreviousLesson = () => {
    clearAutoAdvance()
    if (currentLessonIndex > 0) {
      const prevLesson = allLessons[currentLessonIndex - 1]
      router.push(`/learn/${courseId}/lesson/${prevLesson.id}`)
    }
  }

  const goBackToModules = () => {
    router.push('/dashboard')
  }

  const settingsForLesson = (id: string) => {
    const les = allLessons.find((l) => l.id === id)
    const mod = allModules.find((m) => m.id === (les as any)?.module_id) || module
    return mergeGateSettings((mod as any)?.metadata, (les as any)?.metadata)
  }

  const currentGateSettings = mergeGateSettings(
    (module as any)?.metadata,
    (lesson as any)?.metadata
  )

  const resourcesLocked =
    !canViewResourcesAndFlashcards({
      settings: currentGateSettings,
      lessonCompleted: isCompleted,
    }) &&
    // Keep Resources open while mandatory activities are still required (otherwise Auto can't finish)
    !(mandatoryTotal > 0 && !activityCompleted)

  const canProceedToNext = canGoToNextLesson({
    settings: currentGateSettings,
    lessonCompleted: isCompleted,
    activityCompleted,
  })

  const orderedLessonIds = allLessons.map((l) => l.id)
  const lockedLessonIds = new Set(
    orderedLessonIds.filter(
      (id) =>
        !isLessonUnlocked({
          orderedLessonIds,
          targetLessonId: id,
          progressByLesson,
          settingsForLesson,
        })
    )
  )

  const tryOpenLesson = (targetId: string) => {
    if (lockedLessonIds.has(targetId)) {
      alert(
        'This lesson is locked. Complete the previous lesson (and activities if required) first.'
      )
      return
    }
    router.push(`/learn/${courseId}/lesson/${targetId}`)
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
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to dashboard
          </Button>
        </div>
      </div>
    )
  }

  const courseAi = readCourseAiMetadata((course as any)?.metadata)
  const completedCount = allLessons.filter((l) => completedLessonIds.has(l.id)).length
  const progressPercent =
    enrollment?.progress_percentage ??
    (allLessons.length > 0 ? Math.round((completedCount / allLessons.length) * 100) : 0)

  const openQuiz = async (quizId: string) => {
    setShowQuiz(true)
    if (quiz && (quiz as any).id === quizId && quizQuestions.length > 0) return
    const { data: quizRow } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', quizId)
      .maybeSingle()
    if (quizRow) {
      setQuiz(quizRow as any)
      const { data: questionsData } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', quizId)
        .order('order_index', { ascending: true })
      setQuizQuestions(questionsData || [])
    }
  }

  const activitiesExtra = (
    <>
      {!showQuiz && quiz && quizQuestions.length > 0 && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-lg">{(quiz as any).title || 'Lesson quiz'}</CardTitle>
            <CardDescription>
              {(quiz as any).description || 'Check your understanding of this lesson.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="min-h-11 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
              onClick={() => setShowQuiz(true)}
            >
              Start quiz
            </Button>
          </CardContent>
        </Card>
      )}
      {parseLessonBlocks(lesson.content).every((b) => b.type !== 'scenario') && (
        <ScenarioPlayer lessonId={lessonId} />
      )}
      {(enrollment?.progress_percentage || 0) >= 100 && (
        <Card className="glass border-green-600/30">
          <CardContent className="space-y-3 py-6 text-center">
            <CheckCircle className="mx-auto h-8 w-8 text-green-600" />
            <p className="text-sm font-semibold">Course complete!</p>
            <p className="text-xs text-muted-foreground">
              You have earned your certificate of completion.
            </p>
            <Button
              onClick={handleGetCertificate}
              disabled={issuingCert}
              className="w-full bg-bhutan-yellow text-black hover:bg-bhutan-orange"
            >
              {issuingCert ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Preparing...
                </>
              ) : (
                <>
                  <Award className="mr-2 h-4 w-4" />
                  {certificateUrl ? 'Download certificate' : 'Get certificate'}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push(`/certificates/${courseId}`)}
            >
              Open certificate claim page
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  )

  return (
    <div
      className="flex min-h-dvh flex-col bg-background"
      style={
        {
          backgroundColor: courseAi.theme?.background,
          color: courseAi.theme?.body,
          ['--course-primary' as string]: courseAi.theme?.primary,
          ['--course-heading' as string]: courseAi.theme?.heading,
          ['--course-link' as string]: courseAi.theme?.link,
        } as React.CSSProperties
      }
    >
      <CourseCompletionDialog
        open={showCompletionDialog}
        onOpenChange={setShowCompletionDialog}
        courseTitle={course?.title}
        certificateUrl={certificateUrl}
        issuing={issuingCert}
        claimHref={`/certificates/${courseId}`}
        onDownload={() => void handleGetCertificate()}
      />
      <LessonPlayerHeader
        courseTitle={course?.title}
        completedCount={completedCount}
        totalLessons={allLessons.length}
        progressPercent={progressPercent}
        isCompleted={isCompleted}
        savingProgress={savingProgress}
        completeDisabled={
          !isCompleted &&
          currentGateSettings.gateNextUntilActivitiesDone &&
          !activityCompleted
        }
        completeHint={
          !isCompleted &&
          currentGateSettings.gateNextUntilActivitiesDone &&
          !activityCompleted
            ? mandatoryTotal > 0
              ? `Complete mandatory activities (${mandatoryCompleted}/${mandatoryTotal}) before marking this lesson complete.`
              : 'Finish mandatory activities before marking this lesson complete.'
            : null
        }
        onBack={goBackToModules}
        onToggleComplete={toggleLessonComplete}
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="min-w-0 flex-1 overflow-y-auto">
          <LessonContentStage
            lesson={lesson}
            lessonId={lessonId}
            initialPositionSeconds={(lessonProgress as any)?.last_position_seconds || 0}
            onProgress={persistWatchProgress}
            onThresholdReached={handleThresholdReached}
            onEnded={handleVideoEnded}
            canGoPrev={currentLessonIndex > 0}
            canGoNext={
              currentLessonIndex < allLessons.length - 1 && canProceedToNext
            }
            onPrev={goToPreviousLesson}
            onNext={goToNextLesson}
            extraResources={(module as any)?.resources}
            onTakeQuiz={(quizId) => void openQuiz(quizId)}
            progressById={activityProgressById}
            mandatoryTotal={mandatoryTotal}
            mandatoryCompleted={mandatoryCompleted}
            onMarkDone={(id) => void markActivityDone(id)}
            markingActivityId={markingActivityId}
          />
          {autoAdvanceNotice ? (
            <div className="border-b border-bhutan-yellow/40 bg-bhutan-yellow/15 px-4 py-2 text-center text-sm font-medium">
              {autoAdvanceNotice}
            </div>
          ) : null}
          <div className="px-3 py-2 lg:hidden">
            <LessonNextBar
              currentIndex={currentLessonIndex}
              total={allLessons.length}
              currentTitle={allLessons[currentLessonIndex]?.title}
              canGoPrev={currentLessonIndex > 0}
              canGoNext={
                currentLessonIndex < allLessons.length - 1 && canProceedToNext
              }
              onPrev={goToPreviousLesson}
              onNext={goToNextLesson}
            />
          </div>

          {lesson.video_url && parseLessonBlocks(lesson.content).length > 0 && (
            <div className="px-4 py-3">
              <Card className="glass">
                <CardContent className="p-4 sm:p-6">
                  <LessonBlocks
                    content={lesson.content}
                    lessonId={lessonId}
                    onTakeQuiz={(quizId) => void openQuiz(quizId)}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {course && (
            <div id="lesson-learning-tabs" className="border-t px-4 py-4">
              <CourseLearningTabs
                course={course}
                modules={allModules}
                lessons={allLessons}
                currentLessonId={lessonId}
                currentLesson={lesson}
                currentModule={module}
                instructor={instructor}
                videoRef={videoRef}
                userId={currentUser?.id}
                completedLessons={completedLessonIds}
                lockedLessonIds={lockedLessonIds}
                resourcesLocked={resourcesLocked}
                activityCompleted={activityCompleted}
                mandatoryTotal={mandatoryTotal}
                mandatoryCompleted={mandatoryCompleted}
                activityProgressById={activityProgressById}
                focusTab={focusLearningTab}
                markingActivityId={markingActivityId}
                onMarkActivityDone={(id) => void markActivityDone(id)}
                defaultTab="overview"
                activitiesExtra={activitiesExtra}
                onLessonClick={(clickedLessonId) => tryOpenLesson(clickedLessonId)}
                onLessonComplete={(targetLessonId, completed) => {
                  if (targetLessonId === lessonId) {
                    setLessonCompletedState(completed)
                  }
                }}
                moduleResources={(module as any)?.resources}
                onTakeQuiz={(quizId) => void openQuiz(quizId)}
              />
            </div>
          )}

          {showQuiz && quiz && (
            <QuizPlayer
              quizId={(quiz as any).id}
              lessonId={lessonId}
              courseId={courseId}
              quizData={quiz as any}
              questionsData={quizQuestions}
              onClose={() => setShowQuiz(false)}
              onComplete={(outcome) => void syncAfterQuiz(outcome)}
              onRedoLesson={() => void redoLessonAfterFailedQuiz()}
            />
          )}
        </div>

        <CurriculumRail
          lessons={allLessons}
          modules={allModules}
          currentLessonId={lesson.id}
          completedLessonIds={completedLessonIds}
          lockedLessonIds={lockedLessonIds}
          onSelect={tryOpenLesson}
          className="border-t lg:h-[calc(100dvh-3.5rem)] lg:w-[380px] lg:shrink-0 lg:border-l lg:border-t-0"
        />
      </div>

      {courseAi.tutor?.enabled !== false && (
        <GeminiTutor
          courseId={courseId}
          lessonId={lessonId}
          floating
          name={courseAi.tutor?.name || 'Course tutor'}
          photoUrl={courseAi.tutor?.photoUrl}
        />
      )}
    </div>
  )
}