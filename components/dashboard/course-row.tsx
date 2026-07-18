'use client'

import Link from 'next/link'
import { BookOpen, Play, CheckCircle2, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { resolveMediaUrl } from '@/lib/media'
import { cn } from '@/lib/utils'

export interface DashboardCourseRowProps {
  id: string
  title: string
  category?: string | null
  level?: string | null
  thumbnailUrl?: string | null
  progress?: number
  compact?: boolean
}

/** Dense enterprise row — designed for dozens of enrollments without endless tall cards. */
export function DashboardCourseRow({
  id,
  title,
  category,
  level,
  thumbnailUrl,
  progress = 0,
  compact = false,
}: DashboardCourseRowProps) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)))
  const completed = pct >= 100
  const started = pct > 0
  const image = resolveMediaUrl(thumbnailUrl)

  return (
    <Link
      href={`/learn/${id}`}
        className={cn(
          'group flex items-center gap-2.5 rounded-lg border border-border/50 bg-card/80 px-2.5 py-2 transition-all hover:border-bhutan-yellow/40 hover:bg-card hover:shadow-sm',
          compact && 'py-1.5'
        )}
      >
      <div
        className={cn(
          'relative shrink-0 overflow-hidden rounded-md bg-gradient-to-br from-bhutan-yellow/20 to-bhutan-orange/20',
          compact ? 'h-9 w-9' : 'h-10 w-10 sm:h-9 sm:w-12'
        )}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BookOpen className="h-3.5 w-3.5 text-bhutan-orange/70" />
          </div>
        )}
        {completed && (
          <span className="absolute inset-0 flex items-center justify-center bg-green-600/80">
            <CheckCircle2 className="h-3.5 w-3.5 text-white" />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-sm font-semibold leading-snug tracking-tight group-hover:text-bhutan-orange">
            {title}
          </h3>
          <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
            {pct}%
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {category && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] capitalize">
              {category}
            </Badge>
          )}
          {level && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] capitalize">
              {level}
            </Badge>
          )}
          {completed && (
            <span className="text-[10px] font-medium text-green-600">Completed</span>
          )}
        </div>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              completed
                ? 'bg-green-600'
                : 'bg-gradient-to-r from-bhutan-yellow to-bhutan-orange'
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <span className="hidden shrink-0 items-center gap-1 rounded-full bg-bhutan-yellow/90 px-2.5 py-1 text-xs font-medium text-black sm:inline-flex">
        <Play className="h-3.5 w-3.5" />
        {completed ? 'Review' : started ? 'Continue' : 'Start'}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground sm:hidden" />
    </Link>
  )
}
