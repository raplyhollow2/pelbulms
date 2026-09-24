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
  MessagesSquare,
  Boxes,
  GitBranch,
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
  | 'h5p'
  | 'ims'
  | 'lesson'
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
  | 'flashcard'

/** Moodle-style picker categories (plus extras we keep). */
export type ActivityCategory =
  | 'assessment'
  | 'collaboration'
  | 'communication'
  | 'resources'
  | 'interactive'
  | 'extras'

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

export type ActivityMaturity = 'working' | 'partial' | 'stub'

export type ActivityDefinition = {
  type: LessonActivityType
  label: string
  description: string
  /** Primary Moodle-style category (used for badges / ordering). */
  category: ActivityCategory
  /** Extra categories this type also appears under when filtering. */
  alsoIn?: ActivityCategory[]
  icon: LucideIcon
  fields: ActivityField[]
  /** How complete teach→learn behavior is today. */
  maturity: ActivityMaturity
}

export const ACTIVITY_CATEGORY_FILTERS: {
  id: ActivityCategory | 'all'
  label: string
}[] = [
  { id: 'all', label: 'All' },
  { id: 'assessment', label: 'Assessment' },
  { id: 'collaboration', label: 'Collaboration' },
  { id: 'communication', label: 'Communication' },
  { id: 'resources', label: 'Resources' },
  { id: 'interactive', label: 'Interactive content' },
  { id: 'extras', label: 'More' },
]

