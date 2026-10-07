'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ChevronDown, Play, Lock, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatLectureDuration } from '@/lib/lesson-kind'

interface Lesson {
  id: string
  title: string
  description?: string
  duration_minutes?: number
  type?: 'video' | 'reading' | 'quiz' | 'assignment'
  is_completed?: boolean
  is_locked?: boolean
  is_preview?: boolean
  is_upcoming?: boolean
}

interface Module {
  id: string
  title: string
  description?: string
  order_index: number
  lessons?: Lesson[]
  is_locked?: boolean
}

interface CurriculumTimelineProps {
  modules: Module[]
  currentLessonId?: string
  onLessonClick?: (lessonId: string) => void
  showProgress?: boolean
  overallProgress?: number
}

function moduleSeconds(module: Module) {
  return (module.lessons || []).reduce((sum, lesson) => sum + (lesson.duration_minutes || 0), 0)
}

export function CurriculumTimeline({
  modules,
  currentLessonId,
  onLessonClick,
  showProgress = false,
  overallProgress = 0,
}: CurriculumTimelineProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set(modules.slice(0, 1).map((moduleRow) => moduleRow.id))
  )

  const lectureCount = modules.reduce((sum, moduleRow) => sum + (moduleRow.lessons?.length || 0), 0)
  const totalLabel = formatLectureDuration(
    modules.reduce((sum, moduleRow) => sum + moduleSeconds(moduleRow), 0)
  )
  const allExpanded = modules.length > 0 && modules.every((moduleRow) => expandedModules.has(moduleRow.id))

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev)
      if (next.has(moduleId)) next.delete(moduleId)
      else next.add(moduleId)
      return next
    })
  }

  const toggleAll = () => {
    setExpandedModules(allExpanded ? new Set() : new Set(modules.map((moduleRow) => moduleRow.id)))
  }

  const summary = [
    `${modules.length} ${modules.length === 1 ? 'section' : 'sections'}`,
    `${lectureCount} ${lectureCount === 1 ? 'lecture' : 'lectures'}`,
    totalLabel,
  ]
    .filter(Boolean)
    .join(' • ')

  return (
    <div className="space-y-3">
      {showProgress && (
        <div className="rounded-lg border p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Your progress</span>
            <span className="text-sm font-bold text-primary">{overallProgress}%</span>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{summary}</p>
        {modules.length > 0 && (
          <button
            type="button"
            onClick={toggleAll}
            className="shrink-0 text-sm font-semibold text-primary"
          >
            {allExpanded ? 'Collapse all' : 'Expand all'}
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border">
        {modules.map((module, moduleIndex) => {
          const isExpanded = expandedModules.has(module.id)
          const lessons = module.lessons || []
          const duration = formatLectureDuration(moduleSeconds(module))

          return (
            <div key={module.id} className={moduleIndex > 0 ? 'border-t' : undefined}>
              <button
                type="button"
                className="flex w-full items-start gap-3 bg-muted/70 px-3 py-3 text-left"
                aria-expanded={isExpanded}
                onClick={() => toggleModule(module.id)}
              >
                <ChevronDown
                  className={cn(
                    'mt-0.5 h-4 w-4 shrink-0 transition-transform',
                    isExpanded ? 'rotate-0' : '-rotate-90'
                  )}
                />
                <span className="min-w-0 flex-1 text-sm font-semibold">{module.title}</span>
                <span className="shrink-0 text-right text-xs text-muted-foreground">
                  {lessons.length} {lessons.length === 1 ? 'lecture' : 'lectures'}
                  {duration ? ` • ${duration}` : ''}
                </span>
              </button>

              {isExpanded && lessons.length > 0 && (
                <ul>
                  {lessons.map((lesson) => {
                    const isCurrent = lesson.id === currentLessonId
                    const lessonDuration = formatLectureDuration(lesson.duration_minutes)
                    return (
                      <li key={lesson.id} className="border-t">
                        <button
                          type="button"
                          className={cn(
                            'flex w-full items-start gap-3 px-3 py-3 text-left',
                            isCurrent && 'bg-primary/10'
                          )}
                          onClick={() => onLessonClick?.(lesson.id)}
                        >
                          {lesson.is_locked ? (
                            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          ) : lesson.type === 'reading' ? (
                            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <Play className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm">{lesson.title}</span>
                            {lesson.is_preview && (
                              <Badge variant="outline" className="mt-1 text-[10px]">
                                Preview
                              </Badge>
                            )}
                            {lesson.is_upcoming && (
                              <Badge variant="outline" className="mt-1 text-[10px]">
                                Upcoming
                              </Badge>
                            )}
                          </span>
                          {lessonDuration && (
                            <span className="shrink-0 text-xs text-muted-foreground">{lessonDuration}</span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
