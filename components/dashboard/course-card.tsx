'use client'

import Link from 'next/link'
import { BookOpen, PlayCircle, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { resolveMediaUrl } from '@/lib/media'

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
    <Card size="sm" className="h-full transition-shadow hover:shadow-md">
      <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-bhutan-yellow/20 to-bhutan-orange/20">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BookOpen className="h-10 w-10 text-bhutan-orange/60" />
          </div>
        )}
        {completed && (
          <Badge className="absolute left-3 top-3 gap-1 bg-green-600 text-white hover:bg-green-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Completed
          </Badge>
        )}
      </div>

      <CardHeader>
        <div className="flex flex-wrap gap-1.5">
          {category && (
            <Badge variant="outline" className="capitalize">
              {category}
            </Badge>
          )}
          {level && (
            <Badge variant="secondary" className="capitalize">
              {level}
            </Badge>
          )}
        </div>
        <CardTitle className="line-clamp-2">{title}</CardTitle>
        {description && (
          <CardDescription className="line-clamp-2">{description}</CardDescription>
        )}
      </CardHeader>

      <CardContent className="mt-auto space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium tabular-nums">{pct}%</span>
        </div>
        <Progress value={pct} className="h-2" />
      </CardContent>

      <CardFooter>
        <Button
          className="w-full gap-1.5 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
          size="sm"
          render={<Link href={`/learn/${id}`} />}
        >
          <PlayCircle className="h-4 w-4" />
          {completed ? 'Review' : started ? 'Continue' : 'Start'}
        </Button>
      </CardFooter>
    </Card>
  )
}
