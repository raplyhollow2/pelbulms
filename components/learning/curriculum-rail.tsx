'use client'
import { Button } from '@/components/ui/button'

import { useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileText,
  Image as ImageIcon,
  Layers,
  ListChecks,
  ListTree,
  Lock,
  Paperclip,
  Play,
  Video,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formatLectureDuration,
  inferLectureKind,
  type LectureKind,
} from '@/lib/lesson-kind'
import { getActivityDef, parseLessonActivities } from '@/lib/lesson-activities'
import { parseLessonBlocks, type LessonBlock } from '@/lib/lesson-blocks'

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
  /** Open a lesson and focus one activity, resource, or uploaded block. */
  onSelectActivity?: (lessonId: string, itemKey: string) => void
  /** Item currently scrolled into view on the open lesson (`activity:` or `block:`). */
  activeActivityId?: string | null
  /** Completed activity ids for the open lesson. */
  completedActivityIds?: Set<string>
  /** Hide the “Course content” title when a parent tab already shows it. */
  hideHeader?: boolean
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
  onSelectActivity,
  activeActivityId,
  completedActivityIds,
  hideHeader = false,
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
  const [openLessons, setOpenLessons] = useState<Set<string>>(
    () => new Set(currentLessonId ? [currentLessonId] : [])
  )

  useEffect(() => {
    if (!currentLessonId) return
    const current = lessons.find((lesson) => lesson.id === currentLessonId)
    if (!current || lessonMenuEntries(current).length === 0) return
    setOpenLessons((prev) => {
      if (prev.has(currentLessonId)) return prev
      const next = new Set(prev)
      next.add(currentLessonId)
      return next
    })
  }, [currentLessonId, lessons])

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

  const Frame = hideHeader ? 'div' : 'aside'

  return (
    <Frame
      className={cn(
        'flex h-full max-h-[min(80vh,760px)] flex-col overflow-hidden bg-background lg:max-h-[calc(100vh-5.5rem)]',
        hideHeader && 'max-h-none lg:max-h-none',
        className
      )}
    >
      {hideHeader ? (
        <p className="border-b px-4 py-2 text-xs text-muted-foreground">
          {completedCount}/{lessons.length} lectures
        </p>
      ) : (
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold">Course content</p>
          <p className="text-xs text-muted-foreground">
            {completedCount}/{lessons.length} lectures
          </p>
        </div>
      )}
      <nav className="flex-1 overflow-y-auto" aria-label="Course content">
        {sections.map((section, sectionIndex) => {
          const open = !collapsed.has(section.id)
          const sectionDone = section.lessons.filter((l) => completedLessonIds.has(l.id)).length
          const sectionMins = section.lessons.reduce((sum, l) => sum + (l.duration_minutes || 0), 0)
          const sectionDuration = formatLectureDuration(sectionMins)

          return (
            <div key={section.id} className="border-b last:border-b-0">
              <Button
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
              </Button>

              {open ? (
                <ul>
                  {section.lessons.map((lesson) => {
                    const number = lectureNumbers.get(lesson.id) ?? 0
                    const done = completedLessonIds.has(lesson.id)
                    const current = lesson.id === currentLessonId
                    const locked = lockedLessonIds?.has(lesson.id)
                    const kind = inferLectureKind(lesson)
                    const duration = formatLectureDuration(lesson.duration_minutes)
                    const activities = lessonMenuEntries(lesson)
                    const activitiesOpen = openLessons.has(lesson.id) && activities.length > 0

                    return (
                      <li key={lesson.id}>
                        <div
                          className={cn(
                            'flex items-start',
                            locked && 'opacity-55',
                            current ? 'bg-primary/15' : !locked && 'hover:bg-muted/60'
                          )}
                        >
                          <Button
                            type="button"
                            disabled={locked}
                            onClick={() => {
                              onSelect(lesson.id)
                              if (activities.length > 0) {
                                setOpenLessons((prev) => {
                                  if (prev.has(lesson.id)) return prev
                                  const next = new Set(prev)
                                  next.add(lesson.id)
                                  return next
                                })
                              }
                            }}
                            className={cn(
                              'flex min-w-0 flex-1 items-start gap-2.5 px-3 py-2.5 text-left',
                              locked && 'cursor-not-allowed'
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
                                {activities.length > 0 ? (
                                  <span className="inline-flex items-center gap-1">
                                    <Paperclip className="h-3 w-3" />
                                    {activities.length}
                                  </span>
                                ) : null}
                              </span>
                            </span>
                          </Button>
                          {activities.length > 0 ? (
                            <Button
                              type="button"
                              aria-expanded={activitiesOpen}
                              aria-label={
                                activitiesOpen
                                  ? `Hide activities and resources for ${lesson.title || 'lecture'}`
                                  : `Show activities and resources for ${lesson.title || 'lecture'}`
                              }
                              onClick={() =>
                                setOpenLessons((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(lesson.id)) next.delete(lesson.id)
                                  else next.add(lesson.id)
                                  return next
                                })
                              }
                              className="mt-2 mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background/70"
                            >
                              {activitiesOpen ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          ) : null}
                        </div>
                        {activitiesOpen ? (
                          <LessonActivityMenu
                            activities={activities}
                            locked={Boolean(locked)}
                            current={current}
                            activeActivityId={activeActivityId}
                            completedActivityIds={current ? completedActivityIds : undefined}
                            onSelect={(activityId) => {
                              if (onSelectActivity) onSelectActivity(lesson.id, activityId)
                              else onSelect(lesson.id)
                            }}
                          />
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </div>
          )
        })}
      </nav>
    </Frame>
  )
}

type MenuEntry = {
  key: string
  title: string
  label: string
  icon: LucideIcon
}

function lessonMenuEntries(lesson: CurriculumLesson): MenuEntry[] {
  const entries: MenuEntry[] = []
  for (const activity of parseLessonActivities(lesson.resources)) {
    const def = getActivityDef(activity.activity)
    entries.push({
      key: `activity:${activity.id}`,
      title: activity.title || def?.label || 'Item',
      label: def?.label || activity.activity,
      icon: def?.icon ?? Paperclip,
    })
  }
  for (const block of parseLessonBlocks(lesson.content)) {
    const entry = blockMenuEntry(block)
    if (entry) entries.push(entry)
  }
  return entries
}

function blockMenuEntry(block: LessonBlock): MenuEntry | null {
  const key = `block:${block.id}`
  switch (block.type) {
    case 'youtube':
      return { key, title: 'YouTube video', label: 'Resource', icon: Play }
    case 'video':
      return { key, title: 'Video', label: 'Resource', icon: Video }
    case 'image':
      return { key, title: block.alt?.trim() || 'Image', label: 'Resource', icon: ImageIcon }
    case 'quiz':
      return { key, title: 'Quiz', label: 'Activity', icon: ListChecks }
    case 'assignment':
      return { key, title: 'Assignment', label: 'Activity', icon: ClipboardList }
    case 'scenario':
      return { key, title: 'Scenario', label: 'Activity', icon: ListChecks }
    case 'flashcards':
      return { key, title: 'Flashcards', label: 'Activity', icon: Layers }
    case 'flipcards':
      return { key, title: 'Flip cards', label: 'Activity', icon: Layers }
    case 'accordion':
      return {
        key,
        title: block.items.find((item) => item.title.trim())?.title || 'Accordion',
        label: 'Activity',
        icon: ListTree,
      }
    case 'carousel':
      return { key, title: 'Carousel', label: 'Activity', icon: Layers }
    case 'hotspot':
      return { key, title: 'Hotspot', label: 'Activity', icon: ImageIcon }
    default:
      return null
  }
}

function LessonActivityMenu({
  activities,
  locked,
  current,
  activeActivityId,
  completedActivityIds,
  onSelect,
}: {
  activities: MenuEntry[]
  locked: boolean
  current: boolean
  activeActivityId?: string | null
  completedActivityIds?: Set<string>
  onSelect: (itemKey: string) => void
}) {
  return (
    <ul className="border-t bg-muted/20 py-1" aria-label="Activities and resources">
      {activities.map((activity) => {
        const Icon = activity.icon
        const active = current && activeActivityId === activity.key
        const activityId = activity.key.startsWith('activity:')
          ? activity.key.slice('activity:'.length)
          : null
        const done = Boolean(activityId && completedActivityIds?.has(activityId))
        return (
          <li key={activity.key}>
            <Button
              type="button"
              disabled={locked}
              onClick={() => onSelect(activity.key)}
              className={cn(
                'flex w-full items-start gap-2 py-1.5 pr-3 pl-9 text-left',
                locked && 'cursor-not-allowed opacity-55',
                active ? 'bg-primary/25' : !locked && 'hover:bg-muted/70'
              )}
            >
              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] leading-snug">{activity.title}</span>
                <span className="text-[10px] text-muted-foreground">{activity.label}</span>
              </span>
              {done ? <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" /> : null}
            </Button>
          </li>
        )
      })}
    </ul>
  )
}

function lectureKindLabelFallback(kind: LectureKind) {
  if (kind === 'article') return 'Article'
  if (kind === 'resource') return 'Resource'
  return 'Video'
}