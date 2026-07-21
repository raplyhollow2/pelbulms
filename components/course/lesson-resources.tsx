'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download, ExternalLink } from 'lucide-react'
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

export function LessonResources({ resources }: { resources?: unknown }) {
  const items = parseLessonActivities(resources)

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
          return (
            <div
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-lg border p-3"
            >
              <div className="flex items-start gap-2 min-w-0">
                {Icon ? (
                  <Icon className="w-4 h-4 mt-0.5 shrink-0 text-bhutan-yellow" />
                ) : null}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium truncate">{item.title || 'Item'}</p>
                    <Badge variant="secondary" className="text-[10px]">
                      {def?.label || item.activity}
                    </Badge>
                  </div>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  {item.content && (
                    <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-4">
                      {item.content}
                    </p>
                  )}
                  {item.choices && item.choices.length > 0 && (
                    <ul className="mt-1 text-xs text-muted-foreground list-disc pl-4">
                      {item.choices.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  )}
                  {item.dueDate && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Due: {new Date(item.dueDate).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              {href ? (
                <Button asChild variant="outline" size="sm" className="shrink-0 gap-1">
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    <Download className="w-3.5 h-3.5" />
                    Open
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </a>
                </Button>
              ) : null}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
