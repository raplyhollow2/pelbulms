'use client'

import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CheckCircle,
  Download,
  ExternalLink,
  HelpCircle,
  Loader2,
  UploadCloud,
  X,
} from 'lucide-react'
import { resolveMediaUrl } from '@/lib/media'
import {
  getActivityDef,
  isActivityRequired,
  parseLessonActivities,
  type LessonActivity,
} from '@/lib/lesson-activities'
import {
  activityGateState,
  activityInputMode,
  isAssessableActivity,
  requiresLearnerInput,
  summarizeResponse,
  type ActivityGateState,
  type ActivityResponsePayload,
} from '@/lib/activity-responses'
import { cn } from '@/lib/utils'

export type ActivityProgressItem = {
  id: string
  completed?: boolean
  source?: string | null
  response?: ActivityResponsePayload | null
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

function activityHref(item: LessonActivity): string | null {
  const raw = item.fileUrl || item.url
  if (!raw) return null
  return resolveMediaUrl(raw) || raw
}

export function LessonResources({
  resources,
  extraResources,
  lessonId,
  onTakeQuiz,
  progressById,
  mandatoryTotal = 0,
  mandatoryCompleted = 0,
  onMarkDone,
  onSubmitResponse,
  markingActivityId,
}: {
  resources?: unknown
  extraResources?: unknown
  /** Required for assignment file uploads */
  lessonId?: string
  onTakeQuiz?: (quizId: string) => void
  progressById?: Record<string, ActivityProgressItem>
  mandatoryTotal?: number
  mandatoryCompleted?: number
  /** Plain ack for link/file style activities */
  onMarkDone?: (activityId: string) => void | Promise<void>
  /** Submit typed learner input (choice, assignment, etc.) */
  onSubmitResponse?: (
    activityId: string,
    response: ActivityResponsePayload
  ) => void | Promise<void>
  markingActivityId?: string | null
}) {
  const lessonItems = parseLessonActivities(resources).map((item) => ({
    ...item,
    trackable: true as const,
  }))
  const moduleItems = parseLessonActivities(extraResources).map((item) => ({
    ...item,
    trackable: false as const,
  }))
  const items = [...moduleItems, ...lessonItems]

  if (items.length === 0) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg">Activities & resources</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No activities or files have been added to this lesson yet.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="glass">
      <CardHeader className="space-y-1">
        <CardTitle className="text-lg">Activities & resources</CardTitle>
        {mandatoryTotal > 0 && (
          <p className="text-xs text-muted-foreground">
            {mandatoryCompleted} of {mandatoryTotal} mandatory complete
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => {
          const def = getActivityDef(item.activity)
          const Icon = def?.icon
          const href = activityHref(item)
          const isQuiz = item.activity === 'quiz' && item.quizId
          const required = item.trackable && isActivityRequired(item)
          const progress = progressById?.[item.id]
          const gate = item.trackable ? activityGateState(item, progress) : 'incomplete'
          const done = gate === 'satisfied'
          const formLocked =
            gate === 'awaiting_grade' ||
            (Boolean(progress?.completed) && gate !== 'below_pass')
          const marking = markingActivityId === item.id
          const mode = activityInputMode(item.activity)
          const needsInput = item.trackable && requiresLearnerInput(item.activity)

          return (
            <div
              key={`${item.trackable ? 'lesson' : 'module'}-${item.id}`}
              className="rounded-lg border p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  {Icon ? (
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-bhutan-yellow" />
                  ) : null}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">{item.title || 'Item'}</p>
                      <Badge variant="secondary" className="text-[10px]">
                        {def?.label || item.activity}
                      </Badge>
                      {!item.trackable ? (
                        <Badge variant="outline" className="text-[10px]">
                          Module
                        </Badge>
                      ) : required ? (
                        <Badge className="text-[10px]">Required</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          Optional
                        </Badge>
                      )}
                      {item.trackable && gate === 'satisfied' && (
                        <Badge
                          variant="outline"
                          className="gap-1 border-green-600/40 text-[10px] text-green-700"
                        >
                          <CheckCircle className="h-3 w-3" />
                          {isQuiz || isAssessableActivity(item) ? 'Passed' : 'Done'}
                        </Badge>
                      )}
                      {item.trackable && gate === 'awaiting_grade' && (
                        <Badge className="bg-amber-600 text-[10px] hover:bg-amber-600">
                          Awaiting grade
                        </Badge>
                      )}
                      {item.trackable && gate === 'below_pass' && (
                        <Badge className="bg-red-600 text-[10px] hover:bg-red-600">
                          Below pass
                        </Badge>
                      )}
                    </div>
                    {item.description && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                    {item.content && mode !== 'glossary' && mode !== 'database' && (
                      <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-xs text-muted-foreground">
                        {item.content}
                      </p>
                    )}
                    {progress?.response ? (
                      <div className="mt-1 space-y-1">
                        <p className="text-xs text-green-700 dark:text-green-400">
                          {summarizeResponse(item.activity, progress.response)}
                        </p>
                        {progress.response.fileUrl ? (
                          <a
                            href={resolveMediaUrl(progress.response.fileUrl) || progress.response.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-bhutan-orange hover:underline"
                          >
                            <Download className="h-3 w-3" />
                            {progress.response.fileName || 'Open submitted file'}
                            <ExternalLink className="h-3 opacity-60" />
                          </a>
                        ) : null}
                        {(progress.status === 'graded' || progress.status === 'returned') &&
                        progress.grade != null ? (
                          <p className="text-xs font-medium">
                            Score: {progress.grade}
                            {progress.max_grade != null ? ` / ${progress.max_grade}` : ''}
                          </p>
                        ) : null}
                        {progress.feedback ? (
                          <p className="text-xs text-muted-foreground">
                            Feedback: {progress.feedback}
                          </p>
                        ) : null}
                        {progress.return_file_url ? (
                          <a
                            href={
                              resolveMediaUrl(progress.return_file_url) ||
                              progress.return_file_url
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-bhutan-orange hover:underline"
                          >
                            <Download className="h-3 w-3" />
                            {progress.return_file_name || 'Open returned file'}
                            <ExternalLink className="h-3 opacity-60" />
                          </a>
                        ) : null}
                        {progress.return_url ? (
                          <a
                            href={progress.return_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-bhutan-orange hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Open return link
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-stretch gap-1.5 sm:flex-row sm:items-center">
                  {isQuiz ? (
                    <Button
                      type="button"
                      size="sm"
                      className="min-h-11 shrink-0 gap-1 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
                      onClick={() => onTakeQuiz?.(item.quizId!)}
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                      {done ? 'Retake quiz' : 'Take quiz'}
                    </Button>
                  ) : (
                    <>
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-md border border-border px-3 text-sm hover:bg-muted"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Open
                          <ExternalLink className="h-3 opacity-60" />
                        </a>
                      ) : null}
                      {!needsInput &&
                      item.trackable &&
                      onMarkDone &&
                      required &&
                      !done ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="min-h-11 shrink-0"
                          disabled={marking}
                          onClick={() => void onMarkDone(item.id)}
                        >
                          {marking ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Mark as done
                        </Button>
                      ) : null}
                    </>
                  )}
                </div>
              </div>

              {item.trackable && needsInput && onSubmitResponse ? (
                <div className="mt-3 border-t border-border/50 pt-3">
                  <ActivityInputForm
                    item={item}
                    lessonId={lessonId}
                    done={formLocked}
                    gate={gate}
                    marking={marking}
                    progress={progress}
                    onSubmit={(response) => onSubmitResponse(item.id, response)}
                  />
                </div>
              ) : null}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function ActivityInputForm({
  item,
  lessonId,
  done,
  gate,
  marking,
  progress,
  onSubmit,
}: {
  item: LessonActivity
  lessonId?: string
  done: boolean
  gate: ActivityGateState
  marking: boolean
  progress?: ActivityProgressItem
  onSubmit: (response: ActivityResponsePayload) => void | Promise<void>
}) {
  const mode = activityInputMode(item.activity)
  const [choice, setChoice] = useState(progress?.response?.choice || '')
  const [text, setText] = useState(progress?.response?.text || '')
  const [entryTitle, setEntryTitle] = useState(progress?.response?.entryTitle || '')
  const [entryBody, setEntryBody] = useState(progress?.response?.entryBody || '')
  const [term, setTerm] = useState(progress?.response?.term || '')
  const [definition, setDefinition] = useState(progress?.response?.definition || '')
  const [message, setMessage] = useState('')
  const [uploadedUrl, setUploadedUrl] = useState(
    progress?.response?.fileName ? progress?.response?.fileUrl || '' : ''
  )
  const [fileName, setFileName] = useState(progress?.response?.fileName || '')
  const [pastedUrl, setPastedUrl] = useState(
    progress?.response?.fileName ? '' : progress?.response?.fileUrl || ''
  )
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (progress?.response?.choice) setChoice(progress.response.choice)
    if (progress?.response?.text) setText(progress.response.text)
    if (progress?.response?.entryTitle) setEntryTitle(progress.response.entryTitle)
    if (progress?.response?.entryBody) setEntryBody(progress.response.entryBody)
    if (progress?.response?.term) setTerm(progress.response.term)
    if (progress?.response?.definition) setDefinition(progress.response.definition)
    if (progress?.response?.fileName) {
      setFileName(progress.response.fileName)
      setUploadedUrl(progress.response.fileUrl || '')
      setPastedUrl('')
    } else if (progress?.response?.fileUrl) {
      setPastedUrl(progress.response.fileUrl)
      setUploadedUrl('')
      setFileName('')
    }
  }, [progress?.response])

  const submit = async (payload: ActivityResponsePayload) => {
    setError('')
    try {
      await onSubmit(payload)
    } catch (e: any) {
      setError(e?.message || 'Failed to submit')
    }
  }

  const uploadAssignmentFile = async (file: File) => {
    if (!lessonId) {
      setError('Missing lesson context for file upload')
      return
    }
    setError('')
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('activityId', item.id)
      const res = await fetch(`/api/lessons/${lessonId}/assignment-upload`, {
        method: 'POST',
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setUploadedUrl(data.url as string)
      setFileName((data.fileName as string) || file.name)
      setPastedUrl('')
    } catch (e: any) {
      setError(e?.message || 'Upload failed')
      setUploadedUrl('')
      setFileName('')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const clearUploadedFile = () => {
    setUploadedUrl('')
    setFileName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const resolvedFileUrl = uploadedUrl.trim() || pastedUrl.trim()
  const canSubmitAssignment = Boolean(text.trim()) || Boolean(resolvedFileUrl)

  if (mode === 'choice') {
    const options = item.choices || []
    const tallies = progress?.choiceTallies
    return (
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground">Select your decision</p>
        <div className="space-y-2" role="radiogroup" aria-label={item.title}>
          {options.map((opt, index) => (
            <label
              key={`${item.id}-opt-${index}`}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm',
                choice === opt
                  ? 'border-bhutan-orange bg-bhutan-yellow/15'
                  : 'border-border/60 hover:bg-muted/40',
                done && 'pointer-events-none opacity-80'
              )}
            >
              <input
                type="radio"
                name={`choice-${item.id}`}
                className="accent-bhutan-orange"
                checked={choice === opt}
                disabled={done && Boolean(progress?.response?.choice)}
                onChange={() => setChoice(opt)}
              />
              <span className="flex-1">{opt}</span>
              {tallies?.[opt] != null ? (
                <span className="text-[10px] text-muted-foreground">{tallies[opt]} votes</span>
              ) : null}
            </label>
          ))}
        </div>
        {options.length === 0 ? (
          <p className="text-xs text-destructive">No options were configured for this choice.</p>
        ) : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {!done || !progress?.response?.choice ? (
          <Button
            type="button"
            size="sm"
            className="min-h-11 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
            disabled={marking || !choice}
            onClick={() => void submit({ choice })}
          >
            {marking ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Submit decision
          </Button>
        ) : null}
      </div>
    )
  }

  if (mode === 'assignment') {
    const allowFiles = item.allowSubmissions !== false
    return (
      <div className="space-y-3">
        {item.dueDate || item.maxGrade != null || item.passGrade != null ? (
          <p className="text-xs text-muted-foreground">
            {item.dueDate ? `Due ${new Date(item.dueDate).toLocaleString()}` : null}
            {item.dueDate && item.maxGrade != null ? ' · ' : null}
            {item.maxGrade != null ? `Max grade: ${item.maxGrade}` : null}
            {item.passGrade != null
              ? `${item.dueDate || item.maxGrade != null ? ' · ' : ''}Grade to pass: ${item.passGrade}`
              : null}
            {progress?.status === 'late' ? ' · Submitted late' : ''}
          </p>
        ) : null}
        {progress?.status === 'submitted' || progress?.status === 'late' ? (
          <div className="rounded-md border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            Submitted. Awaiting a grade
            {item.passGrade != null ? ` of at least ${item.passGrade}` : ''}. This activity
            does not count as complete until it is graded
            {item.passGrade != null ? ' and meets the grade to pass' : ''}.
          </div>
        ) : null}
        {(progress?.status === 'graded' || progress?.status === 'returned') &&
        (progress.grade != null ||
          progress.feedback ||
          progress.return_file_url ||
          progress.return_url) ? (
          <div
            className={
              item.passGrade != null &&
              progress.grade != null &&
              progress.grade < item.passGrade
                ? 'space-y-1.5 rounded-md border border-red-600/40 bg-red-500/10 px-3 py-2 text-xs'
                : 'space-y-1.5 rounded-md border border-green-600/30 bg-green-500/10 px-3 py-2 text-xs'
            }
          >
            {progress.grade != null ? (
              <p className="font-medium">
                Grade: {progress.grade}
                {progress.max_grade != null ? ` / ${progress.max_grade}` : ''}
                {item.passGrade != null && progress.grade < item.passGrade
                  ? ` — need ${item.passGrade} to pass. You can resubmit.`
                  : item.passGrade != null
                    ? ' — passed'
                    : ''}
              </p>
            ) : null}
            {progress.feedback ? (
              <p className="text-muted-foreground">{progress.feedback}</p>
            ) : null}
            {progress.return_file_url ? (
              <a
                href={
                  resolveMediaUrl(progress.return_file_url) || progress.return_file_url
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-bhutan-orange hover:underline"
              >
                <Download className="h-3 w-3" />
                {progress.return_file_name || 'Download returned file'}
                <ExternalLink className="h-3 opacity-60" />
              </a>
            ) : null}
            {progress.return_url ? (
              <a
                href={progress.return_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-bhutan-orange hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Open return link
              </a>
            ) : null}
          </div>
        ) : null}
        {allowFiles ? (
          <div className="space-y-1.5">
            <Label htmlFor={`assign-upload-${item.id}`}>Upload your file</Label>
            <input
              ref={fileInputRef}
              id={`assign-upload-${item.id}`}
              type="file"
              className="hidden"
              disabled={done || uploading || !lessonId}
              accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp,.xls,.xlsx,.zip,application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void uploadAssignmentFile(file)
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11"
                disabled={done || uploading || !lessonId}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UploadCloud className="mr-1.5 h-3.5 w-3.5" />
                )}
                {uploading ? 'Uploading…' : fileName ? 'Replace file' : 'Choose file'}
              </Button>
              {fileName ? (
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-xs">
                  {done && (uploadedUrl || progress?.response?.fileUrl) ? (
                    <a
                      href={
                        resolveMediaUrl(uploadedUrl || progress?.response?.fileUrl || '') ||
                        uploadedUrl ||
                        progress?.response?.fileUrl ||
                        '#'
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-w-0 items-center gap-1 truncate font-medium text-bhutan-orange hover:underline"
                    >
                      <Download className="h-3 w-3 shrink-0" />
                      <span className="truncate">{fileName}</span>
                    </a>
                  ) : (
                    <span className="truncate">{fileName}</span>
                  )}
                  {!done ? (
                    <button
                      type="button"
                      className="shrink-0 rounded p-0.5 hover:bg-muted"
                      aria-label="Remove uploaded file"
                      onClick={clearUploadedFile}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  PDF, Word, PPT, Excel, images, or ZIP (max 50MB)
                </span>
              )}
            </div>
            {!lessonId ? (
              <p className="text-xs text-destructive">File upload is unavailable on this page.</p>
            ) : null}
          </div>
        ) : null}

        {allowFiles ? (
          <div className="space-y-1.5">
            <Label htmlFor={`assign-file-${item.id}`}>Or paste a file URL</Label>
            <Input
              id={`assign-file-${item.id}`}
              value={pastedUrl}
              disabled={done || Boolean(uploadedUrl)}
              onChange={(e) => setPastedUrl(e.target.value)}
              placeholder="https://… link to your file"
            />
            {uploadedUrl ? (
              <p className="text-[11px] text-muted-foreground">
                Clear the uploaded file to use a pasted URL instead.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor={`assign-${item.id}`}>Notes or written response (optional)</Label>
          <Textarea
            id={`assign-${item.id}`}
            value={text}
            disabled={done}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Add notes, or submit a written response without a file…"
          />
        </div>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {!done ? (
          <Button
            type="button"
            size="sm"
            className="min-h-11 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
            disabled={marking || uploading || !canSubmitAssignment}
            onClick={() =>
              void submit({
                text: text.trim() || undefined,
                fileUrl: allowFiles ? resolvedFileUrl || undefined : undefined,
                fileName: allowFiles ? fileName || undefined : undefined,
              })
            }
          >
            {marking ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            {gate === 'below_pass' || progress?.completed
              ? 'Resubmit assignment'
              : 'Submit assignment'}
          </Button>
        ) : null}
      </div>
    )
  }

  if (mode === 'text') {
    const label =
      item.activity === 'workshop'
        ? 'Your workshop submission'
        : item.activity === 'wiki'
          ? 'Your wiki contribution'
          : item.activity === 'forum'
            ? 'Your forum post'
            : 'Your response'
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor={`text-${item.id}`}>{label}</Label>
          <Textarea
            id={`text-${item.id}`}
            value={text}
            disabled={done}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Type your response…"
          />
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {!done ? (
          <Button
            type="button"
            size="sm"
            className="min-h-11 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
            disabled={marking || !text.trim()}
            onClick={() => void submit({ text })}
          >
            {marking ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Submit response
          </Button>
        ) : null}
      </div>
    )
  }

  if (mode === 'database') {
    return (
      <div className="space-y-3">
        {item.content ? (
          <p className="whitespace-pre-wrap text-xs text-muted-foreground">{item.content}</p>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor={`db-title-${item.id}`}>Entry title</Label>
          <Input
            id={`db-title-${item.id}`}
            value={entryTitle}
            disabled={done}
            onChange={(e) => setEntryTitle(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`db-body-${item.id}`}>Entry body</Label>
          <Textarea
            id={`db-body-${item.id}`}
            value={entryBody}
            disabled={done}
            onChange={(e) => setEntryBody(e.target.value)}
            rows={3}
          />
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {!done ? (
          <Button
            type="button"
            size="sm"
            className="min-h-11 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
            disabled={marking || !entryTitle.trim() || !entryBody.trim()}
            onClick={() => void submit({ entryTitle, entryBody })}
          >
            {marking ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Add entry
          </Button>
        ) : null}
      </div>
    )
  }

  if (mode === 'glossary') {
    return (
      <div className="space-y-3">
        {item.content ? (
          <div className="rounded-md bg-muted/40 p-2 text-xs whitespace-pre-wrap">{item.content}</div>
        ) : null}
        <p className="text-xs text-muted-foreground">Contribute a term to this glossary</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`term-${item.id}`}>Term</Label>
            <Input
              id={`term-${item.id}`}
              value={term}
              disabled={done}
              onChange={(e) => setTerm(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`def-${item.id}`}>Definition</Label>
            <Input
              id={`def-${item.id}`}
              value={definition}
              disabled={done}
              onChange={(e) => setDefinition(e.target.value)}
            />
          </div>
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {!done ? (
          <Button
            type="button"
            size="sm"
            className="min-h-11 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
            disabled={marking || !term.trim() || !definition.trim()}
            onClick={() => void submit({ term, definition })}
          >
            {marking ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Submit term
          </Button>
        ) : null}
      </div>
    )
  }

  if (mode === 'chat') {
    const messages = progress?.chatMessages || []
    return (
      <div className="space-y-3">
        <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-border/50 bg-muted/20 p-2">
          {messages.length === 0 ? (
            <p className="text-xs text-muted-foreground">No messages yet. Start the conversation.</p>
          ) : (
            messages.map((m, i) => (
              <div key={`${m.userId}-${i}`} className="text-xs">
                <span className="font-medium text-foreground">Learner</span>
                <span className="text-muted-foreground"> · {m.message}</span>
              </div>
            ))
          )}
        </div>
        {!done ? (
          <>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              placeholder="Write a chat message…"
            />
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <Button
              type="button"
              size="sm"
              className="min-h-11 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
              disabled={marking || !message.trim()}
              onClick={() => void submit({ message })}
            >
              {marking ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Send & complete
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">You posted in this chat.</p>
        )}
      </div>
    )
  }

  if (mode === 'flashcard') {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Study the lesson flashcards, then confirm when you are done.
        </p>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {!done ? (
          <Button
            type="button"
            size="sm"
            className="min-h-11 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
            disabled={marking}
            onClick={() => void submit({ studied: true })}
          >
            {marking ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Mark flashcards studied
          </Button>
        ) : null}
      </div>
    )
  }

  return null
}
