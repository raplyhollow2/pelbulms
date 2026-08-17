import type { LessonBlock } from '@/lib/lesson-blocks'
import { newBlockId, sanitizeHtml } from '@/lib/lesson-blocks'

export type CourseSize = 'compact' | 'standard' | 'full'

export type OutlineLesson = {
  title: string
  description?: string
  blocks?: string[]
  hasQuiz?: boolean
  hasAssignment?: boolean
  hasScenario?: boolean
  hasFlashcards?: boolean
}

export type OutlineModule = {
  title: string
  description?: string
  lessons: OutlineLesson[]
}

export type CourseOutline = {
  title: string
  description: string
  durationMinutes?: number
  language?: string
  modules: OutlineModule[]
}

export type FilledLesson = {
  title: string
  description?: string
  durationMinutes?: number
  textHtml: string
  accordion?: { title: string; html: string }[]
  flipcards?: { front: string; back: string }[]
  quiz?: {
    title: string
    questions: Array<{
      question: string
      options: string[]
      correctIndex: number
      explanation?: string
    }>
  }
  assignment?: { title: string; instructions: string; maxPoints?: number }
  scenario?: {
    title: string
    nodes: Array<{
      id: string
      text: string
      choices?: Array<{ label: string; nextId: string; feedback?: string }>
      end?: boolean
    }>
  }
  flashcards?: { front: string; back: string }[]
}

export function sizeInstructions(size: CourseSize) {
  if (size === 'compact') {
    return 'Create 3 modules, 2 lessons each. Keep quizzes short (3 questions). Include 1 assignment and 1 scenario in the whole course.'
  }
  if (size === 'full') {
    return 'Create 7-9 modules, 3-4 lessons each. Include a quiz on most lessons, several assignments, flashcards, and a branching scenario in every module.'
  }
  return 'Create 5 modules, 2-3 lessons each. Include a quiz per module, 2-3 assignments, flashcards, and 2 scenarios.'
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function outlineTotals(outline: CourseOutline) {
  const lessons = outline.modules.flatMap((m) => m.lessons)
  return {
    sections: outline.modules.length,
    pages: lessons.length,
    quizzes: lessons.filter((l) => l.hasQuiz).length,
    assignments: lessons.filter((l) => l.hasAssignment).length,
    scenarios: lessons.filter((l) => l.hasScenario).length,
    durationMinutes: outline.durationMinutes || lessons.length * 12,
  }
}

export function blocksFromFilledLesson(
  filled: FilledLesson,
  ids: { quizId?: string; assignmentId?: string; scenarioId?: string; deckId?: string }
): LessonBlock[] {
  const blocks: LessonBlock[] = [
    {
      id: newBlockId(),
      type: 'text',
      html: sanitizeHtml(filled.textHtml || `<p>${filled.description || ''}</p>`),
    },
  ]
  if (filled.accordion?.length) {
    blocks.push({
      id: newBlockId(),
      type: 'accordion',
      items: filled.accordion.map((row) => ({
        title: row.title,
        html: sanitizeHtml(row.html),
      })),
    })
  }
  if (filled.flipcards?.length) {
    blocks.push({ id: newBlockId(), type: 'flipcards', cards: filled.flipcards })
  }
  if (ids.quizId) blocks.push({ id: newBlockId(), type: 'quiz', quizId: ids.quizId })
  if (ids.assignmentId) {
    blocks.push({ id: newBlockId(), type: 'assignment', assignmentId: ids.assignmentId })
  }
  if (ids.scenarioId) {
    blocks.push({ id: newBlockId(), type: 'scenario', scenarioId: ids.scenarioId })
  }
  if (filled.flashcards?.length) {
    blocks.push({
      id: newBlockId(),
      type: 'flashcards',
      deckId: ids.deckId,
      cards: filled.flashcards,
    })
  }
  return blocks
}
