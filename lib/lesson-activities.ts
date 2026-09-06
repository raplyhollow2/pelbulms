import type { LucideIcon } from 'lucide-react'
import {
  ClipboardList,
  BookOpen,
  ListChecks,
  Database,
  File,
  Folder,
  BookMarked,
  Type,
  FileText,
  Link2,
  HelpCircle,
  Package,
  Library,
  Users,
  MessageSquarePlus,
  ClipboardCheck,
  MessageCircle,
  Puzzle,
  BrainCircuit,
} from 'lucide-react'

export type LessonActivityType =
  | 'assignment'
  | 'book'
  | 'choice'
  | 'database'
  | 'file'
  | 'folder'
  | 'forum'
  | 'glossary'
  | 'label'
  | 'page'
  | 'url'
  | 'quiz'
  | 'scorm'
  | 'wiki'
  | 'workshop'
  | 'feedback'
  | 'survey'
  | 'chat'
  | 'h5p'
  | 'flashcard'

export type LessonActivity = {
  id: string
  activity: LessonActivityType
  title: string
  description?: string
  /** External / content URL */
  url?: string
  /** Uploaded file URL (file / folder / assignment attachment) */
  fileUrl?: string
  fileName?: string
  dueDate?: string
  maxGrade?: number
  passGrade?: number
  allowSubmissions?: boolean
  /** Choice options, one per line stored as array */
  choices?: string[]
  /** Free-form body (page, label, book chapters) */
  content?: string
  /** Linked row in `quizzes` when activity === 'quiz' */
  quizId?: string
  /** When true, learner must complete before next lesson (if gated) */
  required?: boolean
  createdAt?: string
}

export type ActivityField =
  | 'title'
  | 'description'
  | 'url'
  | 'file'
  | 'dueDate'
  | 'maxGrade'
  | 'passGrade'
  | 'allowSubmissions'
  | 'choices'
  | 'content'

export type ActivityDefinition = {
  type: LessonActivityType
  label: string
  description: string
  category: 'activities' | 'resources'
  icon: LucideIcon
  fields: ActivityField[]
}

export const LESSON_ACTIVITY_TYPES: ActivityDefinition[] = [
  {
    type: 'assignment',
    label: 'Assignment',
    description: 'Collect student work with a due date and grade',
    category: 'activities',
    icon: ClipboardList,
    fields: ['title', 'description', 'dueDate', 'maxGrade', 'allowSubmissions', 'file'],
  },
  {
    type: 'quiz',
    label: 'Quiz',
    description: 'Multiple-choice and other questions, stored and graded',
    category: 'activities',
    icon: HelpCircle,
    fields: ['title', 'description', 'passGrade'],
  },
  {
    type: 'choice',
    label: 'Choice',
    description: 'Poll students with multiple options',
    category: 'activities',
    icon: ListChecks,
    fields: ['title', 'description', 'choices'],
  },
  {
    type: 'chat',
    label: 'Chat',
    description: 'Real-time chat room for the lesson',
    category: 'activities',
    icon: MessageCircle,
    fields: ['title', 'description'],
  },
  {
    type: 'workshop',
    label: 'Workshop',
    description: 'Peer assessment activity',
    category: 'activities',
    icon: Users,
    fields: ['title', 'description', 'dueDate', 'maxGrade'],
  },
  {
    type: 'feedback',
    label: 'Feedback',
    description: 'Custom survey / feedback form',
    category: 'activities',
    icon: MessageSquarePlus,
    fields: ['title', 'description', 'url'],
  },
  {
    type: 'survey',
    label: 'Survey',
    description: 'Standard course survey',
    category: 'activities',
    icon: ClipboardCheck,
    fields: ['title', 'description', 'url'],
  },
  {
    type: 'database',
    label: 'Database',
    description: 'Shared collection of entries',
    category: 'activities',
    icon: Database,
    fields: ['title', 'description', 'content'],
  },
  {
    type: 'glossary',
    label: 'Glossary',
    description: 'Dictionary of terms for this lesson',
    category: 'activities',
    icon: BookMarked,
    fields: ['title', 'description', 'content'],
  },
  {
    type: 'wiki',
    label: 'Wiki',
    description: 'Collaborative page students can edit',
    category: 'activities',
    icon: Library,
    fields: ['title', 'description', 'url'],
  },
  {
    type: 'flashcard',
    label: 'Flashcards',
    description: 'Study cards for this lesson',
    category: 'activities',
    icon: BrainCircuit,
    fields: ['title', 'description'],
  },
  {
    type: 'h5p',
    label: 'H5P',
    description: 'Interactive H5P content',
    category: 'activities',
    icon: Puzzle,
    fields: ['title', 'description', 'url'],
  },
  {
    type: 'scorm',
    label: 'SCORM package',
    description: 'Upload or link a SCORM package',
    category: 'activities',
    icon: Package,
    fields: ['title', 'description', 'url', 'file'],
  },
  {
    type: 'file',
    label: 'File',
    description: 'PDF, PPT, or other reading material',
    category: 'resources',
    icon: File,
    fields: ['title', 'description', 'file', 'url'],
  },
  {
    type: 'folder',
    label: 'Folder',
    description: 'Group of related files',
    category: 'resources',
    icon: Folder,
    fields: ['title', 'description', 'file'],
  },
  {
    type: 'page',
    label: 'Page',
    description: 'A content page inside the lesson',
    category: 'resources',
    icon: FileText,
    fields: ['title', 'content'],
  },
  {
    type: 'book',
    label: 'Book',
    description: 'Multi-page reading content',
    category: 'resources',
    icon: BookOpen,
    fields: ['title', 'description', 'content'],
  },
  {
    type: 'url',
    label: 'URL',
    description: 'Link to an external website',
    category: 'resources',
    icon: Link2,
    fields: ['title', 'description', 'url'],
  },
  {
    type: 'label',
    label: 'Label / text',
    description: 'Text or media embedded on the page',
    category: 'resources',
    icon: Type,
    fields: ['title', 'content'],
  },
]

