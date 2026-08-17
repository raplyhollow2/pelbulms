'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download, ExternalLink, HelpCircle } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/media'
import {
  getActivityDef,
  parseLessonActivities,
  type LessonActivity,
} from '@/lib/lesson-activities'

function activityHref(item: LessonActivity): string | null {
  const raw = item.fileUrl || item.url
  if (!raw) return null
  return resolveMediaUrl(raw) || raw
}

export function LessonResources({
  resources,
  extraResources,
  onTakeQuiz,
}: {
  resources?: unknown
  extraResources?: unknown
  onTakeQuiz?: (quizId: string) => void
}) {
  const items = [
    ...parseLessonActivities(extraResources),
    ...parseLessonActivities(resources),
  ]

  if (items.length === 0) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg">Activities & resources</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No activities or files have been added to this lesson yet.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-lg">Activities & resources</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => {
          const def = getActivityDef(item.activity)
          const Icon = def?.icon
          const href = activityHref(item)
          const isQuiz = item.activity === 'quiz' && item.quizId
          return (
            <div
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-lg border p-3"
            >
              <div className="flex min-w-0 items-start gap-2">
                {Icon ? (
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-bhutan-yellow" />
                ) : null}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">{item.title || 'Item'}</p>
                    <Badge variant="secondary" className="text-[10px]">
                      {def?.label || item.activity}
                    </Badge>
                  </div>
                  {item.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                  {item.content && (
                    <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-xs text-muted-foreground">
                      {item.content}
                    </p>
                  )}
                  {item.choices && item.choices.length > 0 && (
                    <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
                      {item.choices.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              {isQuiz ? (
                <Button
                  type="button"
                  size="sm"
                  className="min-h-11 shrink-0 gap-1 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
                  onClick={() => onTakeQuiz?.(item.quizId!)}
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  Take quiz
                </Button>
              ) : href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md border border-border px-3 text-sm hover:bg-muted"
                >
                  <Download className="h-3.5 w-3.5" />
                  Open
                  <ExternalLink className="h-3 opacity-60" />
                </a>
              ) : null}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
