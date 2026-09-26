'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  CheckCircle2,
  ChevronDown,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  Plus,
  Trash2,
  UploadCloud,
  Video,
  X,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { createClient } from '@/lib/supabase/client'
import { resolveMediaUrl, parseMediaRef } from '@/lib/media'
import { uploadVideoDirectToCloudinary, uploadImageDirectToCloudinary } from '@/lib/cloudinary-direct-upload'
import {
  DRIVE_SHARE_HINT,
  getGoogleDriveEmbedUrl,
  getYoutubeId,
  isGoogleDriveUrl,
  MAX_VIDEO_UPLOAD_LABEL,
} from '@/lib/video-url'
import { GeminiCoursePanel } from '@/components/teach/gemini-course-panel'
import { CourseStaffPanel } from '@/components/teach/course-staff-panel'
import { InstitutionAudienceFields } from '@/components/teach/institution-audience-fields'
import { useCapabilities } from '@/components/auth/capabilities-provider'
import { CAP } from '@/lib/capability-keys'
import {
  loadCourseInstitutions,
  syncCourseInstitutions,
  countCrossInstitutionEnrollments,
} from '@/lib/course-institution-access'

type EnrollmentMode = 'auto' | 'approval' | 'invite_code' | 'paid'

type CourseForm = {
  title: string
  slug: string
  description: string
  category: string
  level: string
  language: string
  duration_minutes: number
  learning_objectives: string[]
  is_published: boolean
  is_featured: boolean
  enrollment_mode: EnrollmentMode
  thumbnail_url: string
  preview_video_url: string
}

const EMPTY: CourseForm = {
  title: '',
  slug: '',
  description: '',
  category: '',
  level: 'beginner',
  language: 'English',
  duration_minutes: 0,
  learning_objectives: [],
  is_published: false,
  is_featured: false,
  enrollment_mode: 'approval',
  thumbnail_url: '',
  preview_video_url: '',
}

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <section className="border-b border-border/70">
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-between py-3 text-left text-sm font-semibold"
        onClick={onToggle}
        aria-expanded={open}
      >
        {title}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="space-y-4 pb-4">{children}</div>}
    </section>
  )
}

