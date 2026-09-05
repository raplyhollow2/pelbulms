'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Plus, Trash2, Pencil } from 'lucide-react'
import { AddLessonActivityModal } from '@/components/teach/add-lesson-activity-modal'
import { QuizCreator } from '@/components/quiz/quiz-creator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  getActivityDef,
  isActivityRequired,
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
  const [editingQuiz, setEditingQuiz] = useState<LessonActivity | null>(null)
  const items = parseLessonActivities(resources)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Activities & resources</p>
          <p className="text-xs text-muted-foreground">
            Files, links, and quizzes students see on the Resources tab
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="min-h-11 gap-1.5 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
          onClick={() => setOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Add activity
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          No activities yet. Click <strong>Add activity</strong> to attach a file or quiz.
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
                      <p className="truncate font-medium">{item.title}</p>
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {def?.label || item.activity}
                      </Badge>
                      <Badge
                        variant={isActivityRequired(item) ? 'default' : 'outline'}
                        className="text-[10px]"
                      >
                        {isActivityRequired(item) ? 'Mandatory' : 'Optional'}
                      </Badge>
                      {item.quizId && (
                        <Badge variant="outline" className="text-[10px]">
                          Connected
                        </Badge>
                      )}
                    </div>
                    {item.description && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                    {(item.fileName || item.url || item.fileUrl) && (
                      <p className="mt-1 truncate text-[11px] text-muted-foreground">
                        {item.fileName || item.url || item.fileUrl}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <Switch
                        id={`req-${item.id}`}
                        checked={isActivityRequired(item)}
                        onCheckedChange={(checked) =>
                          void onChange(
                            items.map((a) =>
                              a.id === item.id ? { ...a, required: checked } : a
                            )
                          )
                        }
                      />
                      <Label htmlFor={`req-${item.id}`} className="text-xs text-muted-foreground">
                        Mandatory for progression
                      </Label>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {item.activity === 'quiz' && item.quizId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="min-h-11 min-w-11"
                      onClick={() => setEditingQuiz(item)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-11 min-w-11 text-red-600 hover:text-red-700"
                    onClick={() => onChange(items.filter((a) => a.id !== item.id))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
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

      <Dialog open={Boolean(editingQuiz)} onOpenChange={(v) => !v && setEditingQuiz(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit quiz</DialogTitle>
          </DialogHeader>
          {editingQuiz?.quizId && (
            <QuizCreator
              lessonId={lessonId}
              quizId={editingQuiz.quizId}
              compact
              onCancel={() => setEditingQuiz(null)}
              onSave={(quiz) => {
                void onChange(
                  items.map((a) =>
                    a.id === editingQuiz.id
                      ? { ...a, title: quiz.title, quizId: quiz.id, passGrade: quiz.passing_score }
                      : a
                  )
                )
                setEditingQuiz(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
