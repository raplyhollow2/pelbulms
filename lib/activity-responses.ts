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
