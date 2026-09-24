import type { LessonActivity, LessonActivityType } from '@/lib/lesson-activities'

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

/**
 * Whether this activity counts toward lesson unlock, course completion, and the certificate.
 * Submitted work is not enough for graded activities.
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

  if (activity.activity !== 'quiz' && isAssessableActivity(activity)) {
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
  if (blockers.length === 0) return ''
  const parts: string[] = []
  const waiting = blockers.filter((b) => b.state === 'awaiting_grade')
  const failed = blockers.filter((b) => b.state === 'below_pass')
  const incomplete = blockers.filter(
    (b) => b.state !== 'awaiting_grade' && b.state !== 'below_pass'
  )

  if (waiting.length > 0) {
    const names = waiting.map((b) => b.title).join(', ')
    parts.push(
      `${names} ${waiting.length === 1 ? 'is' : 'are'} awaiting a grade`
    )
  }
  if (failed.length > 0) {
    const names = failed
      .map((b) => {
        const scored = b.grade != null ? `scored ${b.grade}` : 'did not pass'
        const need =
          b.passGrade != null
            ? ` (need ${b.passGrade}${b.maxGrade != null ? ` / ${b.maxGrade}` : ''})`
            : ''
        return `${b.title} ${scored}${need}`
      })
      .join(', ')
    parts.push(names)
  }
  if (incomplete.length > 0) {
    parts.push(`Finish ${incomplete.map((b) => b.title).join(', ')}`)
  }
  return `${parts.join('. ')}.`
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
  if (response.fileName || response.fileUrl) return response.fileName || 'File submitted'
  return null
}
