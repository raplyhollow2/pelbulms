'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Download, ExternalLink, HelpCircle, Loader2 } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/media'
import {
  getActivityDef,
  isActivityRequired,
  parseLessonActivities,
  type LessonActivity,
} from '@/lib/lesson-activities'

export type ActivityProgressItem = {
  id: string
  completed?: boolean
  source?: string | null
}

function activityHref(item: LessonActivity): string | null {
  const raw = item.fileUrl || item.url
  if (!raw) return null
  return resolveMediaUrl(raw) || raw
}

export function LessonResources({
  resources,
  extraResources,
  onTakeQuiz,
  progressById,
  mandatoryTotal = 0,
  mandatoryCompleted = 0,
  onMarkDone,
  markingActivityId,
}: {
  resources?: unknown
  extraResources?: unknown
  onTakeQuiz?: (quizId: string) => void
  progressById?: Record<string, ActivityProgressItem>
  mandatoryTotal?: number
  mandatoryCompleted?: number
  onMarkDone?: (activityId: string) => void | Promise<void>
  markingActivityId?: string | null
}) {
  // Lesson activities are progress-tracked; module extras are display-only.
  const lessonItems = parseLessonActivities(resources).map((item) => ({
    ...item,
    trackable: true as const,
  }))
  const moduleItems = parseLessonActivities(extraResources).map((item) => ({
    ...item,
    trackable: false as const,
  }))
  const items = [...moduleItems, ...lessonItems]

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
      <CardHeader className="space-y-1">
        <CardTitle className="text-lg">Activities & resources</CardTitle>
        {mandatoryTotal > 0 && (
          <p className="text-xs text-muted-foreground">
            {mandatoryCompleted} of {mandatoryTotal} mandatory complete
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => {
          const def = getActivityDef(item.activity)
          const Icon = def?.icon
          const href = activityHref(item)
          const isQuiz = item.activity === 'quiz' && item.quizId
          const required = item.trackable && isActivityRequired(item)
          const done = Boolean(progressById?.[item.id]?.completed)
          const marking = markingActivityId === item.id

          return (
            <div
              key={`${item.trackable ? 'lesson' : 'module'}-${item.id}`}
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
                    {!item.trackable ? (
                      <Badge variant="outline" className="text-[10px]">
                        Module
                      </Badge>
                    ) : required ? (
                      <Badge className="text-[10px]">Required</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        Optional
                      </Badge>
                    )}
                    {item.trackable && done && (
                      <Badge
                        variant="outline"
                        className="gap-1 border-green-600/40 text-[10px] text-green-700"
                      >
                        <CheckCircle className="h-3 w-3" />
                        {isQuiz ? 'Passed' : 'Done'}
                      </Badge>
                    )}
                    {item.trackable && isQuiz && !done && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Not passed
                      </Badge>
                    )}
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
              <div className="flex shrink-0 flex-col items-stretch gap-1.5 sm:flex-row sm:items-center">
                {isQuiz ? (
                  <Button
                    type="button"
                    size="sm"
                    className="min-h-11 shrink-0 gap-1 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
                    onClick={() => onTakeQuiz?.(item.quizId!)}
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    {done ? 'Retake quiz' : 'Take quiz'}
                  </Button>
                ) : (
                  <>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-md border border-border px-3 text-sm hover:bg-muted"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Open
                        <ExternalLink className="h-3 opacity-60" />
                      </a>
                    ) : null}
                    {item.trackable && onMarkDone && required && !done ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="min-h-11 shrink-0"
                        disabled={marking}
                        onClick={() => void onMarkDone(item.id)}
                      >
                        {marking ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Mark as done
                      </Button>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
