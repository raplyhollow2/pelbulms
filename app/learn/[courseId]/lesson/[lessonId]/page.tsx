// @ts-nocheck — existing Supabase and UI type drift; remove when database types are regenerated.
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2, CheckCircle, Award } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'
import { QuizPlayer } from '@/components/quiz/quiz-player'
import { ScenarioPlayer } from '@/components/learning/scenario-player'
import { CoursePlayerRail } from '@/components/learning/course-player-rail'
import { LessonPlayerHeader } from '@/components/learning/lesson-player-header'
import { LessonNextBar } from '@/components/learning/lesson-next-bar'
import { CourseLearningTabs } from '@/components/course/course-learning-tabs'
import { loadCourseFacilitators, type CourseFacilitator } from '@/lib/course-facilitators'
import { LessonContentStage } from '@/components/learning/lesson-content-stage'
import { CourseCompletionDialog } from '@/components/learning/course-completion-dialog'
import { lessonIsFreePreview, lessonIsPublished } from '@/lib/lesson-visibility'
import { type VideoProgressData } from '@/components/learning/tracked-video-player'
import { parseLessonBlocks, readCourseAiMetadata } from '@/lib/lesson-blocks'
import {
  mergeGateSettings,
  canViewResourcesAndFlashcards,
  canGoToNextLesson,
  isLessonUnlocked,
  type LessonProgressLite,
} from '@/lib/progression-gates'
import {
  describeCompletionBlockers,
  type CompletionBlocker,
} from '@/lib/activity-responses'
import { VIDEO_COMPLETE_PERCENT } from '@/lib/lesson-completion-sync'

type Course = Database['public']['Tables']['courses']['Row']
type Module = Database['public']['Tables']['modules']['Row']
type Lesson = Database['public']['Tables']['lessons']['Row']
type Enrollment = Database['public']['Tables']['enrollments']['Row']
type Note = Database['public']['Tables']['notes']['Row']
type LessonProgress = Database['public']['Tables']['lesson_progress']['Row']
type Quiz = Database['public']['Tables']['quizzes']['Row']

const LESSON_SIDEBAR_COLUMNS =
  'id, module_id, title, description, duration_minutes, order_index, is_published, is_free, is_preview, metadata, resources'
const MODULE_COLUMNS =
  'id, course_id, title, description, order_index, is_published, metadata, resources'
const COURSE_PLAYER_COLUMNS =
  'id, title, description, level, category, language, duration_minutes, updated_at, instructor_id, is_published, learning_objectives, requirements, metadata'
const NOTE_COLUMNS =
  'id, user_id, lesson_id, course_id, content, timestamp, is_deleted, created_at, updated_at'
const PROGRESS_COLUMNS =
  'id, lesson_id, completed, activity_completed, time_spent_seconds, last_position_seconds'

function lessonPlayerPath(
  courseId: string,
  targetLessonId: string,
  preview: boolean,
  hash?: string
) {
  const query = preview ? '?preview=1' : ''
  const fragment = hash ? `#${hash}` : ''
  return `/learn/${courseId}/lesson/${targetLessonId}${query}${fragment}`
}

