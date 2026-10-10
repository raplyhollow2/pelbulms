'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { LessonOptionsFields, type LessonOptionsValue } from '@/components/teach/lesson-options-fields'
import { toast } from 'sonner'
import { formatMailCount, requestLessonStatusEmail } from '@/lib/email/request-lesson-status-email'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { shouldSyncCourseDuration, syncCourseDuration } from '@/lib/video-duration'

export function LessonOptionsPanel({
  courseId,
  lessonId,
  hideIdentity = false,
  pageItems,
  onTitleChange,
  onDescriptionChange,
  onVisibilityChange,
}: {
  courseId: string
  lessonId: string
  hideIdentity?: boolean
  pageItems?: ReactNode
  onTitleChange?: (title: string) => void
  onDescriptionChange?: (description: string) => void
  onVisibilityChange?: (patch: { is_published?: boolean; is_free?: boolean }) => void
}) {
  const supabase = createClient()
  const [lesson, setLesson] = useState<LessonOptionsValue | null>(null)
  const [error, setError] = useState('')
  const [mailNote, setMailNote] = useState('')
  const [askEmail, setAskEmail] = useState(false)

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
    if (typeof updates.description === 'string') onDescriptionChange?.(updates.description)
    if (
      typeof updates.is_published === 'boolean' ||
      typeof updates.is_free === 'boolean' ||
      typeof updates.is_preview === 'boolean'
    ) {
      onVisibilityChange?.({
        ...(typeof updates.is_published === 'boolean' ? { is_published: updates.is_published } : {}),
        ...(typeof updates.is_free === 'boolean' || typeof updates.is_preview === 'boolean'
          ? { is_free: updates.is_free === true || updates.is_preview === true }
          : {}),
      })
    }
    if (shouldSyncCourseDuration(updates)) void syncCourseDuration(courseId)
    const notify =
      typeof updates.notify_on_status === 'boolean' ? updates.notify_on_status : lesson?.notify_on_status === true
    if (typeof updates.is_published === 'boolean' && notify) {
      const mail = await requestLessonStatusEmail(lessonId)
      const note = formatMailCount(mail)
      setMailNote(note)
      if (note) {
        if (mail && mail.sent > 0) toast.success(note)
        else toast.message(note)
      }
    }
  }

  const publishLesson = async (email: boolean) => {
    if (email) {
      await commit({ is_published: true, notify_on_status: true })
      setLesson((current) => (current ? { ...current, notify_on_status: true, is_published: true } : current))
    } else {
      await commit({ is_published: true, notify_on_status: false })
    }
    setAskEmail(false)
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
        hideIdentity={hideIdentity}
        pageItems={pageItems}
        onChange={(updates) => setLesson((current) => (current ? { ...current, ...updates } : current))}
        onCommit={async (updates) => {
          if (updates.is_published === true && lesson?.is_published !== true && lesson?.notify_on_status !== true) {
            setAskEmail(true)
            return
          }
          await commit(updates)
        }}
      />
      {mailNote ? <p className="text-sm text-muted-foreground">{mailNote}</p> : null}
      <AlertDialog open={askEmail} onOpenChange={setAskEmail}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Email enrolled students?</AlertDialogTitle>
            <AlertDialogDescription>
              This lesson is being published. Email every student enrolled in this course.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setLesson((current) => (current ? { ...current, is_published: false } : current))}
            >
              Cancel
            </AlertDialogCancel>
            <Button type="button" variant="outline" onClick={() => void publishLesson(false)}>
              Publish without email
            </Button>
            <Button type="button" onClick={() => void publishLesson(true)}>
              Email students
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
