'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Paperclip, Trash2, UploadCloud, Loader2, FileText } from 'lucide-react'
import {
  getActivityDef,
  newActivityId,
  parseLessonActivities,
  type LessonActivity,
} from '@/lib/lesson-activities'

type LessonLite = {
  id: string
  title: string
  resources?: unknown
}

type Props = {
  courseId: string
  moduleId: string
  moduleResources: unknown
  lessons: LessonLite[]
  onModuleResourcesChange: (next: LessonActivity[]) => void | Promise<void>
  onLessonResourcesChange: (lessonId: string, next: LessonActivity[]) => void | Promise<void>
}

export function ModuleResourcesTab({
  courseId,
  moduleId,
  moduleResources,
  lessons,
  onModuleResourcesChange,
  onLessonResourcesChange,
}: Props) {
  const [uploading, setUploading] = useState(false)
  const [target, setTarget] = useState<string>('module')
  const moduleItems = parseLessonActivities(moduleResources)

  const lessonGroups = useMemo(
    () =>
      lessons.map((lesson) => ({
        lesson,
        items: parseLessonActivities((lesson as any).resources),
      })),
    [lessons]
  )

  const total =
    moduleItems.length + lessonGroups.reduce((n, g) => n + g.items.length, 0)

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const lessonId = target === 'module' ? `module-${moduleId}` : target
      const body = new FormData()
      body.append('file', file)
      body.append('courseId', courseId)
      body.append('lessonId', lessonId)
      body.append('title', file.name)
      const res = await fetch('/api/courses/resources', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      const activity: LessonActivity = {
        id: newActivityId(),
        activity: 'file',
        title: data.resource?.title || file.name,
        fileUrl: data.resource?.url,
        url: data.resource?.url,
        fileName: file.name,
        createdAt: new Date().toISOString(),
      }
      if (target === 'module') {
        await onModuleResourcesChange([...moduleItems, activity])
      } else {
        const current = parseLessonActivities(
          lessons.find((l) => l.id === target)?.resources
        )
        await onLessonResourcesChange(target, [...current, activity])
      }
    } catch (e: any) {
      alert(e?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Paperclip className="h-5 w-5" />
            Module resources
          </CardTitle>
          <CardDescription>
            Files here show on the student Resources tab. Attach to the whole module or a
            specific lesson. {total} item{total === 1 ? '' : 's'} in this module.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label>Attach to</Label>
              <select
                className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="module">This module (all lessons)</option>
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title || 'Untitled lesson'}
                  </option>
                ))}
              </select>
            </div>
            <label className="inline-flex">
              <input
                type="file"
                className="hidden"
                accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp,.xls,.xlsx,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void upload(file)
                  e.target.value = ''
                }}
              />
              <Button
                type="button"
                className="min-h-11 gap-1.5 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
                disabled={uploading}
                onClick={(e) => {
                  const input = (e.currentTarget.parentElement as HTMLLabelElement)?.querySelector(
                    'input'
                  )
                  input?.click()
                }}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UploadCloud className="h-4 w-4" />
                )}
                {uploading ? 'Uploading…' : 'Upload file'}
              </Button>
            </label>
          </div>
        </CardContent>
      </Card>

      <ResourceGroup
        title="Shared with every lesson"
        items={moduleItems}
        empty="No module-level files yet."
        onRemove={(id) =>
          onModuleResourcesChange(moduleItems.filter((a) => a.id !== id))
        }
      />

      {lessonGroups.map(({ lesson, items }) => (
        <ResourceGroup
          key={lesson.id}
          title={lesson.title || 'Untitled lesson'}
          items={items}
          empty="No files on this lesson."
          onRemove={(id) =>
            onLessonResourcesChange(
              lesson.id,
              items.filter((a) => a.id !== id)
            )
          }
        />
      ))}
    </div>
  )
}

function ResourceGroup({
  title,
  items,
  empty,
  onRemove,
}: {
  title: string
  items: LessonActivity[]
  empty: string
  onRemove: (id: string) => void
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          {title}
          <Badge variant="secondary" className="text-[10px]">
            {items.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => {
              const def = getActivityDef(item.activity)
              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {def?.label || item.activity}
                      {item.fileName ? ` · ${item.fileName}` : ''}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-11 min-w-11 text-red-600"
                    onClick={() => onRemove(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
