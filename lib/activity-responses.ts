import {
  parseLessonActivities,
  type LessonActivity,
  type LessonActivityType,
} from '@/lib/lesson-activities'

export type ActivityResponsePayload = {
  /** Selected choice option text */
  choice?: string
  /** Free-text submission (assignment, feedback, survey, workshop, wiki) */
  text?: string
  /** Uploaded or pasted file URL for assignments */
  fileUrl?: string
  /** Original filename when a file was uploaded */
  fileName?: string
  /** Database activity entry */
  entryTitle?: string
  entryBody?: string
  /** Glossary contribution */
  term?: string
  definition?: string
  /** Chat message */
  message?: string
  /** Flashcards studied flag */
  studied?: boolean
  /** Worksheet field id → learner text */
  fields?: Record<string, string>
}

export type ActivityInputMode =
  | 'none'
  | 'choice'
  | 'text'
  | 'assignment'
  | 'database'
  | 'glossary'
  | 'chat'
  | 'flashcard'
  | 'worksheet'
  | 'link_ack'

/** Which learner UI to show for an activity type. */
export function activityInputMode(type: LessonActivityType): ActivityInputMode {
  switch (type) {
    case 'choice':
      return 'choice'
    case 'assignment':
      return 'assignment'
    case 'feedback':
    case 'survey':
    case 'workshop':
    case 'wiki':
    case 'forum':
      return 'text'
    case 'database':
      return 'database'
    case 'glossary':
      return 'glossary'
    case 'chat':
      return 'chat'
    case 'flashcard':
      return 'flashcard'
    case 'worksheet':
      return 'worksheet'
    case 'prompt':
      return 'link_ack'
    case 'quiz':
      return 'none'
    case 'file':
    case 'folder':
    case 'url':
    case 'h5p':
    case 'scorm':
    case 'ims':
    case 'lesson':
    case 'page':
    case 'book':
    case 'label':
    default:
      return 'link_ack'
  }
}

/** Activities that must collect a response before they can be marked complete. */
export function requiresLearnerInput(type: LessonActivityType): boolean {
  const mode = activityInputMode(type)
  return mode !== 'none' && mode !== 'link_ack'
}

export type ActivityGradeStatus = 'draft' | 'submitted' | 'graded' | 'returned' | 'late'

export type ActivityCompletionSnapshot = {
  completed?: boolean | null
  status?: string | null
  grade?: number | null
  source?: string | null
}

export type ActivityGateState = 'satisfied' | 'awaiting_grade' | 'below_pass' | 'incomplete'

export type CompletionBlocker = {
  lessonId?: string
  lessonTitle?: string
  activityId: string
  title: string
  state: Exclude<ActivityGateState, 'satisfied'>
  grade?: number | null
  passGrade?: number | null
  maxGrade?: number | null
}

