'use client'

import { ArrowLeft, CheckCircle, Loader2, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NotificationBell } from '@/components/layout/notification-bell'
import { cn } from '@/lib/utils'

type Props = {
  courseTitle?: string | null
  completedCount: number
  totalLessons: number
  progressPercent: number
  isCompleted: boolean
  savingProgress?: boolean
  completeDisabled?: boolean
  completeHint?: string | null
  onBack: () => void
  onToggleComplete: () => void
}

function ProgressRing({ percent }: { percent: number }) {
  const size = 36
  const stroke = 3.5
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, percent))
  const offset = c - (pct / 100) * c

  return (
    <svg width={size} height={size} className="-rotate-90" aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        className="text-muted"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        className="text-bhutan-yellow"
      />
    </svg>
  )
}

/**
 * Udemy-style player chrome: course title, circular progress, complete.
 */
export function LessonPlayerHeader({
  courseTitle,
  completedCount,
  totalLessons,
  progressPercent,
  isCompleted,
  savingProgress,
  completeDisabled = false,
  completeHint,
  onBack,
  onToggleComplete,
}: Props) {
  const pct = Math.min(100, Math.max(0, progressPercent))

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
      <div className="flex min-h-14 items-center gap-2 px-2 sm:px-4">
        <Button
          variant="ghost"
          size="sm"
          className="min-h-11 shrink-0 gap-1.5 px-2"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </Button>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold sm:text-base">
          {courseTitle || 'Course'}
        </p>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <div
            className="hidden items-center gap-2 sm:flex"
            title={`${completedCount} of ${totalLessons} lectures complete`}
          >
            <ProgressRing percent={pct} />
            <span className="text-xs font-medium leading-tight">
              Your progress
              <span className="block text-muted-foreground">
                {pct}% · {completedCount}/{Math.max(totalLessons, 1)}
              </span>
            </span>
          </div>
          <Trophy className="h-4 w-4 text-bhutan-yellow sm:hidden" aria-hidden />
          <Button
            size="sm"
            onClick={onToggleComplete}
            disabled={savingProgress || completeDisabled}
            className={cn(
              'min-h-11',
              isCompleted
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-bhutan-yellow text-black hover:bg-bhutan-orange'
            )}
          >
            {savingProgress ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="mr-1.5 h-4 w-4" />
            )}
            <span className="hidden sm:inline">{isCompleted ? 'Completed' : 'Complete'}</span>
            <span className="sm:hidden">{isCompleted ? 'Done' : 'Done?'}</span>
          </Button>
          <NotificationBell compact />
        </div>
      </div>
      {completeHint ? (
        <p className="border-t px-4 py-1.5 text-xs text-muted-foreground">{completeHint}</p>
      ) : null}
    </header>
  )
}
