'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2 } from 'lucide-react'
import { AddLessonActivityModal } from '@/components/teach/add-lesson-activity-modal'
import {
  getActivityDef,
  parseLessonActivities,
  type LessonActivity,
} from '@/lib/lesson-activities'

type Props = {
  courseId: string
  lessonId: string
  resources: unknown
  onChange: (next: LessonActivity[]) => void | Promise<void>
}

export function LessonActivitiesPanel({
  courseId,
  lessonId,
  resources,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false)
  const items = parseLessonActivities(resources)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Activities & resources</p>
          <p className="text-xs text-muted-foreground">
            Add Moodle-style items (assignment, file, forum, quiz, …)
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="gap-1.5 bg-bhutan-yellow hover:bg-bhutan-orange text-black"
          onClick={() => setOpen(true)}
        >
          <Plus className="w-4 h-4" />
          Add activity
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-md border border-dashed p-4 text-center">
          No activities yet. Click <strong>Add activity</strong> to choose assignment, file,
          forum, and more.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const def = getActivityDef(item.activity)
            const Icon = def?.icon
            return (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-lg border p-3"
              >
                <div className="flex min-w-0 items-start gap-3">
                  {Icon ? (
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                      <Icon className="h-4 w-4 text-bhutan-yellow" />
                    </span>
                  ) : null}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium truncate">{item.title}</p>
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {def?.label || item.activity}
                      </Badge>
                    </div>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                    {(item.fileName || item.url || item.fileUrl) && (
                      <p className="text-[11px] text-muted-foreground mt-1 truncate">
                        {item.fileName || item.url || item.fileUrl}
                      </p>
                    )}
                    {item.dueDate && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Due: {new Date(item.dueDate).toLocaleString()}
                      </p>
                    )}
                    {item.choices && item.choices.length > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Options: {item.choices.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-red-600 hover:text-red-700"
                  onClick={() => onChange(items.filter((a) => a.id !== item.id))}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      <AddLessonActivityModal
        open={open}
        onOpenChange={setOpen}
        courseId={courseId}
        lessonId={lessonId}
        onAdd={async (activity) => {
          await onChange([...items, activity])
        }}
      />
    </div>
  )
}
