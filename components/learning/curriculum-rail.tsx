'use client'

import { CheckCircle, Clock, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

export type CurriculumLesson = {
  id: string
  title: string
  duration_minutes?: number | null
}

type Props = {
  lessons: CurriculumLesson[]
  currentLessonId: string
  completedLessonIds: Set<string>
  lockedLessonIds?: Set<string>
  onSelect: (lessonId: string) => void
  className?: string
}

/**
 * Udemy-style slim curriculum rail — one job: pick the next lecture.
 */
export function CurriculumRail({
  lessons,
  currentLessonId,
  completedLessonIds,
  lockedLessonIds,
  onSelect,
  className,
}: Props) {
  return (
    <aside
      className={cn(
        'flex h-full max-h-[min(70vh,640px)] flex-col overflow-hidden rounded-xl border bg-background/80',
        className
      )}
    >
      <div className="border-b px-3 py-2.5">
        <p className="text-sm font-semibold">Curriculum</p>
        <p className="text-xs text-muted-foreground">{lessons.length} lessons</p>
      </div>
      <nav className="flex-1 overflow-y-auto p-1.5" aria-label="Course curriculum">
        <ul className="space-y-0.5">
          {lessons.map((lesson, index) => {
            const done = completedLessonIds.has(lesson.id)
            const current = lesson.id === currentLessonId
            const locked = lockedLessonIds?.has(lesson.id)
            return (
              <li key={lesson.id}>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => onSelect(lesson.id)}
                  className={cn(
                    'flex w-full min-h-11 items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                    locked && 'cursor-not-allowed opacity-55',
                    current
                      ? 'bg-bhutan-yellow/15 ring-1 ring-bhutan-yellow/50'
                      : !locked && 'hover:bg-muted/70'
                  )}
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                    {locked ? (
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : done ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {index + 1}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block truncate text-sm',
                        current ? 'font-semibold' : 'font-medium'
                      )}
                    >
                      {lesson.title || `Lesson ${index + 1}`}
                    </span>
                    {lesson.duration_minutes ? (
                      <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {Math.max(1, Math.round(lesson.duration_minutes / 60))}m
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
