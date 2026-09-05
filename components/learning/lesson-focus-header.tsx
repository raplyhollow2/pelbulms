'use client'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, CheckCircle, Loader2 } from 'lucide-react'

type Props = {
  courseTitle?: string | null
  moduleTitle?: string | null
  lessonTitle: string
  lessonDescription?: string | null
  completedCount: number
  totalLessons: number
  progressPercent: number
  isCompleted: boolean
  savingProgress?: boolean
  /** When true, Mark complete is disabled (e.g. mandatory activities unfinished) */
  completeDisabled?: boolean
  completeHint?: string | null
  onBack: () => void
  onToggleComplete: () => void
  headingColor?: string
}

/**
 * Coursera-style compact progress header for the learn lesson stage.
 */
export function LessonFocusHeader({
  courseTitle,
  moduleTitle,
  lessonTitle,
  lessonDescription,
  completedCount,
  totalLessons,
  progressPercent,
  isCompleted,
  savingProgress,
  completeDisabled = false,
  completeHint,
  onBack,
  onToggleComplete,
  headingColor,
}: Props) {
  const safeTotal = Math.max(totalLessons, 1)
  const pct = Math.min(100, Math.max(0, progressPercent))

  return (
    <header className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" className="min-h-11 -ml-2" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {courseTitle || 'Back to course'}
        </Button>
        <Button
          size="sm"
          onClick={onToggleComplete}
          disabled={savingProgress || completeDisabled}
          className={`min-h-11 ${
            isCompleted
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-bhutan-yellow text-black hover:bg-bhutan-orange'
          }`}
        >
          {savingProgress ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="mr-2 h-4 w-4" />
          )}
          {isCompleted ? 'Completed' : 'Mark complete'}
        </Button>
      </div>
      {completeHint ? (
        <p className="text-xs text-muted-foreground">{completeHint}</p>
      ) : null}

      <div className="space-y-1">
        {moduleTitle ? (
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {moduleTitle}
          </p>
        ) : null}
        <h1
          className="text-2xl font-semibold tracking-tight sm:text-3xl"
          style={headingColor ? { color: headingColor } : undefined}
        >
          {lessonTitle}
        </h1>
        {lessonDescription ? (
          <p className="max-w-3xl text-sm text-muted-foreground line-clamp-2">
            {lessonDescription}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5 rounded-lg border bg-background/60 px-3 py-2.5">
        <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
          <span className="text-muted-foreground">
            {completedCount} of {safeTotal} lessons complete
          </span>
          <span className="font-semibold text-bhutan-yellow">{pct}%</span>
        </div>
        <Progress value={pct} className="h-2" />
      </div>
    </header>
  )
}
