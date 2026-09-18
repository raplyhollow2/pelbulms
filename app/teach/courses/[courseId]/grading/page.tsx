'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft,
  ClipboardCheck,
  Download,
  ExternalLink,
  Loader2,
  Save,
  UploadCloud,
  X,
} from 'lucide-react'
import { resolveMediaUrl } from '@/lib/media'

type ActivitySummary = {
  lessonId: string
  lessonTitle: string
  moduleTitle: string
  activityId: string
  activityTitle: string
  activityType: string
  dueDate: string | null
  maxGrade: number | null
  pendingCount: number
  gradedCount: number
  submittedCount: number
  rosterCount: number
  submissions?: SubmissionRow[]
}

type GradeDraft = {
  grade: string
  feedback: string
  returnFileUrl: string
  returnFileName: string
  returnUrl: string
}

type SubmissionRow = {
  progressId: string | null
  userId: string
  studentName: string
  studentEmail: string | null
  status: string | null
  grade: number | null
  maxGrade: number | null
  feedback: string | null
  returnFileUrl: string | null
  returnFileName: string | null
  returnUrl: string | null
  submittedAt: string | null
  completed: boolean
  summary: string | null
  fileUrl: string | null
  fileName: string | null
  response?: { text?: string } | null
}

export default function CourseGradingPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const courseId = params.courseId as string
  const initialLessonId = searchParams.get('lessonId')
  const initialActivityId = searchParams.get('activityId')

  const [loading, setLoading] = useState(true)
  const [courseTitle, setCourseTitle] = useState('')
  const [activities, setActivities] = useState<ActivitySummary[]>([])
  const [totals, setTotals] = useState({
    assessableActivities: 0,
    pendingGrading: 0,
    graded: 0,
    submitted: 0,
  })
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [queue, setQueue] = useState<SubmissionRow[]>([])
  const [queueLoading, setQueueLoading] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, GradeDraft>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selected = useMemo(() => {
    if (!selectedKey) return null
    return activities.find(
      (a) => `${a.lessonId}:${a.activityId}` === selectedKey
    ) || null
  }, [activities, selectedKey])

  const loadOverview = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/teach/courses/${courseId}/submissions`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to load grading queue')
      setActivities(data.activities || [])
      setTotals(
        data.totals || {
          assessableActivities: 0,
          pendingGrading: 0,
          graded: 0,
          submitted: 0,
        }
      )

      const list: ActivitySummary[] = data.activities || []
      let key: string | null = null
      if (initialLessonId && initialActivityId) {
        const match = list.find(
          (a) => a.lessonId === initialLessonId && a.activityId === initialActivityId
        )
        if (match) key = `${match.lessonId}:${match.activityId}`
      }
      if (!key && list.length > 0) {
        const pending = list.find((a) => a.pendingCount > 0) || list[0]
        key = `${pending.lessonId}:${pending.activityId}`
      }
      setSelectedKey(key)
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [courseId, initialLessonId, initialActivityId])

  const loadQueue = useCallback(
    async (lessonId: string, activityId: string) => {
      setQueueLoading(true)
      try {
        const res = await fetch(
          `/api/teach/courses/${courseId}/submissions?lessonId=${encodeURIComponent(lessonId)}&activityId=${encodeURIComponent(activityId)}`
        )
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Failed to load submissions')
        const act = (data.activities || []).find(
          (a: ActivitySummary) => a.lessonId === lessonId && a.activityId === activityId
        )
        const rows: SubmissionRow[] = (act?.submissions || []).filter(
          (s: SubmissionRow) => s.completed || s.status
        )
        setQueue(rows)
        const nextDrafts: Record<string, GradeDraft> = {}
        for (const row of rows) {
          if (!row.progressId) continue
          nextDrafts[row.progressId] = {
            grade: row.grade != null ? String(row.grade) : '',
            feedback: row.feedback || '',
            returnFileUrl: row.returnFileUrl || '',
            returnFileName: row.returnFileName || '',
            returnUrl: row.returnUrl || '',
          }
        }
        setDrafts(nextDrafts)
      } catch (e: any) {
        setError(e?.message || 'Failed to load queue')
      } finally {
        setQueueLoading(false)
      }
    },
    [courseId]
  )

  useEffect(() => {
    void (async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data } = await supabase
          .from('courses')
          .select('title')
          .eq('id', courseId)
          .maybeSingle()
        if (data?.title) setCourseTitle(data.title)
      } catch {
        /* ignore */
      }
      await loadOverview()
    })()
  }, [courseId, loadOverview])

  useEffect(() => {
    if (!selected) {
      setQueue([])
      return
    }
    void loadQueue(selected.lessonId, selected.activityId)
  }, [selected, loadQueue])

  const uploadReturnFile = async (row: SubmissionRow, file: File) => {
    if (!row.progressId || !selected) return
    setUploadingId(row.progressId)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('lessonId', selected.lessonId)
      form.append('progressId', row.progressId)
      const res = await fetch(`/api/teach/courses/${courseId}/return-upload`, {
        method: 'POST',
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to upload return file')
      setDrafts((prev) => ({
        ...prev,
        [row.progressId!]: {
          ...prev[row.progressId!],
          returnFileUrl: data.url || '',
          returnFileName: data.fileName || file.name,
        },
      }))
    } catch (e: any) {
      setError(e?.message || 'Failed to upload return file')
    } finally {
      setUploadingId(null)
    }
  }

  const saveGrade = async (row: SubmissionRow) => {
    if (!row.progressId) return
    const draft = drafts[row.progressId]
    if (!draft) return
    setSavingId(row.progressId)
    setError(null)
    try {
      const hasReturn = Boolean(draft.returnFileUrl.trim() || draft.returnUrl.trim())
      const res = await fetch(
        `/api/teach/courses/${courseId}/submissions/${row.progressId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grade: draft.grade === '' ? null : Number(draft.grade),
            feedback: draft.feedback,
            returnFileUrl: draft.returnFileUrl.trim() || null,
            returnFileName: draft.returnFileName.trim() || null,
            returnUrl: draft.returnUrl.trim() || null,
            status: hasReturn ? 'returned' : 'graded',
          }),
        }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to save grade')
      await loadOverview()
      if (selected) await loadQueue(selected.lessonId, selected.activityId)
    } catch (e: any) {
      setError(e?.message || 'Failed to save')
    } finally {
      setSavingId(null)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto flex items-center justify-center px-4 py-16">
        <Loader2 className="h-8 w-8 animate-spin text-bhutan-yellow" />
        <span className="ml-3 text-muted-foreground">Loading grading queue…</span>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-6 sm:py-8">
      <div className="space-y-3">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit"
          onClick={() => router.push(`/teach/courses/${courseId}/students`)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Students
        </Button>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
            <ClipboardCheck className="h-7 w-7 text-bhutan-yellow" />
            Grading
          </h1>
          <p className="text-sm text-muted-foreground">
            {courseTitle || 'Course'} · Recover submissions and enter scores
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Assessable</p>
            <p className="text-2xl font-bold">{totals.assessableActivities}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Submitted</p>
            <p className="text-2xl font-bold">{totals.submitted}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-amber-600">{totals.pendingGrading}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Graded</p>
            <p className="text-2xl font-bold text-green-600">{totals.graded}</p>
          </CardContent>
        </Card>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Activities</CardTitle>
            <CardDescription>Select an assignment or assessed activity</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[70vh] space-y-2 overflow-y-auto">
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No assessable activities in this course yet.
              </p>
            ) : (
              activities.map((a) => {
                const key = `${a.lessonId}:${a.activityId}`
                const active = key === selectedKey
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedKey(key)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      active
                        ? 'border-bhutan-orange bg-bhutan-yellow/15'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <p className="truncate text-sm font-medium">{a.activityTitle}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {a.moduleTitle} · {a.lessonTitle}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <Badge variant="secondary" className="text-[10px]">
                        {a.activityType}
                      </Badge>
                      {a.pendingCount > 0 ? (
                        <Badge className="bg-amber-600 text-[10px]">
                          {a.pendingCount} pending
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          {a.gradedCount} graded
                        </Badge>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {selected?.activityTitle || 'Submission queue'}
            </CardTitle>
            <CardDescription>
              {selected
                ? `${selected.moduleTitle} · ${selected.lessonTitle}`
                : 'Choose an activity to grade'}
              {selected?.maxGrade != null ? ` · Max ${selected.maxGrade}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {queueLoading ? (
              <div className="flex items-center py-8 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading submissions…
              </div>
            ) : queue.length === 0 ? (
              <p className="py-8 text-sm text-muted-foreground">
                No student submissions for this activity yet.
              </p>
            ) : (
              queue.map((row) => {
                const draft = row.progressId ? drafts[row.progressId] : null
                const fileHref = row.fileUrl
                  ? resolveMediaUrl(row.fileUrl) || row.fileUrl
                  : null
                return (
                  <div
                    key={row.progressId || row.userId}
                    className="space-y-3 rounded-lg border p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{row.studentName}</p>
                        {row.studentEmail ? (
                          <p className="text-xs text-muted-foreground">{row.studentEmail}</p>
                        ) : null}
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <Badge
                            variant="outline"
                            className={
                              row.status === 'graded' || row.status === 'returned'
                                ? 'border-green-600/40 text-green-700'
                                : row.status === 'late'
                                  ? 'border-amber-600/40 text-amber-700'
                                  : ''
                            }
                          >
                            {row.status || 'submitted'}
                          </Badge>
                          {row.submittedAt ? (
                            <span className="text-xs text-muted-foreground">
                              {new Date(row.submittedAt).toLocaleString()}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {fileHref ? (
                        <a
                          href={fileHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-bhutan-orange hover:underline"
                        >
                          <Download className="h-3.5 w-3.5" />
                          {row.fileName || 'Open file'}
                          <ExternalLink className="h-3 opacity-60" />
                        </a>
                      ) : null}
                    </div>

                    {row.summary || row.response?.text ? (
                      <p className="whitespace-pre-wrap rounded-md bg-muted/40 px-3 py-2 text-sm">
                        {row.response?.text || row.summary}
                      </p>
                    ) : null}

                    {row.progressId && draft ? (
                      <div className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-[120px_1fr_auto]">
                          <div className="space-y-1">
                            <Label htmlFor={`grade-${row.progressId}`}>Grade</Label>
                            <Input
                              id={`grade-${row.progressId}`}
                              type="number"
                              min={0}
                              max={row.maxGrade ?? undefined}
                              value={draft.grade}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [row.progressId!]: {
                                    ...prev[row.progressId!],
                                    grade: e.target.value,
                                  },
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`fb-${row.progressId}`}>Feedback</Label>
                            <Textarea
                              id={`fb-${row.progressId}`}
                              rows={2}
                              value={draft.feedback}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [row.progressId!]: {
                                    ...prev[row.progressId!],
                                    feedback: e.target.value,
                                  },
                                }))
                              }
                            />
                          </div>
                          <div className="flex items-end">
                            <Button
                              type="button"
                              className="min-h-11 w-full bg-bhutan-yellow text-black hover:bg-bhutan-orange sm:w-auto"
                              disabled={
                                savingId === row.progressId || uploadingId === row.progressId
                              }
                              onClick={() => void saveGrade(row)}
                            >
                              {savingId === row.progressId ? (
                                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="mr-1.5 h-4 w-4" />
                              )}
                              Save
                            </Button>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label>Return file (optional)</Label>
                            <input
                              id={`return-file-${row.progressId}`}
                              type="file"
                              className="hidden"
                              accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp,.xls,.xlsx,.zip,application/pdf"
                              disabled={
                                savingId === row.progressId || uploadingId === row.progressId
                              }
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                e.target.value = ''
                                if (file) void uploadReturnFile(row, file)
                              }}
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="min-h-11"
                                disabled={
                                  savingId === row.progressId ||
                                  uploadingId === row.progressId
                                }
                                onClick={() =>
                                  document
                                    .getElementById(`return-file-${row.progressId}`)
                                    ?.click()
                                }
                              >
                                {uploadingId === row.progressId ? (
                                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <UploadCloud className="mr-1.5 h-3.5 w-3.5" />
                                )}
                                {uploadingId === row.progressId
                                  ? 'Uploading…'
                                  : draft.returnFileName
                                    ? 'Replace file'
                                    : 'Upload annotated file'}
                              </Button>
                              {draft.returnFileName || draft.returnFileUrl ? (
                                <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-xs">
                                  {draft.returnFileUrl ? (
                                    <a
                                      href={
                                        resolveMediaUrl(draft.returnFileUrl) ||
                                        draft.returnFileUrl
                                      }
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex min-w-0 items-center gap-1 truncate font-medium text-bhutan-orange hover:underline"
                                    >
                                      <Download className="h-3 w-3 shrink-0" />
                                      <span className="truncate">
                                        {draft.returnFileName || 'Return file'}
                                      </span>
                                    </a>
                                  ) : (
                                    <span className="truncate">{draft.returnFileName}</span>
                                  )}
                                  <button
                                    type="button"
                                    className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                    aria-label="Remove return file"
                                    onClick={() =>
                                      setDrafts((prev) => ({
                                        ...prev,
                                        [row.progressId!]: {
                                          ...prev[row.progressId!],
                                          returnFileUrl: '',
                                          returnFileName: '',
                                        },
                                      }))
                                    }
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`return-url-${row.progressId}`}>
                              Return URL (optional)
                            </Label>
                            <Input
                              id={`return-url-${row.progressId}`}
                              type="url"
                              placeholder="https://…"
                              value={draft.returnUrl}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [row.progressId!]: {
                                    ...prev[row.progressId!],
                                    returnUrl: e.target.value,
                                  },
                                }))
                              }
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No progress row yet — student has not submitted.
                      </p>
                    )}
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
