'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronUp, FileText, Lock, Paperclip, Video } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formatLectureDuration,
  inferLectureKind,
  type LectureKind,
} from '@/lib/lesson-kind'
import { parseLessonActivities } from '@/lib/lesson-activities'

export type CurriculumLesson = {
  id: string
  title: string
  module_id?: string | null
  duration_minutes?: number | null
  video_url?: string | null
  description?: string | null
  content?: unknown
  resources?: unknown
  metadata?: unknown
}

export type CurriculumModule = {
  id: string
  title: string
}

type Props = {
  lessons: CurriculumLesson[]
  modules?: CurriculumModule[]
  currentLessonId: string
  completedLessonIds: Set<string>
  lockedLessonIds?: Set<string>
  onSelect: (lessonId: string) => void
  className?: string
}

function KindIcon({ kind }: { kind: LectureKind }) {
  if (kind === 'article') return <FileText className="h-3.5 w-3.5" />
  if (kind === 'resource') return <Paperclip className="h-3.5 w-3.5" />
  return <Video className="h-3.5 w-3.5" />
}

/**
 * Udemy-style course content rail — sections, numbered lectures, type + duration.
 */
export function CurriculumRail({
  lessons,
  modules,
  currentLessonId,
  completedLessonIds,
  lockedLessonIds,
  onSelect,
  className,
}: Props) {
  const sections = useMemo(() => {
    const byModule = new Map<string, CurriculumLesson[]>()
    for (const lesson of lessons) {
      const key = lesson.module_id || '_none'
      const list = byModule.get(key) || []
      list.push(lesson)
      byModule.set(key, list)
    }

    const orderedModules =
      modules && modules.length > 0
        ? modules.filter((mod) => (byModule.get(mod.id) || []).length > 0)
        : []

    if (orderedModules.length === 0) {
      return [
        {
          id: '_all',
          title: 'Course content',
          lessons,
        },
      ]
    }

    return orderedModules.map((mod) => ({
      id: mod.id,
      title: mod.title || 'Section',
      lessons: byModule.get(mod.id) || [],
    }))
  }, [lessons, modules])

  const currentSectionId = useMemo(() => {
    const found = sections.find((section) =>
      section.lessons.some((lesson) => lesson.id === currentLessonId)
    )
    return found?.id || sections[0]?.id
  }, [sections, currentLessonId])

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!currentSectionId) return
    setCollapsed((prev) => {
      if (!prev.has(currentSectionId)) return prev
      const next = new Set(prev)
      next.delete(currentSectionId)
      return next
    })
  }, [currentSectionId])

  const lectureNumbers = useMemo(() => {
    const numbers = new Map<string, number>()
    let n = 0
    for (const section of sections) {
      for (const lesson of section.lessons) {
        n += 1
        numbers.set(lesson.id, n)
      }
    }
    return numbers
  }, [sections])

  const completedCount = lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length

  return (
    <aside
      className={cn(
        'flex h-full max-h-[min(80vh,760px)] flex-col overflow-hidden bg-background lg:max-h-[calc(100vh-5.5rem)]',
        className
      )}
    >
      <div className="border-b px-4 py-3">
        <p className="text-sm font-semibold">Course content</p>
        <p className="text-xs text-muted-foreground">
          {completedCount}/{lessons.length} lectures
        </p>
      </div>
      <nav className="flex-1 overflow-y-auto" aria-label="Course content">
        {sections.map((section, sectionIndex) => {
          const open = !collapsed.has(section.id)
          const sectionDone = section.lessons.filter((l) => completedLessonIds.has(l.id)).length
          const sectionMins = section.lessons.reduce((sum, l) => sum + (l.duration_minutes || 0), 0)
          const sectionDuration = formatLectureDuration(sectionMins)

          return (
            <div key={section.id} className="border-b last:border-b-0">
              <button
                type="button"
                onClick={() =>
                  setCollapsed((prev) => {
                    const next = new Set(prev)
                    if (next.has(section.id)) next.delete(section.id)
                    else next.add(section.id)
                    return next
                  })
                }
                className="flex w-full items-start justify-between gap-2 bg-muted/40 px-3 py-2.5 text-left hover:bg-muted/70"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-snug">
                    Section {sectionIndex + 1}: {section.title}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {sectionDone}/{section.lessons.length}
                    {sectionDuration ? ` · ${sectionDuration}` : ''}
                  </span>
                </span>
                {open ? (
                  <ChevronUp className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>

              {open ? (
                <ul>
                  {section.lessons.map((lesson) => {
                    const number = lectureNumbers.get(lesson.id) ?? 0
                    const done = completedLessonIds.has(lesson.id)
                    const current = lesson.id === currentLessonId
                    const locked = lockedLessonIds?.has(lesson.id)
                    const kind = inferLectureKind(lesson)
                    const duration = formatLectureDuration(lesson.duration_minutes)
                    const resourceCount = parseLessonActivities(lesson.resources).length

                    return (
                      <li key={lesson.id}>
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => onSelect(lesson.id)}
                          className={cn(
                            'flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors',
                            locked && 'cursor-not-allowed opacity-55',
                            current
                              ? 'bg-bhutan-yellow/15'
                              : !locked && 'hover:bg-muted/60'
                          )}
                        >
                          <span
                            className={cn(
                              'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border',
                              done
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-muted-foreground/40 bg-background'
                            )}
                            aria-hidden
                          >
                            {locked ? (
                              <Lock className="h-2.5 w-2.5 text-muted-foreground" />
                            ) : done ? (
                              <Check className="h-3 w-3" />
                            ) : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                'block text-sm leading-snug',
                                current ? 'font-semibold' : 'font-medium'
                              )}
                            >
                              {number}. {lesson.title || `Lecture ${number}`}
                            </span>
                            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <KindIcon kind={kind} />
                                {duration || lectureKindLabelFallback(kind)}
                              </span>
                              {resourceCount > 0 ? (
                                <span className="inline-flex items-center gap-1">
                                  <Paperclip className="h-3 w-3" />
                                  {resourceCount}
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}

function lectureKindLabelFallback(kind: LectureKind) {
  if (kind === 'article') return 'Article'
  if (kind === 'resource') return 'Resource'
  return 'Video'
}