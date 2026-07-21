'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Download, ExternalLink } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/media'

export type LessonResourceItem = {
  title: string
  url: string
  type?: string
  size?: number
}

function parseResources(raw: unknown): LessonResourceItem[] {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === 'string') {
          try {
            return JSON.parse(item) as LessonResourceItem
          } catch {
            return { title: item, url: item }
          }
        }
        if (item && typeof item === 'object' && 'url' in item) {
          return item as LessonResourceItem
        }
        return null
      })
      .filter(Boolean) as LessonResourceItem[]
  }
  return []
}

function formatSize(bytes?: number) {
  if (!bytes || bytes <= 0) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function LessonResources({ resources }: { resources?: unknown }) {
  const items = parseResources(resources)

  if (items.length === 0) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg">Lesson resources</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No reading materials or files have been attached to this lesson yet.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-lg">Lesson resources</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item, index) => {
          const href = resolveMediaUrl(item.url) || item.url
          return (
            <div
              key={`${item.url}-${index}`}
              className="flex items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="flex items-start gap-2 min-w-0">
                <FileText className="w-4 h-4 mt-0.5 shrink-0 text-bhutan-yellow" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{item.title || 'Resource'}</p>
                  <p className="text-xs text-muted-foreground">
                    {[item.type, formatSize(item.size)].filter(Boolean).join(' · ') || 'File'}
                  </p>
                </div>
              </div>
              <Button asChild variant="outline" size="sm" className="shrink-0 gap-1">
                <a href={href} target="_blank" rel="noopener noreferrer">
                  <Download className="w-3.5 h-3.5" />
                  Open
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              </Button>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