async function userCanPreviewCourse(courseId: string) {
  try {
    const res = await fetch(`/api/teach/courses/${courseId}/preview-access`)
    if (!res.ok) return false
    const body = await res.json()
    return Boolean(body.preview)
  } catch {
    return false
  }
}

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
  const [instructors, setInstructors] = useState<CourseFacilitator[]>([])
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)

  // Progress tracking state
  const [lessonProgress, setLessonProgress] = useState<LessonProgress | null>(null)
  const [isCompleted, setIsCompleted] = useState(false)
  const [activityCompleted, setActivityCompleted] = useState(false)
  const [mandatoryTotal, setMandatoryTotal] = useState(0)
  const [mandatoryCompleted, setMandatoryCompleted] = useState(0)
  const [activityBlockers, setActivityBlockers] = useState<CompletionBlocker[]>([])
  const [completionHold, setCompletionHold] = useState<string | null>(null)
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
  const [focusActivityId, setFocusActivityId] = useState<string | null>(null)
  const [staffPreview, setStaffPreview] = useState(false)
  const [freePreview, setFreePreview] = useState(false)
  const previewRef = useRef(false)
  const skipProgressRef = useRef(false)
  const [autoAdvanceNotice, setAutoAdvanceNotice] = useState<string | null>(null)
  const [showCompletionDialog, setShowCompletionDialog] = useState(false)
  const lessonProgressIdRef = useRef<string | null>(null)
  const timeSpentBaseRef = useRef(0)
  const certAutoRequestedRef = useRef(false)
  const congratsShownRef = useRef(false)
  const completingLessonRef = useRef(false)
  const autoCompleteLockRef = useRef<string | null>(null)
  const activeLessonIdRef = useRef(lessonId)
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const congratsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
    setFocusActivityId(null)
    lessonProgressIdRef.current = null
    completingLessonRef.current = false
    clearAutoAdvance()
    if (congratsTimerRef.current) {
      clearTimeout(congratsTimerRef.current)
      congratsTimerRef.current = null
    }
  }, [lessonId])

  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current)
      if (congratsTimerRef.current) clearTimeout(congratsTimerRef.current)
    }
  }, [])

  useEffect(() => {
    fetchLessonData()
  }, [courseId, lessonId])

  useEffect(() => {
    if (loading || !lesson) return
    const activityId = activityIdFromHash(window.location.hash)
    if (!activityId) return
    setFocusActivityId(activityId)
    setFocusLearningTab('resources')
    const timer = window.setTimeout(() => scrollActivityIntoView(activityId), 280)
    return () => window.clearTimeout(timer)
  }, [loading, lessonId, lesson])

  // If sequential unlock is enabled and this lesson isn't open yet, bounce back (no alert spam)
  useEffect(() => {
    if (staffPreview || freePreview || loading || !lesson || allLessons.length === 0) return
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
  }, [staffPreview, freePreview, loading, lessonId, allLessons, progressByLesson, module, allModules])

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

      const previewRequested =
        new URLSearchParams(window.location.search).get('preview') === '1'

      const [enrollmentResult, lessonResult, modulesResult, courseResult, progressResult, courseProgressResult, notesResult, activityRes] =
        await Promise.all([
          supabase
            .from('enrollments')
            .select('id, status, progress_percentage, user_id, course_id')
            .eq('user_id', user.id)
            .eq('course_id', courseId)
            .maybeSingle(),
          supabase.from('lessons').select('*').eq('id', lessonId).single(),
          supabase
            .from('modules')
            .select(MODULE_COLUMNS)
            .eq('course_id', courseId)
            .order('order_index', { ascending: true }),
          supabase.from('courses').select(COURSE_PLAYER_COLUMNS).eq('id', courseId).single(),
          supabase
            .from('lesson_progress')
            .select(PROGRESS_COLUMNS)
            .eq('user_id', user.id)
            .eq('lesson_id', lessonId)
            .maybeSingle(),
          supabase
            .from('lesson_progress')
            .select('lesson_id, completed, activity_completed')
            .eq('user_id', user.id)
            .eq('course_id', courseId),
          supabase
            .from('notes')
            .select(NOTE_COLUMNS)
            .eq('user_id', user.id)
            .eq('lesson_id', lessonId)
            .eq('is_deleted', false)
            .order('created_at', { ascending: false }),
          fetch(`/api/lessons/${lessonId}/activity-progress`).catch(() => null),
        ])

      const { data: lessonData, error: lessonError } = lessonResult
      if (lessonError) throw lessonError
      if (!lessonData) {
        router.push('/dashboard')
        return
      }

      const enrollmentData = enrollmentResult.data
      const status = (enrollmentData as any)?.status
      const enrolled =
        Boolean(enrollmentData) && (status === 'active' || status === 'completed')
      const moduleList = (modulesResult.data || []) as Module[]
      const moduleIds = moduleList.map((row) => row.id)
      const instructorId = (courseResult.data as { instructor_id?: string } | null)?.instructor_id
      const needsPreview = previewRequested || !enrolled

      const [canPreview, sidebarResult, quizListResult, facilitators] = await Promise.all([
        needsPreview ? userCanPreviewCourse(courseId) : Promise.resolve(false),
        moduleIds.length > 0
          ? supabase
              .from('lessons')
              .select(LESSON_SIDEBAR_COLUMNS)
              .in('module_id', moduleIds)
              .order('order_index', { ascending: true })
          : Promise.resolve({ data: [] as Lesson[] }),
        supabase
          .from('quizzes')
          .select('id, title, description, lesson_id, is_published, time_limit_minutes, passing_score, max_attempts')
          .eq('lesson_id', lessonId)
          .order('created_at', { ascending: true })
          .limit(5),
        loadCourseFacilitators(supabase, courseId, instructorId).catch(() => [] as CourseFacilitator[]),
      ])

      // Course staff can open a draft without enrolling. The Preview button
      // also forces that read-only view so progress is not written.
      const managing = canPreview && needsPreview
      previewRef.current = managing
      skipProgressRef.current = managing
      setStaffPreview(managing)
      setFreePreview(false)

      if (!managing && (courseResult.data as { is_published?: boolean } | null)?.is_published !== true) {
        alert('This course is no longer available.')
        router.push('/dashboard')
        return
      }

      const lessonRow = lessonData as Lesson
      const publishedLesson = lessonIsPublished(lessonRow)
      const freePreviewLesson = publishedLesson && lessonIsFreePreview(lessonRow)
      const guestPreview = !managing && !enrolled && freePreviewLesson

      if (!managing && !publishedLesson) {
        const nextId = ((sidebarResult.data || []) as Lesson[]).find((row) => lessonIsPublished(row))?.id
        alert('This lesson is not published yet.')
        if (nextId && nextId !== lessonId) {
          router.replace(`/learn/${courseId}/lesson/${nextId}`)
        } else {
          router.push(`/courses/${courseId}`)
        }
        return
      }

      if (!managing && !enrolled && !guestPreview) {
        if (status === 'pending') {
          alert('Your enrollment is waiting for the course creator to approve.')
        } else {
          alert('You need to enroll in this course first.')
        }
        router.push(`/courses/${courseId}`)
        return
      }

      skipProgressRef.current = managing || guestPreview
      setFreePreview(guestPreview)
      if (managing || guestPreview) {
        setEnrollment(null)
      } else {
        setEnrollment(enrollmentData)
        void (supabase as any)
          .from('enrollments')
          .update({
            last_lesson_id: lessonId,
            last_accessed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', (enrollmentData as any).id)
          .then(() => undefined, () => undefined)
      }

      setLesson(lessonRow)
      setIsCompleted(false)
      setVideoWatchSatisfied(!lessonRow.video_url)

      const modulesData = modulesResult.data
      if (modulesData) {
        setAllModules(modulesData as Module[])
        const moduleData = (modulesData as Module[]).find((m) => m.id === lessonRow.module_id)
        if (moduleData) setModule(moduleData)
      }

      const courseData = courseResult.data
      const quizRows = (quizListResult.data || []) as Array<{ id: string; is_published?: boolean | null }>
      const quizData = managing
        ? quizRows[0]
        : quizRows.find((row) => row.is_published === true)
      const progressData = managing || guestPreview ? null : progressResult.data
      const questionsResult = quizData
        ? await fetch(`/api/quizzes/${quizData.id}/play`).then(async (res) => {
            const payload = await res.json().catch(() => ({}))
            return { data: res.ok ? payload.questions || [] : [] }
          })
        : { data: [] as unknown[] }

      if (courseData) setCourse(courseData as Course)
      setInstructors(facilitators)

      const sidebarLessons = ((sidebarResult.data || []) as Lesson[]).filter((row) => {
        if (managing) return true
        if (!lessonIsPublished(row)) return false
        if (guestPreview) return lessonIsFreePreview(row)
        return true
      })
      const courseLessons = sidebarLessons.map((row) =>
        row.id === lessonRow.id ? ({ ...row, ...lessonRow } as Lesson) : row
      )
      if (moduleList.length > 0) {
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

      let thisLessonCompleted = false
      try {
        if (progressData) {
          const pd = progressData as any
          thisLessonCompleted = Boolean(pd.completed)
          setLessonProgress(pd as LessonProgress)
          setIsCompleted(thisLessonCompleted)
          setActivityCompleted(Boolean(pd.activity_completed))
          lessonProgressIdRef.current = pd.id
          timeSpentBaseRef.current = pd.time_spent_seconds || 0
          setVideoWatchSatisfied(
            !lessonRow.video_url || (pd.progress_percentage || 0) >= VIDEO_COMPLETE_PERCENT
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
          setVideoWatchSatisfied(!lessonRow.video_url)
        }
      } catch (progressError) {
        console.log('Lesson progress fetch error (continuing anyway):', progressError)
      }

      try {
        if (managing) {
          setProgressByLesson(new Map())
          setCompletedLessonIds(new Set())
        } else {
        const courseProgress = courseProgressResult.data
        const courseProgressError = courseProgressResult.error

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
        }
      } catch (e) {
        console.log('Course progress fetch error (continuing anyway):', e)
      }

      if (notesResult.data) setNotes(notesResult.data)

      if (quizListResult.error) {
        console.log('Quiz fetch error:', quizListResult.error)
      }
      if (quizData) {
        setQuiz(quizData as any)
        const questionsData = questionsResult.data
        if (questionsData && questionsData.length > 0) setQuizQuestions(questionsData)
      } else {
        setQuiz(null)
        setQuizQuestions([])
      }

      try {
        if (!managing && !guestPreview && activityRes && activityRes.ok) {
          const data = await activityRes.json()
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
    const map: Record<
      string,
      {
        id: string
        completed?: boolean
        source?: string | null
        response?: any
        status?: string | null
        grade?: number | null
        max_grade?: number | null
        feedback?: string | null
        return_file_url?: string | null
        return_file_name?: string | null
        return_url?: string | null
        graded_at?: string | null
        submitted_at?: string | null
        chatMessages?: { userId: string; message: string; at?: string }[]
        choiceTallies?: Record<string, number> | null
      }
    > = {}
    for (const a of data.activities || []) {
      map[a.id] = {
        id: a.id,
        completed: Boolean(a.completed),
        source: a.source || null,
        response: a.response || null,
        status: a.status || null,
        grade: a.grade ?? null,
        max_grade: a.max_grade ?? null,
        feedback: a.feedback || null,
        return_file_url: a.return_file_url || null,
        return_file_name: a.return_file_name || null,
        return_url: a.return_url || null,
        graded_at: a.graded_at || null,
        submitted_at: a.submitted_at || null,
        chatMessages: a.chatMessages || [],
        choiceTallies: a.choiceTallies || null,
      }
    }
    setActivityProgressById(map)
    setMandatoryTotal(Number(data.mandatoryTotal) || 0)
    setMandatoryCompleted(Number(data.mandatoryCompleted) || 0)
    const blockers = (data.blockers || []) as CompletionBlocker[]
    setActivityBlockers(blockers)
    const done = Boolean(data.activityCompleted)
    setActivityCompleted(done)
    const lessonDone =
      typeof data.lessonCompleted === 'boolean' ? data.lessonCompleted : undefined
    if (lessonDone === true) setIsCompleted(true)
    if (lessonDone === false) setIsCompleted(false)
    setProgressByLesson((prev) => {
      const next = new Map(prev)
      const cur = next.get(lessonId)
      next.set(lessonId, {
        lesson_id: lessonId,
        completed:
          lessonDone ??
          (Boolean(cur?.completed) || completedLessonIds.has(lessonId)),
        activity_completed: done,
      })
      return next
    })
    if (lessonDone === false) {
      setCompletedLessonIds((prev) => {
        const next = new Set(prev)
        next.delete(lessonId)
        return next
      })
    } else if (lessonDone === true) {
      setCompletedLessonIds((prev) => {
        const next = new Set(prev)
        next.add(lessonId)
        return next
      })
    }
    if ((data.courseBlockers || []).length > 0 || lessonDone === false) {
      const requestedLessonId = lessonId
      const requestedCourseId = courseId
      void (async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user || activeLessonIdRef.current !== requestedLessonId) return
        const { data: courseProgress } = await supabase
          .from('lesson_progress')
          .select('lesson_id, completed, activity_completed')
          .eq('user_id', user.id)
          .eq('course_id', requestedCourseId)
        if (activeLessonIdRef.current !== requestedLessonId) return
        if (courseProgress) {
          const map = new Map<string, LessonProgressLite>()
          for (const row of courseProgress as any[]) {
            map.set(row.lesson_id, {
              lesson_id: row.lesson_id,
              completed: Boolean(row.completed),
              activity_completed: Boolean(row.activity_completed),
            })
          }
          setProgressByLesson(map)
          setCompletedLessonIds(
            new Set(
              (courseProgress as any[])
                .filter((row) => row.completed)
                .map((row) => row.lesson_id as string)
            )
          )
          const current = (courseProgress as any[]).find(
            (row) => row.lesson_id === requestedLessonId
          )
          if (current) setIsCompleted(Boolean(current.completed))
        }
        const { data: updatedEnrollment } = await supabase
          .from('enrollments')
          .select('*')
          .eq('user_id', user.id)
          .eq('course_id', requestedCourseId)
          .maybeSingle()
        if (activeLessonIdRef.current !== requestedLessonId) return
        if (updatedEnrollment) setEnrollment(updatedEnrollment)
      })()
    }
  }

  const refreshActivityProgress = async (opts?: {
    action?: 'sync' | 'ack' | 'submit'
    activityId?: string
    response?: Record<string, unknown>
  }) => {
    try {
      if (opts?.activityId || opts?.action === 'sync') {
        const res = await fetch(`/api/lessons/${lessonId}/activity-progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            opts.activityId
              ? {
                  activityId: opts.activityId,
                  action: opts.action || (opts.response ? 'submit' : 'ack'),
                  response: opts.response,
                }
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
    if (skipProgressRef.current) return
    if (!currentUser || !lesson) return
    if (data.percent >= VIDEO_COMPLETE_PERCENT && activeLessonIdRef.current === lessonId) {
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
    if (skipProgressRef.current) return false
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
      const wasBelowComplete = ((enrollment as any)?.progress_percentage ?? 0) < 100
      const { data: updatedEnrollment } = await supabase
        .from('enrollments')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('course_id', courseId)
        .maybeSingle()

      if (updatedEnrollment) {
        setEnrollment(updatedEnrollment)
        const nowComplete = ((updatedEnrollment as any).progress_percentage ?? 0) >= 100
        if (wasBelowComplete && nowComplete) {
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
    if (autoCompleteLockRef.current === lessonId) return
    autoCompleteLockRef.current = lessonId
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
    // celebrateCourseCompletion reads session storage and refs; listing it would retrigger every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, enrollment?.progress_percentage, completedLessonIds, allLessons.length])

  const activityHoldMessage = () => {
    if (activityCompleted || mandatoryTotal === 0) return null
    return (
      describeCompletionBlockers(activityBlockers) ||
      'Finish mandatory activities for this lesson before continuing.'
    )
  }

  const toggleLessonComplete = () => {
    if (!isCompleted) {
      if (!activityCompleted && mandatoryTotal > 0) {
        alert(
          activityHoldMessage() ||
            'Finish mandatory activities for this lesson before marking it complete.'
        )
        return
      }
    }
    void setLessonCompletedState(!isCompleted)
  }

  const markActivityDone = async (activityId: string) => {
    if (skipProgressRef.current) {
      alert('This is a preview. Activity progress is not saved.')
      return
    }
    if (!currentUser || !lesson) return
    try {
      setMarkingActivityId(activityId)
      await refreshActivityProgress({ activityId, action: 'ack' })
    } catch (e: any) {
      console.error('markActivityDone failed:', e)
      alert(e?.message || 'Failed to mark activity done. Please try again.')
    } finally {
      setMarkingActivityId(null)
    }
  }

  const submitActivityResponse = async (
    activityId: string,
    response: Record<string, unknown>
  ) => {
    if (skipProgressRef.current) {
      alert('This is a preview. Submissions are not saved.')
      return
    }
    if (!currentUser || !lesson) return
    try {
      setMarkingActivityId(activityId)
      await refreshActivityProgress({
        activityId,
        action: 'submit',
        response,
      })
    } catch (e: any) {
      console.error('submitActivityResponse failed:', e)
      alert(e?.message || 'Failed to submit. Please try again.')
      throw e
    } finally {
      setMarkingActivityId(null)
    }
  }

  const syncAfterQuiz = async (outcome?: {
    passed: boolean
    attemptsExhausted: boolean
  }) => {
    try {
      if (outcome?.passed && !skipProgressRef.current) {
        await refreshActivityProgress({ action: 'sync' })
      }
    } catch (e) {
      console.log('Quiz activity sync failed (continuing):', e)
    }
  }

  const redoLessonAfterFailedQuiz = async () => {
    setShowQuiz(false)
    if (skipProgressRef.current) return
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

      // Clear quiz / ack progress so mandatory quiz work must be redone.
      // Preserve assessable submissions (assignment files, written responses) for grading recovery.
      await db
        .from('lesson_activity_progress')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('lesson_id', lessonId)
        .in('source', ['ack', 'quiz_pass', 'choice', 'chat'])

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
    holdMessage: activityHoldMessage(),
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
    holdMessage: activityHoldMessage(),
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
          ctx.holdMessage ||
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
            ctx.holdMessage ||
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
        ctx.router.push(lessonPlayerPath(ctx.courseId, nextLesson.id, previewRef.current))
      }, 1600)
    })()
  }, [])

  const issueCertificate = async (
    force = false
  ): Promise<{ url: string | null; pending: boolean; error?: string }> => {
    try {
      setIssuingCert(true)
      const res = await fetch('/api/certificates/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, force }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.completionPending) {
        const message =
          json.error || 'Course completion is waiting on a passing grade.'
        if (json.code === 'grading_required' || json.completionPending) {
          setCompletionHold(message)
          setShowCompletionDialog(false)
        }
        return { url: null, pending: true, error: message }
      }
      const url = json?.certificate?.certificate_url || null
      if (url) {
        setCertificateUrl(url)
        setCompletionHold(null)
      }
      return { url, pending: false }
    } catch (e) {
      console.log('Certificate issuance request failed:', e)
      return { url: null, pending: false }
    } finally {
      setIssuingCert(false)
    }
  }

  const celebrateCourseCompletion = (opts?: { force?: boolean }) => {
    if (typeof window !== 'undefined') {
      const key = `pelbu-cert-congrats-${courseId}`
      if (!opts?.force && sessionStorage.getItem(key) === '1') return
    }
    if (congratsShownRef.current && !opts?.force) return
    if ((certAutoRequestedRef.current || congratsTimerRef.current) && !opts?.force) return
    if (opts?.force && congratsTimerRef.current) {
      clearTimeout(congratsTimerRef.current)
      congratsTimerRef.current = null
    }

    certAutoRequestedRef.current = true
    congratsTimerRef.current = setTimeout(() => {
      congratsTimerRef.current = null
      if (congratsShownRef.current && !opts?.force) {
        return
      }
      void (async () => {
        const result = await issueCertificate(Boolean(opts?.force))
        if (!result.url) {
          // A grading hold stays until the learner finishes the required work.
          // Other failures clear the lock so a later completion crossing can retry.
          if (!result.pending) certAutoRequestedRef.current = false
          return
        }
        if (congratsShownRef.current && !opts?.force) {
          certAutoRequestedRef.current = false
          return
        }
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(`pelbu-cert-congrats-${courseId}`, '1')
        }
        congratsShownRef.current = true
        clearAutoAdvance()
        setShowCompletionDialog(true)
      })()
    }, 4000)
  }

  const handleGetCertificate = async () => {
    const result = await issueCertificate(true)
    const url = result.url || certificateUrl
    if (url && !result.pending) {
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
      const hold = activityHoldMessage()
      if (settings.gateNextUntilActivitiesDone && !activityCompleted && mandatoryTotal > 0) {
        alert(hold || 'Finish mandatory activities for this lesson before continuing.')
      } else if (hold && (settings.gateNextUntilActivitiesDone || settings.sequentialUnlock)) {
        alert(hold)
      } else {
        alert('Complete this lesson before continuing to the next one.')
      }
      return
    }
    if (currentLessonIndex < allLessons.length - 1) {
      const nextLesson = allLessons[currentLessonIndex + 1]
      router.push(lessonPlayerPath(courseId, nextLesson.id, previewRef.current))
    }
  }

  const goToPreviousLesson = () => {
    clearAutoAdvance()
    if (currentLessonIndex > 0) {
      const prevLesson = allLessons[currentLessonIndex - 1]
      router.push(lessonPlayerPath(courseId, prevLesson.id, previewRef.current))
    }
  }

  const goBackToModules = () => {
    if (previewRef.current) {
      router.push(`/teach/courses/${courseId}/studio`)
      return
    }
    if (freePreview) {
      router.push(`/courses/${courseId}`)
      return
    }
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
    !staffPreview &&
    !freePreview &&
    !canViewResourcesAndFlashcards({
      settings: currentGateSettings,
      lessonCompleted: isCompleted,
    }) &&
    // Keep Resources open while mandatory activities are still required (otherwise Auto can't finish)
    !(mandatoryTotal > 0 && !activityCompleted)

  const canProceedToNext = staffPreview || freePreview || canGoToNextLesson({
    settings: currentGateSettings,
    lessonCompleted: isCompleted,
    activityCompleted,
  })

  const orderedLessonIds = allLessons.map((l) => l.id)
  const lockedLessonIds = new Set(
    staffPreview
      ? []
      : orderedLessonIds.filter(
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
    if (targetId === lessonId) {
      if (window.location.hash.startsWith('#item-')) {
        window.history.replaceState(
          null,
          '',
          `${window.location.pathname}${window.location.search}`
        )
      }
      setFocusActivityId(null)
      return
    }
    router.push(lessonPlayerPath(courseId, targetId, previewRef.current))
  }

  const tryOpenActivity = (targetId: string, activityId: string) => {
    if (lockedLessonIds.has(targetId)) {
      alert(
        'This lesson is locked. Complete the previous lesson (and activities if required) first.'
      )
      return
    }
    const hash = `item-${encodeURIComponent(activityId)}`
    if (targetId !== lessonId) {
      router.push(lessonPlayerPath(courseId, targetId, previewRef.current, hash))
      return
    }
    const nextUrl = `${window.location.pathname}${window.location.search}#${hash}`
    window.history.replaceState(null, '', nextUrl)
    setFocusActivityId(activityId)
    setFocusLearningTab('resources')
    window.setTimeout(() => scrollActivityIntoView(activityId), 280)
  }

  const completedActivityIds = new Set(
    Object.entries(activityProgressById)
      .filter(([, row]) => row.completed)
      .map(([id]) => id)
  )

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
      const res = await fetch(`/api/quizzes/${quizId}/play`)
      const payload = await res.json().catch(() => ({}))
      setQuizQuestions(res.ok ? payload.questions || [] : [])
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
    </>
  )

  const certificateSection =
    progressPercent >= 100 ? (
      <div className="px-4 py-3">
        <Card className="glass border-green-600/30">
          <CardContent className="space-y-3 py-6 text-center">
            <CheckCircle className="mx-auto h-8 w-8 text-green-600" />
            <p className="text-sm font-semibold">Course complete!</p>
            <p className="text-xs text-muted-foreground">
              You have earned your certificate of completion.
            </p>
            <Button
              className="w-full bg-bhutan-yellow text-black hover:bg-bhutan-orange"
              onClick={() => router.push(`/certificates/${courseId}`)}
            >
              <Award className="mr-2 h-4 w-4" />
              Open Certificate Claim Page
            </Button>
          </CardContent>
        </Card>
      </div>
    ) : null

  return (
    <div
      className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-background"
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
      {staffPreview ? (
        <div className="shrink-0 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-950 dark:text-amber-100">
          Preview. This is the learner lesson, including unpublished pages. Nothing you do here is saved.
        </div>
      ) : freePreview ? (
        <div className="shrink-0 border-b border-bhutan-yellow/50 bg-bhutan-yellow/15 px-4 py-2 text-sm">
          Free preview. Enroll to open the rest of this course. Nothing you do here is saved.
        </div>
      ) : null}
      <LessonPlayerHeader
        courseTitle={course?.title}
        completedCount={completedCount}
        totalLessons={allLessons.length}
        progressPercent={progressPercent}
        isCompleted={isCompleted}
        savingProgress={savingProgress}
        completeDisabled={!isCompleted && !activityCompleted && mandatoryTotal > 0}
        completeHint={
          !isCompleted && !activityCompleted && mandatoryTotal > 0
            ? activityHoldMessage()
            : null
        }
        onBack={goBackToModules}
        onToggleComplete={toggleLessonComplete}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <div className="min-w-0 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
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
            onSubmitResponse={(id, response) => void submitActivityResponse(id, response)}
            markingActivityId={markingActivityId}
            highlightActivityId={focusActivityId}
          />
          {completionHold ? (
            <div className="border-b border-amber-600/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-900 dark:text-amber-200">
              {completionHold}
            </div>
          ) : null}
          {autoAdvanceNotice ? (
            <div className="border-b border-bhutan-yellow/40 bg-bhutan-yellow/15 px-4 py-2 text-center text-sm font-medium">
              {autoAdvanceNotice}
            </div>
          ) : null}
          {certificateSection}
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

          {course && (
            <div id="lesson-learning-tabs" className="border-t px-4 py-4">
              <CourseLearningTabs
                key={lessonId}
                course={course}
                modules={allModules}
                lessons={allLessons}
                currentLessonId={lessonId}
                currentLesson={lesson}
                currentModule={module}
                instructor={instructors[0] || null}
                instructors={instructors}
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
                onSubmitActivityResponse={(id, response) =>
                  void submitActivityResponse(id, response)
                }
                defaultTab={
                  parseLessonBlocks(lesson.content).length > 0 ? 'resources' : 'overview'
                }
                activitiesExtra={activitiesExtra}
                onLessonClick={(clickedLessonId) => tryOpenLesson(clickedLessonId)}
                onLessonComplete={(targetLessonId, completed) => {
                  if (targetLessonId === lessonId) {
                    setLessonCompletedState(completed)
                  }
                }}
                moduleResources={(module as any)?.resources}
                onTakeQuiz={(quizId) => void openQuiz(quizId)}
                highlightActivityId={focusActivityId}
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
              readOnly={staffPreview || freePreview}
            />
          )}
        </div>

        <CoursePlayerRail
          assistantEnabled={courseAi.tutor?.enabled !== false}
          courseId={courseId}
          tutorName={courseAi.tutor?.name || 'Course tutor'}
          starterPrompts={courseAi.tutor?.starterPrompts}
          lessons={allLessons}
          modules={allModules}
          currentLessonId={lesson.id}
          completedLessonIds={completedLessonIds}
          lockedLessonIds={lockedLessonIds}
          onSelect={tryOpenLesson}
          onSelectActivity={tryOpenActivity}
          activeActivityId={focusActivityId}
          completedActivityIds={completedActivityIds}
          className="h-auto max-h-none overflow-visible border-t lg:h-full lg:max-h-full lg:min-h-0 lg:w-[380px] lg:shrink-0 lg:overflow-hidden lg:border-l lg:border-t-0"
        />
      </div>
    </div>
  )
}

function activityIdFromHash(hash: string) {
  if (!hash.startsWith('#item-')) return null
  try {
    return decodeURIComponent(hash.slice('#item-'.length)) || null
  } catch {
    return null
  }
}

function scrollActivityIntoView(itemKey: string) {
  let attempts = 0
  const tick = () => {
    const escaped =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(itemKey)
        : itemKey.replace(/"/g, '')
    const el = document.querySelector(`[data-curriculum-item="${escaped}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    attempts += 1
    if (attempts < 8) window.setTimeout(tick, 120)
  }
  tick()
}