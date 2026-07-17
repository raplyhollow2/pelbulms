'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Loader2, CheckCircle, Circle, Clock, Award, BookOpen,
  Calendar, TrendingUp, ShieldCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Course = Database['public']['Tables']['courses']['Row']
type Module = Database['public']['Tables']['modules']['Row']
type Lesson = Database['public']['Tables']['lessons']['Row']

interface LessonRow {
  lesson: Lesson
  completed: boolean
  completedAt: string | null
  timeSpent: number
  progressPercent: number
  quizScore: number | null
  quizPassed: boolean | null
}

export default function StudentDetailPage() {
  const router = useRouter()
  const params = useParams()
  const courseId = params.courseId as string
  const studentId = params.studentId as string

  const [loading, setLoading] = useState(true)
  const [course, setCourse] = useState<Course | null>(null)
  const [student, setStudent] = useState<any>(null)
  const [enrollment, setEnrollment] = useState<any>(null)
  const [certificate, setCertificate] = useState<any>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [lessonRows, setLessonRows] = useState<Record<string, LessonRow[]>>({})
  const [totals, setTotals] = useState({ total: 0, done: 0, timeSpent: 0 })

  const supabase = createClient()

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, studentId])

  const fetchData = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }

      const { data: courseData } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single()

      if (!courseData) {
        router.push('/teach/dashboard')
        return
      }

      // Authorize: instructor of this course (admins bypass via RLS/service in prod)
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      const isAdmin = (profile as any)?.role === 'admin' || (profile as any)?.role === 'superadmin'
      if ((courseData as any).instructor_id !== user.id && !isAdmin) {
        alert('Access denied.')
        router.push('/teach/dashboard')
        return
      }
      setCourse(courseData)

      // Enrollment (also carries the student's profile via join)
      const { data: enrollmentData } = await supabase
        .from('enrollments')
        .select('*, profiles(*)')
        .eq('course_id', courseId)
        .eq('user_id', studentId)
        .maybeSingle()

      if (enrollmentData) {
        setEnrollment(enrollmentData)
        setStudent((enrollmentData as any).profiles)
      }

      // Modules + published lessons
      const { data: modulesData } = await supabase
        .from('modules')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index', { ascending: true })

      setModules(modulesData || [])

      const moduleIds = (modulesData || []).map((m: any) => m.id)
      let lessonsData: any[] = []
      if (moduleIds.length > 0) {
        const { data } = await supabase
          .from('lessons')
          .select('*')
          .in('module_id', moduleIds)
          .eq('is_published', true)
          .order('order_index', { ascending: true })
        lessonsData = data || []
      }

      // Student progress for this course
      const { data: progressData } = await supabase
        .from('lesson_progress')
        .select('*')
        .eq('user_id', studentId)
        .eq('course_id', courseId)

      const progressByLesson = new Map<string, any>()
      ;(progressData || []).forEach((p: any) => progressByLesson.set(p.lesson_id, p))

      // Quiz attempts (best per quiz) keyed by lesson
      const lessonIds = lessonsData.map((l) => l.id)
      const quizByLesson = new Map<string, string>()
      const attemptByLesson = new Map<string, { score: number; passed: boolean }>()
      if (lessonIds.length > 0) {
        const { data: quizzes } = await supabase
          .from('quizzes')
          .select('id, lesson_id')
          .in('lesson_id', lessonIds)

        const quizIds = (quizzes || []).map((q: any) => {
          quizByLesson.set(q.lesson_id, q.id)
          return q.id
        })

        if (quizIds.length > 0) {
          const { data: attempts } = await supabase
            .from('quiz_attempts')
            .select('quiz_id, score, passed')
            .eq('user_id', studentId)
            .in('quiz_id', quizIds)

          const quizToLesson = new Map<string, string>()
          quizByLesson.forEach((qid, lid) => quizToLesson.set(qid, lid))
          ;(attempts || []).forEach((a: any) => {
            const lid = quizToLesson.get(a.quiz_id)
            if (!lid) return
            const prev = attemptByLesson.get(lid)
            if (!prev || a.score > prev.score) {
              attemptByLesson.set(lid, { score: a.score, passed: a.passed })
            }
          })
        }
      }

      // Build grouped rows
      const grouped: Record<string, LessonRow[]> = {}
      let done = 0
      let timeSpentTotal = 0
      lessonsData.forEach((lesson) => {
        const p = progressByLesson.get(lesson.id)
        const attempt = attemptByLesson.get(lesson.id)
        const row: LessonRow = {
          lesson,
          completed: !!p?.completed,
          completedAt: p?.completed_at || null,
          timeSpent: p?.time_spent_seconds || 0,
          progressPercent: p?.progress_percentage || 0,
          quizScore: attempt ? attempt.score : null,
          quizPassed: attempt ? attempt.passed : null,
        }
        if (row.completed) done += 1
        timeSpentTotal += row.timeSpent
        if (!grouped[lesson.module_id]) grouped[lesson.module_id] = []
        grouped[lesson.module_id].push(row)
      })

      setLessonRows(grouped)
      setTotals({ total: lessonsData.length, done, timeSpent: timeSpentTotal })

      // Certificate (instructor can read for own course)
      const { data: certData } = await supabase
        .from('certificates')
        .select('*')
        .eq('user_id', studentId)
        .eq('course_id', courseId)
        .maybeSingle()
      if (certData) setCertificate(certData)
    } catch (error) {
      console.error('Error loading student detail:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (seconds: number) => {
    if (!seconds) return '0m'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
  }

  const progressPct = totals.total > 0 ? Math.round((totals.done / totals.total) * 100) : 0

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-bhutan-yellow" />
          <span className="ml-3 text-muted-foreground">Loading student...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-fit -ml-2"
            onClick={() => router.push(`/teach/courses/${courseId}/students`)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Students
          </Button>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-bhutan-yellow/20 to-bhutan-orange/20 flex items-center justify-center shrink-0 overflow-hidden">
              {student?.avatar_url ? (
                <img src={student.avatar_url} alt={student?.full_name || 'Student'} className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg font-bold text-bhutan-yellow">
                  {(student?.full_name || 'S').slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold truncate">
                {student?.full_name || 'Student'}
              </h1>
              {student?.email && (
                <p className="text-sm text-muted-foreground truncate">{student.email}</p>
              )}
              <p className="text-xs text-muted-foreground truncate">{course?.title}</p>
            </div>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <TrendingUp className="w-3.5 h-3.5" /> Progress
              </div>
              <p className="text-2xl font-bold text-bhutan-yellow">{progressPct}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <CheckCircle className="w-3.5 h-3.5" /> Lessons
              </div>
              <p className="text-2xl font-bold">{totals.done}/{totals.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Clock className="w-3.5 h-3.5" /> Time spent
              </div>
              <p className="text-2xl font-bold">{formatTime(totals.timeSpent)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Calendar className="w-3.5 h-3.5" /> Enrolled
              </div>
              <p className="text-sm font-semibold">
                {enrollment?.enrolled_at
                  ? new Date(enrollment.enrolled_at).toLocaleDateString()
                  : '-'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Certificate status */}
        <Card>
          <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${certificate ? 'bg-green-100 dark:bg-green-950' : 'bg-muted'}`}>
                <Award className={`h-5 w-5 ${certificate ? 'text-green-600' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {certificate ? 'Certificate issued' : 'No certificate yet'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {certificate
                    ? `Issued ${new Date(certificate.issued_at).toLocaleDateString()} · ${certificate.verification_code}`
                    : 'Awarded automatically at 100% completion'}
                </p>
              </div>
            </div>
            {certificate && (
              <div className="flex items-center gap-2">
                {certificate.certificate_url && (
                  <Button variant="outline" size="sm" onClick={() => window.open(certificate.certificate_url, '_blank')}>
                    <Award className="mr-1 h-3.5 w-3.5" /> View
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => window.open(`/verify/${certificate.verification_code}`, '_blank')}>
                  <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Verify
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lesson-by-lesson breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="w-5 h-5" /> Lesson Progress
            </CardTitle>
            <CardDescription>Detailed completion and quiz results</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {modules.length === 0 && (
              <p className="text-sm text-muted-foreground">No content in this course yet.</p>
            )}
            {modules.map((module, mi) => {
              const rows = lessonRows[module.id] || []
              if (rows.length === 0) return null
              return (
                <div key={module.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">Module {mi + 1}</Badge>
                    <span className="text-sm font-medium truncate">{module.title}</span>
                  </div>
                  <div className="space-y-1.5">
                    {rows.map((row) => (
                      <div
                        key={row.lesson.id}
                        className="flex items-center gap-3 rounded-lg border p-3"
                      >
                        {row.completed ? (
                          <CheckCircle className="h-5 w-5 shrink-0 text-green-600" />
                        ) : (
                          <Circle className="h-5 w-5 shrink-0 text-muted-foreground/40" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{row.lesson.title}</p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTime(row.timeSpent)}
                            </span>
                            {!row.completed && row.progressPercent > 0 && (
                              <span>{row.progressPercent}% watched</span>
                            )}
                            {row.completedAt && (
                              <span>Done {new Date(row.completedAt).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                        {row.quizScore !== null && (
                          <Badge
                            variant={row.quizPassed ? 'default' : 'secondary'}
                            className={`shrink-0 text-xs ${row.quizPassed ? 'bg-green-600' : ''}`}
                          >
                            Quiz {row.quizScore}%
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
