'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { BookOpen, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { resolveMediaUrl } from '@/lib/media'
import { resumeLearnPath } from '@/lib/resume-path'
import { cn } from '@/lib/utils'

export interface DashboardCourseCardProps {
  id: string
  title: string
  description?: string | null
  category?: string | null
  level?: string | null
  thumbnailUrl?: string | null
  progress?: number
  lastLessonId?: string | null
}

function Chip({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex min-w-0 max-w-full items-center gap-1 truncate rounded-md border border-border/80 bg-background px-2 py-0.5 text-[11px] font-medium text-foreground/80',
        className
      )}
    >
      {children}
    </span>
  )
}

export function DashboardCourseCard({
  id,
  title,
  description,
  category,
  level,
  thumbnailUrl,
  progress = 0,
  lastLessonId,
}: DashboardCourseCardProps) {
  const [imageError, setImageError] = useState(false)
  const pct = Math.max(0, Math.min(100, Math.round(progress)))
  const completed = pct >= 100
  const started = pct > 0
  const image = resolveMediaUrl(thumbnailUrl)
  const href = resumeLearnPath(id, lastLessonId)
  const brief = (description || '').trim()
  const ctaLabel = completed ? 'Review' : started ? 'Continue learning' : 'Start'
  const ctaClassName = cn(
    'h-9 w-full rounded-full text-sm font-medium',
    completed || started
      ? 'bg-green-600 text-white hover:bg-green-700'
      : 'bg-bhutan-yellow text-black hover:bg-bhutan-orange'
  )

  return (
    <Card className="group flex h-full min-w-0 flex-col gap-0 overflow-hidden border-border/60 bg-card py-0 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative w-full overflow-hidden bg-muted pt-[56.25%]">
        <Link
          href={href}
          className="absolute inset-0 block"
          aria-label={title}
        >
          {image && !imageError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-bhutan-yellow/20 to-bhutan-orange/20">
              <BookOpen className="h-12 w-12 text-bhutan-yellow" />
            </div>
          )}
          {brief ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-end bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <p className="line-clamp-3 text-xs leading-relaxed text-white/95 sm:text-sm">
                {brief}
              </p>
            </div>
          ) : null}
        </Link>

        {completed ? (
          <span className="pointer-events-none absolute left-2.5 top-2.5 z-30 inline-flex items-center gap-1 rounded-full bg-green-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </span>
        ) : null}
      </div>

      <Link href={href} className="block min-w-0 flex-1 cursor-pointer">
        <CardContent className="flex h-full min-w-0 flex-col gap-2.5 px-3.5 py-3">
          <h3 className="line-clamp-2 min-h-[2.5rem] text-[15px] font-bold leading-snug tracking-tight text-foreground">
            {title}
          </h3>

          <div className="flex min-h-[22px] min-w-0 items-center gap-1.5 overflow-hidden">
            {category ? (
              <Chip className="min-w-0 capitalize">{category}</Chip>
            ) : null}
            {level ? (
              <Chip className="shrink-0 capitalize">{level}</Chip>
            ) : null}
          </div>

          <div className="mt-auto space-y-1 pt-0.5">
            <div className="flex justify-between text-[11px] font-medium">
              <span className="text-muted-foreground">Progress</span>
              <span className="tabular-nums">{pct}%</span>
            </div>
            <Progress value={pct} className="h-1.5" />
          </div>
        </CardContent>
      </Link>

      <div className="mt-auto px-3.5 pb-3.5">
        <Button className={ctaClassName} render={<Link href={href} />}>
          {ctaLabel}
        </Button>
      </div>
    </Card>
  )
}