export function CourseSettingsForm({
  courseId,
  onUpdated,
}: {
  courseId: string
  onUpdated?: (patch: { title?: string; is_published?: boolean }) => void
}) {
  const router = useRouter()
  const supabase = createClient()
  const { has } = useCapabilities()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState('')
  const [courseData, setCourseData] = useState<CourseForm>(EMPTY)
  const [metadata, setMetadata] = useState<Record<string, unknown>>({})
  const [preserved, setPreserved] = useState({
    prerequisites: [] as string[],
    requirements: [] as string[],
    tags: [] as string[],
  })
  const [newObjective, setNewObjective] = useState('')
  const [discussionEnabled, setDiscussionEnabled] = useState(false)
  const [discussionSaving, setDiscussionSaving] = useState(false)
  const [audienceInstitutionIds, setAudienceInstitutionIds] = useState<string[]>([])
  const [restrictToInstitutions, setRestrictToInstitutions] = useState(false)
  const [crossOrgEnrollmentCount, setCrossOrgEnrollmentCount] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [open, setOpen] = useState({ basics: true, cover: false, access: false, people: false, more: false })
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [videoUploadProgress, setVideoUploadProgress] = useState(0)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const hydratedKey = useRef('')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savePendingRef = useRef(false)
  const courseDataRef = useRef(courseData)
  const audienceRef = useRef(audienceInstitutionIds)
  const restrictRef = useRef(restrictToInstitutions)
  const metadataRef = useRef(metadata)
  const preservedRef = useRef(preserved)

  courseDataRef.current = courseData
  audienceRef.current = audienceInstitutionIds
  restrictRef.current = restrictToInstitutions
  metadataRef.current = metadata
  preservedRef.current = preserved

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }
      const { data: course, error: courseError } = await supabase.from('courses').select('*').eq('id', courseId).single()
      if (cancelled) return
      if (courseError || !course) {
        setError('Course not found')
        setLoading(false)
        return
      }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      const role = (profile as { role?: string } | null)?.role
      const isOwner = (course as { instructor_id?: string }).instructor_id === user.id
      const isStaff = role === 'admin' || role === 'superadmin'
      if (!isOwner && !isStaff) {
        setError('You can only edit your own courses.')
        setLoading(false)
        return
      }
      const row = course as any
      const next: CourseForm = {
        title: row.title || '',
        slug: row.slug || '',
        description: row.description || '',
        category: row.category || '',
        level: row.level || 'beginner',
        language: row.language || 'English',
        duration_minutes: row.duration_minutes || 0,
        learning_objectives: row.learning_objectives || [],
        is_published: Boolean(row.is_published),
        is_featured: Boolean(row.is_featured),
        enrollment_mode: ['auto', 'approval', 'invite_code', 'paid'].includes(row.enrollment_mode)
          ? row.enrollment_mode
          : 'approval',
        thumbnail_url: row.thumbnail_url || '',
        preview_video_url: row.metadata?.preview_video_url || '',
      }
      const nextMeta = (row.metadata as Record<string, unknown>) || {}
      const nextPreserved = {
        prerequisites: row.prerequisites || [],
        requirements: row.requirements || [],
        tags: row.tags || [],
      }
      const audience = await loadCourseInstitutions(supabase as any, courseId)
      const audienceIds = audience.map((item) => item.id)
      const { data: forum } = await (supabase as any)
        .from('forums')
        .select('id, is_enabled')
        .eq('course_id', courseId)
        .is('module_id', null)
        .is('lesson_id', null)
        .maybeSingle()
      if (cancelled) return
      setCourseData(next)
      setMetadata(nextMeta)
      setPreserved(nextPreserved)
      setAudienceInstitutionIds(audienceIds)
      setRestrictToInstitutions(audienceIds.length > 0)
      setDiscussionEnabled(Boolean(forum?.is_enabled))
      if (audienceIds.length > 0) {
        const cross = await countCrossInstitutionEnrollments(supabase as any, courseId, audienceIds)
        if (!cancelled) setCrossOrgEnrollmentCount(cross)
      }
      hydratedKey.current = JSON.stringify({
        course: next,
        audienceIds,
        restrict: audienceIds.length > 0,
      })
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  const persist = async () => {
    const current = courseDataRef.current
    if (!current.title.trim()) {
      setError('Enter a course title')
      setStatus('error')
      return
    }
    if (restrictRef.current && audienceRef.current.length === 0) {
      setError('Select at least one institution, or turn off “Restrict to institutions”.')
      setStatus('error')
      return
    }
    setStatus('saving')
    setError('')
    try {
      const { data: fresh } = await supabase.from('courses').select('metadata').eq('id', courseId).single()
      const mergedMetadata = {
        ...(((fresh as { metadata?: Record<string, unknown> } | null)?.metadata as Record<string, unknown>) ||
          metadataRef.current),
        preview_video_url: current.preview_video_url || null,
      }
      const slug =
        current.slug ||
        current.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
      const { error: saveError } = await (supabase as any)
        .from('courses')
        .update({
          title: current.title,
          slug,
          description: current.description || null,
          category: current.category || 'General',
          level: current.level,
          language: current.language,
          price: 0,
          duration_minutes: current.duration_minutes || null,
          prerequisites: preservedRef.current.prerequisites.length ? preservedRef.current.prerequisites : null,
          learning_objectives: current.learning_objectives.length ? current.learning_objectives : null,
          requirements: preservedRef.current.requirements.length ? preservedRef.current.requirements : null,
          tags: preservedRef.current.tags.length ? preservedRef.current.tags : null,
          is_published: current.is_published,
          is_featured: current.is_featured,
          enrollment_mode: current.enrollment_mode,
          thumbnail_url: current.thumbnail_url || null,
          metadata: mergedMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', courseId)
      if (saveError) throw saveError
      setMetadata(mergedMetadata)
      const idsToSync = restrictRef.current ? audienceRef.current : []
      const sync = await syncCourseInstitutions(supabase as any, courseId, idsToSync)
      if (sync.error) throw new Error(sync.error)
      setStatus('saved')
      onUpdated?.({ title: current.title, is_published: current.is_published })
    } catch (err: any) {
      setStatus('error')
      setError(err?.message || 'Could not save settings')
    }
  }

  useEffect(() => {
    if (loading) return
    const key = JSON.stringify({
      course: courseData,
      audienceIds: audienceInstitutionIds,
      restrict: restrictToInstitutions,
    })
    if (key === hydratedKey.current) return
    hydratedKey.current = key
    savePendingRef.current = true
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      savePendingRef.current = false
      void persist()
    }, 700)
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseData, audienceInstitutionIds, restrictToInstitutions, loading])

  useEffect(() => {
    const flushPendingSave = () => {
      if (!savePendingRef.current) return
      savePendingRef.current = false
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      void persist()
    }
    window.addEventListener('pagehide', flushPendingSave)
    return () => {
      window.removeEventListener('pagehide', flushPendingSave)
      flushPendingSave()
    }
    // persist reads the latest form through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleDiscussion = async (enabled: boolean) => {
    setDiscussionSaving(true)
    const prev = discussionEnabled
    setDiscussionEnabled(enabled)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const { data: existing } = await (supabase as any)
        .from('forums')
        .select('id')
        .eq('course_id', courseId)
        .is('module_id', null)
        .is('lesson_id', null)
        .maybeSingle()
      if (existing) {
        const { error: updateError } = await (supabase as any)
          .from('forums')
          .update({ is_enabled: enabled })
          .eq('id', existing.id)
        if (updateError) throw updateError
      } else if (enabled) {
        const { error: insertError } = await (supabase as any).from('forums').insert({
          course_id: courseId,
          title: `${courseData.title || 'Course'} Discussion`,
          description: 'Course discussion for enrolled students',
          is_enabled: true,
          created_by: user?.id,
        })
        if (insertError) throw insertError
      }
    } catch (err: any) {
      setDiscussionEnabled(prev)
      setError(err?.message || 'Failed to update discussion')
    } finally {
      setDiscussionSaving(false)
    }
  }

  const uploadMedia = async (file: File, kind: 'image' | 'video') => {
    setError('')
    const setUploading = kind === 'image' ? setUploadingImage : setUploadingVideo
    setUploading(true)
    try {
      let url = ''
      if (kind === 'video') {
        setVideoUploadProgress(0)
        try {
          const uploaded = await uploadVideoDirectToCloudinary(file, {
            folder: `course-media/videos/${courseId}`,
            onProgress: setVideoUploadProgress,
          })
          url = uploaded.url
        } catch (directErr: any) {
          if (file.size > 20 * 1024 * 1024) throw directErr
          const body = new FormData()
          body.append('file', file)
          body.append('courseId', courseId)
          body.append('kind', kind)
          const res = await fetch('/api/courses/media', { method: 'POST', body })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || directErr?.message || 'Upload failed')
          url = data.url
        }
        setCourseData((prev) => ({ ...prev, preview_video_url: url }))
      } else {
        try {
          const uploaded = await uploadImageDirectToCloudinary(file, {
            folder: `course-media/images/${courseId}`,
          })
          url = uploaded.url
        } catch (directErr: any) {
          if (file.size > 8 * 1024 * 1024) throw directErr
          const body = new FormData()
          body.append('file', file)
          body.append('courseId', courseId)
          body.append('kind', kind)
          const res = await fetch('/api/courses/media', { method: 'POST', body })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || directErr?.message || 'Upload failed')
          url = data.url
        }
        setCourseData((prev) => ({ ...prev, thumbnail_url: url }))
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to upload media')
    } finally {
      setUploading(false)
      setVideoUploadProgress(0)
      if (kind === 'image' && imageInputRef.current) imageInputRef.current.value = ''
      if (kind === 'video' && videoInputRef.current) videoInputRef.current.value = ''
    }
  }

  const getEmbedUrl = (url: string): { type: 'iframe' | 'file'; src: string } | null => {
    if (!url) return null
    if (parseMediaRef(url)?.type === 'video') {
      const resolved = resolveMediaUrl(url)
      return resolved ? { type: 'file', src: resolved } : null
    }
    const yt = getYoutubeId(url)
    if (yt) return { type: 'iframe', src: `https://www.youtube.com/embed/${yt}` }
    const drive = getGoogleDriveEmbedUrl(url)
    if (drive) return { type: 'iframe', src: drive }
    const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
    if (vimeo) return { type: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}` }
    if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url)) return { type: 'file', src: url }
    return { type: 'iframe', src: url }
  }

  const deleteCourse = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/teach/courses/${courseId}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to delete course')
      router.push('/teach/dashboard')
    } catch (err: any) {
      setError(err?.message || 'Failed to delete course')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
      </div>
    )
  }

  if (error && !courseData.title && status !== 'error') {
    return <p className="py-6 text-sm text-destructive">{error}</p>
  }

  const embed = getEmbedUrl(courseData.preview_video_url)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Changes save automatically'}
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Section title="Basics" open={open.basics} onToggle={() => setOpen((s) => ({ ...s, basics: !s.basics }))}>
        <div className="space-y-1.5">
          <Label htmlFor="settings-title">Title</Label>
          <Input
            id="settings-title"
            value={courseData.title}
            onChange={(e) => setCourseData({ ...courseData, title: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="settings-category">Category</Label>
          <Input
            id="settings-category"
            value={courseData.category}
            onChange={(e) => setCourseData({ ...courseData, category: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="settings-description">Description</Label>
          <Textarea
            id="settings-description"
            value={courseData.description}
            rows={4}
            className="resize-none"
            onChange={(e) => setCourseData({ ...courseData, description: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="settings-level">Level</Label>
            <select
              id="settings-level"
              value={courseData.level}
              onChange={(e) => setCourseData({ ...courseData, level: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="settings-language">Language</Label>
            <Input
              id="settings-language"
              value={courseData.language}
              onChange={(e) => setCourseData({ ...courseData, language: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="settings-duration">Duration (min)</Label>
            <Input
              id="settings-duration"
              type="number"
              value={courseData.duration_minutes}
              onChange={(e) =>
                setCourseData({ ...courseData, duration_minutes: parseInt(e.target.value) || 0 })
              }
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Learning objectives</Label>
          <div className="flex gap-2">
            <Input
              value={newObjective}
              placeholder="Add a learning objective"
              onChange={(e) => setNewObjective(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (!newObjective.trim()) return
                  setCourseData({
                    ...courseData,
                    learning_objectives: [...courseData.learning_objectives, newObjective.trim()],
                  })
                  setNewObjective('')
                }
              }}
            />
            <Button
              type="button"
              className="shrink-0"
              onClick={() => {
                if (!newObjective.trim()) return
                setCourseData({
                  ...courseData,
                  learning_objectives: [...courseData.learning_objectives, newObjective.trim()],
                })
                setNewObjective('')
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {courseData.learning_objectives.map((objective, index) => (
            <div key={`${objective}-${index}`} className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 p-3">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                <span className="truncate">{objective}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() =>
                  setCourseData({
                    ...courseData,
                    learning_objectives: courseData.learning_objectives.filter((_, i) => i !== index),
                  })
                }
              >
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Cover" open={open.cover} onToggle={() => setOpen((s) => ({ ...s, cover: !s.cover }))}>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void uploadMedia(file, 'image')
          }}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/webm,video/ogg,video/quicktime"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void uploadMedia(file, 'video')
          }}
        />
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" /> Featured image
          </Label>
          {courseData.thumbnail_url ? (
            <div className="relative overflow-hidden rounded-lg border">
              <img
                src={resolveMediaUrl(courseData.thumbnail_url) || courseData.thumbnail_url}
                alt="Course cover"
                className="aspect-video w-full object-cover"
              />
              <div className="absolute right-2 top-2 flex gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => imageInputRef.current?.click()}>
                  Replace
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="h-8 w-8"
                  onClick={() => setCourseData({ ...courseData, thumbnail_url: '' })}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" variant="outline" disabled={uploadingImage} onClick={() => imageInputRef.current?.click()}>
              {uploadingImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
              Upload cover image
            </Button>
          )}
          <div className="flex items-center gap-2">
            <LinkIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              value={courseData.thumbnail_url}
              placeholder="Or paste an image URL"
              onChange={(e) => setCourseData({ ...courseData, thumbnail_url: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Video className="h-4 w-4" /> Preview video
          </Label>
          {courseData.preview_video_url && embed ? (
            <div className="space-y-2">
              <div className="relative aspect-video overflow-hidden rounded-lg border bg-black">
                {embed.type === 'file' ? (
                  <video src={embed.src} controls className="h-full w-full" />
                ) : (
                  <iframe src={embed.src} className="h-full w-full" allowFullScreen />
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => setCourseData({ ...courseData, preview_video_url: '' })}
              >
                <X className="mr-1 h-4 w-4" /> Remove video
              </Button>
            </div>
          ) : (
            <Button type="button" variant="outline" disabled={uploadingVideo} onClick={() => videoInputRef.current?.click()}>
              {uploadingVideo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
              {uploadingVideo && videoUploadProgress > 0
                ? `Uploading… ${videoUploadProgress}%`
                : `Upload video (up to ${MAX_VIDEO_UPLOAD_LABEL})`}
            </Button>
          )}
          <Input
            value={parseMediaRef(courseData.preview_video_url) ? '' : courseData.preview_video_url}
            placeholder="Or paste YouTube / Google Drive / Vimeo URL"
            disabled={!!parseMediaRef(courseData.preview_video_url)}
            onChange={(e) => setCourseData({ ...courseData, preview_video_url: e.target.value })}
          />
          {isGoogleDriveUrl(courseData.preview_video_url) && (
            <p className="text-xs text-amber-700 dark:text-amber-400">{DRIVE_SHARE_HINT}</p>
          )}
        </div>
      </Section>

      <Section title="Access" open={open.access} onToggle={() => setOpen((s) => ({ ...s, access: !s.access }))}>
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div>
            <Label htmlFor="settings-published">Published</Label>
            <p className="text-xs text-muted-foreground">Visible and enrollable</p>
          </div>
          <Switch
            id="settings-published"
            checked={courseData.is_published}
            onCheckedChange={(checked) => setCourseData({ ...courseData, is_published: checked })}
          />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div>
            <Label htmlFor="settings-featured">Featured</Label>
            <p className="text-xs text-muted-foreground">Highlight on the homepage and catalog</p>
          </div>
          <Switch
            id="settings-featured"
            checked={courseData.is_featured}
            onCheckedChange={(checked) => setCourseData({ ...courseData, is_featured: checked })}
          />
        </div>
        <InstitutionAudienceFields
          selectedIds={audienceInstitutionIds}
          onChange={async (ids) => {
            setAudienceInstitutionIds(ids)
            if (ids.length > 0) {
              const cross = await countCrossInstitutionEnrollments(supabase as any, courseId, ids)
              setCrossOrgEnrollmentCount(cross)
            } else {
              setCrossOrgEnrollmentCount(0)
            }
          }}
          restrictEnabled={restrictToInstitutions}
          onRestrictEnabledChange={setRestrictToInstitutions}
          crossOrgEnrollmentCount={crossOrgEnrollmentCount}
        />
        <div className="space-y-2">
          <Label>Enrollment</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ['approval', 'Creator approval', 'You approve each request before access'],
                ['auto', 'Auto enroll', 'Students join without approval'],
                ['invite_code', 'Unique student code', 'Send a code by email or SMS'],
                ['paid', 'Paid (Stripe)', 'Checkout when Stripe is configured'],
              ] as const
            ).map(([mode, label, hint]) => (
              <button
                key={mode}
                type="button"
                className={`rounded-lg border p-3 text-left ${
                  courseData.enrollment_mode === mode ? 'border-bhutan-yellow bg-bhutan-yellow/10' : ''
                }`}
                onClick={() => setCourseData({ ...courseData, enrollment_mode: mode })}
              >
                <p className="text-sm font-medium">{label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
              </button>
            ))}
          </div>
        </div>
        {has(CAP.MODULE_FORUMS_CONFIGURE) && (
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <Label htmlFor="settings-discussion">Course discussion</Label>
              <p className="text-xs text-muted-foreground">Forum for enrolled students</p>
            </div>
            <Switch
              id="settings-discussion"
              checked={discussionEnabled}
              disabled={discussionSaving}
              onCheckedChange={(checked) => void toggleDiscussion(checked)}
            />
          </div>
        )}
      </Section>

      <Section title="People" open={open.people} onToggle={() => setOpen((s) => ({ ...s, people: !s.people }))}>
        <CourseStaffPanel courseId={courseId} />
      </Section>

      <Section title="More" open={open.more} onToggle={() => setOpen((s) => ({ ...s, more: !s.more }))}>
        <div className="flex flex-wrap gap-2">
          {has(CAP.MODULE_FLASHCARDS_CONFIGURE) && (
            <Button type="button" variant="outline" render={<Link href={`/teach/courses/${courseId}/flashcards`} />}>
              Manage flashcards
            </Button>
          )}
          {has(CAP.MODULE_CERTIFICATES_CONFIGURE) && (
            <Button type="button" variant="outline" render={<Link href={`/teach/courses/${courseId}/certificate`} />}>
              Certificate design
            </Button>
          )}
        </div>
        <GeminiCoursePanel courseId={courseId} />
        <div className="rounded-lg border border-destructive/30 p-4">
          <p className="text-sm font-medium text-destructive">Delete course</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Removes lessons, enrollments, and student progress.
          </p>
          <Button type="button" variant="destructive" className="mt-3" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete course
          </Button>
        </div>
      </Section>

      <AlertDialog open={deleteOpen} onOpenChange={(next) => !deleting && setDeleteOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this course?</AlertDialogTitle>
            <AlertDialogDescription>
              {courseData.title ? `"${courseData.title}"` : 'This course'} and its lessons, enrollments, and student
              progress will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault()
                void deleteCourse()
              }}
            >
              {deleting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Delete course
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export function CourseSettingsSheet({
  courseId,
  open,
  onOpenChange,
  onUpdated,
}: {
  courseId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated?: (patch: { title?: string; is_published?: boolean }) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto data-[side=right]:sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Course settings</SheetTitle>
          <SheetDescription>Details, cover, access, and people. Structure stays in the outline.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {open && <CourseSettingsForm courseId={courseId} onUpdated={onUpdated} />}
        </div>
      </SheetContent>
    </Sheet>
  )
}