export function getActivityDef(type: LessonActivityType): ActivityDefinition | undefined {
  return LESSON_ACTIVITY_TYPES.find((a) => a.type === type)
}

export function newActivityId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function coerceActivityItem(item: unknown): Record<string, any> | null {
  if (!item) return null
  if (typeof item === 'string') {
    try {
      const parsed = JSON.parse(item)
      return parsed && typeof parsed === 'object' ? parsed : null
    } catch {
      return null
    }
  }
  if (typeof item === 'object') return item as Record<string, any>
  return null
}

/** Normalize legacy file resources + new activities into a typed list. */
export function parseLessonActivities(raw: unknown): LessonActivity[] {
  if (!Array.isArray(raw)) return []
  const items: LessonActivity[] = []
  raw.forEach((item: unknown, index: number) => {
    const value = coerceActivityItem(item)
    if (!value) return
    if (value.activity) {
      items.push({
        id: value.id || `legacy_${index}`,
        activity: value.activity as LessonActivityType,
        title: value.title || 'Untitled',
        description: value.description,
        url: value.url,
        fileUrl: value.fileUrl,
        fileName: value.fileName,
        dueDate: value.dueDate,
        maxGrade: value.maxGrade,
        passGrade: value.passGrade,
        allowSubmissions: value.allowSubmissions,
        choices: value.choices,
        content: value.content,
        quizId: value.quizId,
        required: typeof value.required === 'boolean' ? value.required : undefined,
        createdAt: value.createdAt,
      })
      return
    }
    items.push({
      id: value.id || `file_${index}`,
      activity: 'file',
      title: value.title || value.fileName || 'File',
      url: value.url,
      fileUrl: value.url,
      fileName: value.title,
      description: value.type,
      createdAt: value.createdAt,
    })
  })
  return items
}

/** Default required=true for assessments/readings; false for decorative labels. */
export function defaultActivityRequired(type: LessonActivityType): boolean {
  return type !== 'label' && type !== 'chat'
}

export function isActivityRequired(activity: LessonActivity): boolean {
  if (typeof activity.required === 'boolean') return activity.required
  return defaultActivityRequired(activity.activity)
}

export function getMandatoryActivities(raw: unknown): LessonActivity[] {
  return parseLessonActivities(raw).filter(isActivityRequired)
}