/** Moodle core set first (matches Add activity picker), then Pelbu extras. */
export const LESSON_ACTIVITY_TYPES: ActivityDefinition[] = [
  {
    type: 'assignment',
    label: 'Assignment',
    description: 'Collect student work with a due date and grade',
    category: 'assessment',
    icon: ClipboardList,
    fields: ['title', 'description', 'dueDate', 'maxGrade', 'passGrade', 'allowSubmissions', 'file'],
    maturity: 'working',
  },
  {
    type: 'book',
    label: 'Book',
    description: 'Multi-page reading content',
    category: 'resources',
    icon: BookOpen,
    fields: ['title', 'description', 'content'],
    maturity: 'partial',
  },
  {
    type: 'choice',
    label: 'Choice',
    description: 'Poll students with multiple options',
    category: 'assessment',
    icon: ListChecks,
    fields: ['title', 'description', 'choices'],
    maturity: 'working',
  },
  {
    type: 'database',
    label: 'Database',
    description: 'Shared collection of entries',
    category: 'collaboration',
    icon: Database,
    fields: ['title', 'description', 'content'],
    maturity: 'partial',
  },
  {
    type: 'file',
    label: 'File',
    description: 'PDF, PPT, or other reading material',
    category: 'resources',
    icon: File,
    fields: ['title', 'description', 'file', 'url'],
    maturity: 'working',
  },
  {
    type: 'folder',
    label: 'Folder',
    description: 'Group of related files',
    category: 'resources',
    icon: Folder,
    fields: ['title', 'description', 'file'],
    maturity: 'partial',
  },
  {
    type: 'forum',
    label: 'Forum',
    description: 'Discussion board for this lesson',
    category: 'collaboration',
    alsoIn: ['communication'],
    icon: MessagesSquare,
    fields: ['title', 'description'],
    maturity: 'partial',
  },
  {
    type: 'glossary',
    label: 'Glossary',
    description: 'Dictionary of terms for this lesson',
    category: 'collaboration',
    icon: BookMarked,
    fields: ['title', 'description', 'content'],
    maturity: 'partial',
  },
  {
    type: 'h5p',
    label: 'H5P',
    description: 'Interactive H5P content',
    category: 'interactive',
    icon: Puzzle,
    fields: ['title', 'description', 'url'],
    maturity: 'partial',
  },
  {
    type: 'ims',
    label: 'IMS content package',
    description: 'Upload or link an IMS Content Package',
    category: 'resources',
    icon: Boxes,
    fields: ['title', 'description', 'url', 'file'],
    maturity: 'stub',
  },
  {
    type: 'lesson',
    label: 'Lesson',
    description: 'Branching pages with questions and paths',
    category: 'interactive',
    alsoIn: ['assessment'],
    icon: GitBranch,
    fields: ['title', 'description', 'content', 'url'],
    maturity: 'stub',
  },
  {
    type: 'page',
    label: 'Page',
    description: 'A content page inside the lesson',
    category: 'resources',
    icon: FileText,
    fields: ['title', 'content'],
    maturity: 'partial',
  },
  {
    type: 'quiz',
    label: 'Quiz',
    description: 'Multiple-choice and other questions, stored and graded',
    category: 'assessment',
    icon: HelpCircle,
    fields: ['title', 'description', 'passGrade'],
    maturity: 'working',
  },
  {
    type: 'scorm',
    label: 'SCORM package',
    description: 'Upload or link a SCORM package',
    category: 'interactive',
    icon: Package,
    fields: ['title', 'description', 'url', 'file'],
    maturity: 'stub',
  },
  {
    type: 'label',
    label: 'Text and media area',
    description: 'Text or media embedded on the page',
    category: 'resources',
    icon: Type,
    fields: ['title', 'content'],
    maturity: 'partial',
  },
  {
    type: 'url',
    label: 'URL',
    description: 'Link to an external website',
    category: 'resources',
    icon: Link2,
    fields: ['title', 'description', 'url'],
    maturity: 'working',
  },
  {
    type: 'wiki',
    label: 'Wiki',
    description: 'Collaborative page students can edit',
    category: 'collaboration',
    icon: Library,
    fields: ['title', 'description', 'url'],
    maturity: 'partial',
  },
  {
    type: 'workshop',
    label: 'Workshop',
    description: 'Peer assessment activity',
    category: 'assessment',
    alsoIn: ['collaboration'],
    icon: Users,
    fields: ['title', 'description', 'dueDate', 'maxGrade'],
    maturity: 'partial',
  },
  // Pelbu extras (not in classic Moodle “All” core set)
  {
    type: 'chat',
    label: 'Chat',
    description: 'Real-time chat room for the lesson',
    category: 'communication',
    icon: MessageCircle,
    fields: ['title', 'description'],
    maturity: 'partial',
  },
  {
    type: 'feedback',
    label: 'Feedback',
    description: 'Custom survey / feedback form',
    category: 'extras',
    icon: MessageSquarePlus,
    fields: ['title', 'description', 'url'],
    maturity: 'partial',
  },
  {
    type: 'survey',
    label: 'Survey',
    description: 'Standard course survey',
    category: 'extras',
    icon: ClipboardCheck,
    fields: ['title', 'description', 'url'],
    maturity: 'partial',
  },
  {
    type: 'flashcard',
    label: 'Flashcards',
    description: 'Study cards for this lesson',
    category: 'extras',
    icon: BrainCircuit,
    fields: ['title', 'description'],
    maturity: 'partial',
  },
]

export function getActivityDef(type: LessonActivityType): ActivityDefinition | undefined {
  return LESSON_ACTIVITY_TYPES.find((a) => a.type === type)
}

export function activityMatchesCategory(
  def: ActivityDefinition,
  category: ActivityCategory | 'all'
): boolean {
  if (category === 'all') return true
  if (def.category === category) return true
  return Boolean(def.alsoIn?.includes(category))
}

export function filterActivityTypes(
  category: ActivityCategory | 'all',
  search: string
): ActivityDefinition[] {
  const q = search.trim().toLowerCase()
  return LESSON_ACTIVITY_TYPES.filter((a) => {
    if (!activityMatchesCategory(a, category)) return false
    if (!q) return true
    return (
      a.label.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.type.toLowerCase().includes(q)
    )
  })
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
