'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { ModuleResourcesTab } from '@/components/teach/module-resources-tab'
import { readGateSettings, withGateSettings } from '@/lib/progression-gates'

type ModuleRow = {
  id: string
  title: string
  description: string | null
  is_published: boolean | null
  metadata: unknown
  resources: unknown
}

type LessonLite = { id: string; title: string; resources?: unknown }

export function ModuleOptionsPanel({
  courseId,
  moduleId,
  onTitleChange,
}: {
  courseId: string
  moduleId: string
  onTitleChange?: (title: string) => void
}) {
  const supabase = createClient()
  const [moduleRow, setModuleRow] = useState<ModuleRow | null>(null)
  const [lessons, setLessons] = useState<LessonLite[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setModuleRow(null)
    void (async () => {
      const { data, error: loadError } = await supabase.from('modules').select('*').eq('id', moduleId).single()
      const { data: lessonRows } = await supabase
        .from('lessons')
        .select('id, title, resources')
        .eq('module_id', moduleId)
        .order('order_index')
      if (cancelled) return
      if (loadError || !data) {
        setError(loadError?.message || 'Could not load this module')
        return
      }
      setModuleRow(data as unknown as ModuleRow)
      setLessons((lessonRows || []) as LessonLite[])
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId])

  const notify = async (lessonId?: string, summary?: string) => {
    try {
      await fetch(`/api/courses/${courseId}/notify-learners`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Course activities updated',
          message: summary || 'Your instructor updated activities or resources in this course.',
          lessonId: lessonId || undefined,
          type: 'activity_update',
        }),
      })
    } catch (e) {
      console.error('Failed to notify learners of activity update:', e)
    }
  }

  const save = async (updates: Partial<ModuleRow>) => {
    if (!moduleRow) return
    setModuleRow({ ...moduleRow, ...updates })
    const { error: saveError } = await (supabase as any)
      .from('modules')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', moduleId)
    if (saveError) setError(saveError.message || 'Could not save this module')
    if (typeof updates.title === 'string') onTitleChange?.(updates.title)
  }

  if (error && !moduleRow) return <p className="text-sm text-destructive">{error}</p>
  if (!moduleRow) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading module…
      </div>
    )
  }

  const gates = readGateSettings(moduleRow.metadata)

  return (
    <div className="space-y-5">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div>
        <Label htmlFor={`module-desc-${moduleId}`} className="text-sm">
          Description
        </Label>
        <Textarea
          id={`module-desc-${moduleId}`}
          value={moduleRow.description || ''}
          onChange={(e) => setModuleRow({ ...moduleRow, description: e.target.value })}
          onBlur={() => void save({ description: moduleRow.description })}
          rows={3}
          className="mt-1 resize-none"
          placeholder="Module description..."
        />
      </div>
      <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
        <Label htmlFor={`module-published-${moduleId}`} className="text-sm">
          Published
        </Label>
        <Switch
          id={`module-published-${moduleId}`}
          checked={Boolean(moduleRow.is_published)}
          onCheckedChange={(checked) => void save({ is_published: checked })}
        />
      </div>
      <div className="space-y-3 rounded-lg border p-3">
        <p className="text-sm font-medium">Module gates</p>
        <div className="flex items-center justify-between gap-3">
          <Label className="text-sm">Sequential unlock</Label>
          <Switch
            checked={Boolean(gates.sequentialUnlock)}
            onCheckedChange={(checked) =>
              void save({ metadata: withGateSettings(moduleRow.metadata, { sequentialUnlock: checked }) })
            }
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label className="text-sm">Resources and flashcards after complete</Label>
          <Switch
            checked={Boolean(gates.gateResourcesUntilComplete)}
            onCheckedChange={(checked) =>
              void save({
                metadata: withGateSettings(moduleRow.metadata, { gateResourcesUntilComplete: checked }),
              })
            }
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label className="text-sm">Block next until mandatory activities are done</Label>
          <Switch
            checked={Boolean(gates.gateNextUntilActivitiesDone)}
            onCheckedChange={(checked) =>
              void save({
                metadata: withGateSettings(moduleRow.metadata, { gateNextUntilActivitiesDone: checked }),
              })
            }
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Label className="text-sm">Lesson completion default</Label>
            <p className="text-xs text-muted-foreground">
              {(gates.completionMode || 'auto') === 'auto' ? 'Auto' : 'Manual'}
            </p>
          </div>
          <Switch
            checked={(gates.completionMode || 'auto') === 'auto'}
            onCheckedChange={(checked) =>
              void save({
                metadata: withGateSettings(moduleRow.metadata, {
                  completionMode: checked ? 'auto' : 'manual',
                }),
              })
            }
          />
        </div>
      </div>
      <ModuleResourcesTab
        courseId={courseId}
        moduleId={moduleId}
        moduleResources={moduleRow.resources}
        lessons={lessons}
        onModuleResourcesChange={async (next) => {
          setModuleRow({ ...moduleRow, resources: next })
          await (supabase as any)
            .from('modules')
            .update({ resources: next, updated_at: new Date().toISOString() })
            .eq('id', moduleId)
          void notify(undefined, `Module resources were updated in “${moduleRow.title || 'a module'}”.`)
        }}
        onLessonResourcesChange={async (lessonId, next) => {
          setLessons((rows) => rows.map((row) => (row.id === lessonId ? { ...row, resources: next } : row)))
          await (supabase as any)
            .from('lessons')
            .update({ resources: next, updated_at: new Date().toISOString() })
            .eq('id', lessonId)
          const title = lessons.find((row) => row.id === lessonId)?.title || 'a lesson'
          void notify(lessonId, `Activities were updated in “${title}”.`)
        }}
      />
    </div>
  )
}