function numericGrade(value: unknown): number | null {
  if (typeof value === 'number' && !Number.isNaN(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (!Number.isNaN(parsed)) return parsed
  }
  return null
}

/** A recorded grade meets the pass mark. An empty pass mark accepts any recorded grade. */
export function gradeMeetsPass(
  grade: number | null | undefined,
  passGrade: number | null | undefined
): boolean {
  const score = numericGrade(grade)
  if (score == null) return false
  const pass = numericGrade(passGrade)
  if (pass == null) return true
  return score >= pass
}

function learnerHandedIn(progress: ActivityCompletionSnapshot | null | undefined): boolean {
  if (!progress) return false
  const status = progress.status
  return (
    Boolean(progress.completed) ||
    status === 'submitted' ||
    status === 'late' ||
    status === 'graded' ||
    status === 'returned'
  )
}

/**
 * Whether the learner has finished their own task.
 * A teacher grade or pass mark is not required to unlock the next lesson.
 */
export function activitySatisfiesProgression(
  activity: LessonActivity,
  progress: ActivityCompletionSnapshot | null | undefined
): boolean {
  if (activity.activity === 'quiz') {
    return (
      Boolean(progress?.completed) &&
      (progress?.source === 'quiz_pass' || progress?.source === 'quiz_attempt')
    )
  }

  if (isAssessableActivity(activity)) return learnerHandedIn(progress)

  return Boolean(progress?.completed)
}

/**
 * Whether graded work meets its pass mark.
 * This is for the gradebook. It does not gate lesson progression.
 */
export function activitySatisfiesCompletion(
  activity: LessonActivity,
  progress: ActivityCompletionSnapshot | null | undefined
): boolean {
  if (activity.activity === 'quiz') {
    return Boolean(progress?.completed) && progress?.source === 'quiz_pass'
  }

  if (isAssessableActivity(activity)) {
    const status = progress?.status
    if (status !== 'graded' && status !== 'returned') return false
    return gradeMeetsPass(progress?.grade, activity.passGrade)
  }

  return Boolean(progress?.completed)
}

/** Learner-facing state for a mandatory or graded activity. */
export function activityGateState(
  activity: LessonActivity,
  progress: ActivityCompletionSnapshot | null | undefined
): ActivityGateState {
  if (activitySatisfiesCompletion(activity, progress)) return 'satisfied'

  if (activity.activity === 'quiz') {
    if (progress?.completed && progress.source === 'quiz_attempt') return 'below_pass'
    return 'incomplete'
  }

  if (isAssessableActivity(activity)) {
    const status = progress?.status
    const handedIn =
      Boolean(progress?.completed) ||
      status === 'submitted' ||
      status === 'late' ||
      status === 'graded' ||
      status === 'returned'
    if (
      (status === 'graded' || status === 'returned') &&
      numericGrade(activity.passGrade) != null &&
      !gradeMeetsPass(progress?.grade, activity.passGrade)
    ) {
      return 'below_pass'
    }
    if (handedIn) return 'awaiting_grade'
  }

  return 'incomplete'
}

export function describeCompletionBlockers(
  blockers: Pick<CompletionBlocker, 'title' | 'state' | 'grade' | 'passGrade' | 'maxGrade'>[]
): string {
  const incomplete = blockers.filter(
    (b) => b.state !== 'awaiting_grade' && b.state !== 'below_pass'
  )
  if (incomplete.length === 0) return ''
  return `Finish ${incomplete.map((b) => b.title).join(', ')}.`
}

/** Lesson activities that still require a grade, based on the current lesson definition. */
export function currentAssessableActivityKeys(
  lessons: { id: string; resources?: unknown }[]
): Set<string> {
  const keys = new Set<string>()
  for (const lesson of lessons) {
    for (const activity of parseLessonActivities(lesson.resources)) {
      if (!isAssessableActivity(activity)) continue
      keys.add(`${lesson.id}:${activity.id}`)
    }
  }
  return keys
}

/** Activities that appear in staff grading queues and assessed-results reports. */
export function isAssessableActivity(activity: LessonActivity): boolean {
  const mode = activityInputMode(activity.activity)
  return (
    mode === 'assignment' ||
    mode === 'text' ||
    mode === 'database' ||
    mode === 'glossary' ||
    (typeof activity.maxGrade === 'number' && activity.maxGrade > 0 && mode !== 'none')
  )
}

/** Derive submitted/late status from activity due date. */
export function submissionStatusForActivity(
  activity: LessonActivity,
  submittedAt: Date = new Date()
): 'submitted' | 'late' {
  if (!activity.dueDate) return 'submitted'
  const due = new Date(activity.dueDate)
  if (Number.isNaN(due.getTime())) return 'submitted'
  return submittedAt.getTime() > due.getTime() ? 'late' : 'submitted'
}

export function validateActivityResponse(
  activity: LessonActivity,
  response: ActivityResponsePayload | null | undefined
): { ok: true; source: string; response: ActivityResponsePayload } | { ok: false; error: string } {
  const mode = activityInputMode(activity.activity)

  if (mode === 'none') {
    return { ok: false, error: 'This activity completes automatically' }
  }

  if (mode === 'link_ack') {
    return { ok: true, source: 'ack', response: response || {} }
  }

  if (!response || typeof response !== 'object') {
    return { ok: false, error: 'A response is required' }
  }

  if (mode === 'choice') {
    const choice = typeof response.choice === 'string' ? response.choice.trim() : ''
    if (!choice) return { ok: false, error: 'Select an option before submitting' }
    const options = activity.choices || []
    if (options.length > 0 && !options.includes(choice)) {
      return { ok: false, error: 'Selected option is not valid for this choice' }
    }
    return { ok: true, source: 'choice', response: { choice } }
  }

  if (mode === 'assignment') {
    const text = typeof response.text === 'string' ? response.text.trim() : ''
    const fileUrl = typeof response.fileUrl === 'string' ? response.fileUrl.trim() : ''
    const fileName =
      typeof response.fileName === 'string' ? response.fileName.trim() || undefined : undefined
    if (!text && !fileUrl) {
      return {
        ok: false,
        error: 'Upload a file, paste a file URL, or enter a written response',
      }
    }
    return {
      ok: true,
      source: 'submission',
      response: {
        text: text || undefined,
        fileUrl: fileUrl || undefined,
        fileName,
      },
    }
  }

  if (mode === 'text') {
    const text = typeof response.text === 'string' ? response.text.trim() : ''
    if (!text) return { ok: false, error: 'Enter your response before submitting' }
    return { ok: true, source: 'response', response: { text } }
  }

  if (mode === 'database') {
    const entryTitle = typeof response.entryTitle === 'string' ? response.entryTitle.trim() : ''
    const entryBody = typeof response.entryBody === 'string' ? response.entryBody.trim() : ''
    if (!entryTitle || !entryBody) {
      return { ok: false, error: 'Enter a title and body for your database entry' }
    }
    return { ok: true, source: 'submission', response: { entryTitle, entryBody } }
  }

  if (mode === 'glossary') {
    const term = typeof response.term === 'string' ? response.term.trim() : ''
    const definition = typeof response.definition === 'string' ? response.definition.trim() : ''
    if (!term || !definition) {
      return { ok: false, error: 'Enter a term and definition' }
    }
    return { ok: true, source: 'submission', response: { term, definition } }
  }

  if (mode === 'chat') {
    const message = typeof response.message === 'string' ? response.message.trim() : ''
    if (!message) return { ok: false, error: 'Enter a chat message' }
    if (message.length > 2000) return { ok: false, error: 'Message is too long (max 2000 characters)' }
    return { ok: true, source: 'chat', response: { message } }
  }

  if (mode === 'flashcard') {
    return { ok: true, source: 'ack', response: { studied: true } }
  }

  if (mode === 'worksheet') {
    const raw = response.fields
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, error: 'Fill in the template before saving' }
    }
    const allowed = new Set((activity.fields || []).map((field) => field.id))
    const fields: Record<string, string> = {}
    for (const [key, value] of Object.entries(raw)) {
      if (allowed.size > 0 && !allowed.has(key)) continue
      if (typeof value !== 'string') continue
      const text = value.trim().slice(0, 4000)
      if (text) fields[key] = text
    }
    if (Object.keys(fields).length === 0) {
      return { ok: false, error: 'Fill in at least one field' }
    }
    return { ok: true, source: 'response', response: { fields } }
  }

  return { ok: false, error: 'Unsupported activity response' }
}

export function summarizeResponse(
  activityType: LessonActivityType,
  response: ActivityResponsePayload | null | undefined
): string | null {
  if (!response) return null
  if (response.choice) return `Selected: ${response.choice}`
  if (response.text) return response.text.slice(0, 160)
  if (response.entryTitle) return response.entryTitle
  if (response.term) return `${response.term}: ${(response.definition || '').slice(0, 80)}`
  if (response.message) return response.message.slice(0, 160)
  if (response.studied) return 'Marked as studied'
  if (response.fields) {
    const parts = Object.values(response.fields)
      .filter((value) => typeof value === 'string' && value.trim())
      .map((value) => value.trim())
    if (parts.length) return parts.join(' · ').slice(0, 160)
  }
  if (response.fileName || response.fileUrl) return response.fileName || 'File submitted'
  return null
}
