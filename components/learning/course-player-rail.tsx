'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { CurriculumRail } from '@/components/learning/curriculum-rail'
import { CourseAssistant } from '@/components/learning/course-assistant'
import { cn } from '@/lib/utils'

type RailProps = React.ComponentProps<typeof CurriculumRail>
type AssistantLesson = {
  id: string
  title?: string | null
  resources?: unknown
}

export function CoursePlayerRail({
  assistantEnabled,
  courseId,
  tutorName,
  starterPrompts,
  className,
  lessons,
  currentLessonId,
  ...railProps
}: RailProps & {
  assistantEnabled: boolean
  courseId: string
  tutorName?: string
  starterPrompts?: string[]
}) {
  const [tab, setTab] = useState<'content' | 'assistant'>('content')

  if (!assistantEnabled) {
    return (
      <CurriculumRail
        className={className}
        lessons={lessons}
        currentLessonId={currentLessonId}
        {...railProps}
      />
    )
  }

  return (
    <aside
      className={cn(
        'flex h-full max-h-[min(80vh,760px)] flex-col overflow-hidden bg-background lg:max-h-none',
        className
      )}
    >
      <div className="flex border-b" role="tablist" aria-label="Lesson sidebar">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'content'}
          onClick={() => setTab('content')}
          className={cn(
            'min-h-11 flex-1 border-b-2 px-3 py-3 text-sm font-semibold',
            tab === 'content'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Course content
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'assistant'}
          onClick={() => setTab('assistant')}
          className={cn(
            'inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-3 text-sm font-semibold',
            tab === 'assistant'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
          AI Assistant
        </button>
      </div>
      {tab === 'content' ? (
        <CurriculumRail
          hideHeader
          lessons={lessons}
          currentLessonId={currentLessonId}
          className="min-h-0 max-h-none flex-1 border-0 lg:max-h-none"
          {...railProps}
        />
      ) : (
        <CourseAssistant
          courseId={courseId}
          lessonId={currentLessonId}
          tutorName={tutorName}
          starterPrompts={starterPrompts}
          lessons={lessons as AssistantLesson[]}
          className="min-h-0 flex-1"
        />
      )}
    </aside>
  )
}
