'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { LessonOptionsFields, type LessonOptionsValue } from '@/components/teach/lesson-options-fields'

export function LessonOptionsPanel({
  courseId,
  lessonId,
  onTitleChange,
}: {
  courseId: string
  lessonId: string
  onTitleChange?: (title: string) => void
}) {
  const supabase = createClient()
  const [lesson, setLesson] = useState<LessonOptionsValue | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLesson(null)
    setError('')
    void (async () => {
      const { data, error: loadError } = await supabase.from('lessons').select('*').eq('id', lessonId).single()
      if (cancelled) return
      if (loadError || !data) {
        setError(loadError?.message || 'Could not load this page')
        return
      }
      setLesson(data as LessonOptionsValue)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId])

  const commit = async (updates: Partial<LessonOptionsValue>) => {
    const { error: saveError } = await (supabase as any)
      .from('lessons')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', lessonId)
    if (saveError) {
      setError(saveError.message || 'Could not save this page')
      return
    }
    if (typeof updates.title === 'string') onTitleChange?.(updates.title)
  }

  if (error && !lesson) return <p className="text-sm text-destructive">{error}</p>
  if (!lesson) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading page…
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <LessonOptionsFields
        courseId={courseId}
        lesson={lesson}
        onChange={(updates) => setLesson((current) => (current ? { ...current, ...updates } : current))}
        onCommit={commit}
      />
    </div>
  )
}
