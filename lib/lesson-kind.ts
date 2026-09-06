import { parseLessonActivities } from '@/lib/lesson-activities'
import { parseLessonBlocks } from '@/lib/lesson-blocks'

export type LectureKind = 'video' | 'article' | 'resource'

export type LectureLike = {
  video_url?: string | null
  description?: string | null
  content?: unknown
  resources?: unknown
  metadata?: unknown
}

const KINDS: LectureKind[] = ['video', 'article', 'resource']

function metaKind(metadata: unknown): LectureKind | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const value = (metadata as Record<string, unknown>).lectureKind
  return KINDS.includes(value as LectureKind) ? (value as LectureKind) : null
}

export function withLectureKind(metadata: unknown, kind: LectureKind): Record<string, unknown> {
  const base =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {}
  return { ...base, lectureKind: kind }
}

export function inferLectureKind(lesson: LectureLike): LectureKind {
  if (lesson.video_url?.trim()) return 'video'
  const stored = metaKind(lesson.metadata)
  if (stored) return stored

  const activities = parseLessonActivities(lesson.resources)
  const hasFiles = activities.some(
    (item) => item.activity === 'file' || item.activity === 'folder' || Boolean(item.fileUrl)
  )
  const hasReading =
    Boolean(lesson.description?.trim()) || parseLessonBlocks(lesson.content).length > 0
  if (hasFiles && !hasReading) return 'resource'
  if (hasReading || activities.length > 0) return 'article'
  return 'video'
}

/** Lesson `duration_minutes` is stored as seconds (minutes * 60 in the editor). */
export function formatLectureDuration(storedSeconds?: number | null): string | null {
  if (!storedSeconds || storedSeconds <= 0) return null
  const minutes = Math.max(1, Math.round(storedSeconds / 60))
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60
    return rest ? `${hours}h ${rest}min` : `${hours}h`
  }
  return `${minutes}min`
}

export function lectureKindLabel(kind: LectureKind): string {
  if (kind === 'video') return 'Video'
  if (kind === 'article') return 'Article'
  return 'Resource'
}
