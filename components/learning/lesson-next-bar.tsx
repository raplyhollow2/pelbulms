'use client'

import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  currentIndex: number
  total: number
  currentTitle?: string
  canGoPrev: boolean
  canGoNext: boolean
  onPrev: () => void
  onNext: () => void
  className?: string
  sticky?: boolean
}

/**
 * Sticky Prev / Next controls — primary learner action after watching.
 */
export function LessonNextBar({
  currentIndex,
  total,
  currentTitle,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  className,
  sticky = false,
}: Props) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 border-t bg-background/95 px-1 py-3 backdrop-blur',
        sticky &&
          'sticky bottom-0 z-20 -mx-1 border-x border-b px-3 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] sm:static sm:mx-0 sm:border-0 sm:px-1 sm:shadow-none',
        className
      )}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11 gap-1"
        onClick={onPrev}
        disabled={!canGoPrev}
      >
        <ChevronLeft className="h-4 w-4" />
        Previous
      </Button>
      <p className="min-w-0 flex-1 truncate px-2 text-center text-xs text-muted-foreground">
        {currentIndex + 1} / {total}
        {currentTitle ? ` · ${currentTitle}` : ''}
      </p>
      <Button
        type="button"
        size="sm"
        className="min-h-11 gap-1 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
        onClick={onNext}
        disabled={!canGoNext}
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
