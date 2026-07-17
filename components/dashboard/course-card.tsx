'use client'

import Link from 'next/link'
import { BookOpen, PlayCircle, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { resolveMediaUrl } from '@/lib/media'
import { cn } from '@/lib/utils'

export interface DashboardCourseCardProps {
  id: string
  title: string
  description?: string | null
  category?: string | null
  level?: string | null
  thumbnailUrl?: string | null
  progress?: number
}

export function DashboardCourseCard({
  id,
  title,
  description,
  category,
  level,
  thumbnailUrl,
  progress = 0,
}: DashboardCourseCardProps) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)))
  const completed = pct >= 100
  const started = pct > 0
  const image = resolveMediaUrl(thumbnailUrl)

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-all hover:border-bhutan-yellow/50 hover:shadow-lg sm:flex-row">
      {/* Image — left on desktop, top on mobile */}
      <div className="relative aspect-video w-full flex-shrink-0 overflow-hidden bg-gradient-to-br from-bhutan-yellow/20 to-bhutan-orange/20 sm:aspect-auto sm:w-56 md:w-64">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BookOpen className="h-12 w-12 text-bhutan-orange/60" />
          </div>
        )}
        {completed && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-green-600/95 px-2.5 py-1 text-xs font-medium text-white shadow">
            <CheckCircle2 className="h-3.5 w-3.5" /> Completed
          </span>
        )}
      </div>

      {/* Content — right */}
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-4 p-4 sm:p-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {category && <Badge variant="outline" className="text-xs capitalize">{category}</Badge>}
            {level && <Badge variant="secondary" className="text-xs capitalize">{level}</Badge>}
          </div>
          <h3 className="line-clamp-1 text-lg font-semibold leading-tight">{title}</h3>
          {description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">{description}</p>
          )}
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium tabular-nums">{pct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  completed
                    ? 'bg-green-600'
                    : 'bg-gradient-to-r from-bhutan-yellow to-bhutan-orange'
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <Button
            asChild
            className="w-full bg-bhutan-yellow text-black hover:bg-bhutan-orange sm:w-auto"
          >
            <Link href={`/learn/${id}`}>
              <PlayCircle className="mr-1.5 h-4 w-4" />
              {completed ? 'Review course' : started ? 'Continue' : 'Start learning'}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
