'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Clock, FileText, Link, Loader2, Lock, Trash2, UploadCloud } from 'lucide-react'
import { resolveMediaUrl, parseMediaRef } from '@/lib/media'
import { uploadVideoDirectToCloudinary } from '@/lib/cloudinary-direct-upload'
import { LessonActivitiesPanel } from '@/components/teach/lesson-activities-panel'
import { ScenarioEditor } from '@/components/teach/scenario-editor'
import { withGateSettings, readGateSettings } from '@/lib/progression-gates'
import {
  DRIVE_SHARE_HINT,
  getGoogleDriveEmbedUrl,
  getYoutubeId,
  isGoogleDriveUrl,
  MAX_VIDEO_UPLOAD_LABEL,
} from '@/lib/video-url'

export type LessonOptionsValue = {
  id: string
  title: string
  description?: string | null
  is_published?: boolean | null
  is_free?: boolean | null
  metadata?: unknown
  video_url?: string | null
  duration_minutes?: number | null
  video_duration?: number | null
  transcript?: string | null
  resources?: unknown
}

type Props = {
  courseId: string
  lesson: LessonOptionsValue
  onChange: (updates: Partial<LessonOptionsValue>) => void
  onCommit: (updates: Partial<LessonOptionsValue>) => void | Promise<void>
}

export function LessonOptionsFields({ courseId, lesson, onChange, onCommit }: Props) {
  const videoInputRef = useRef<HTMLInputElement>(null)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [videoUploadProgress, setVideoUploadProgress] = useState(0)
  const [videoUploadError, setVideoUploadError] = useState('')

  const commit = (updates: Partial<LessonOptionsValue>) => {
    onChange(updates)
    void onCommit(updates)
  }

  const uploadLessonVideo = async (file: File) => {
    setVideoUploadError('')
    setUploadingVideo(true)
    setVideoUploadProgress(0)
    try {
      const { url } = await uploadVideoDirectToCloudinary(file, {
        folder: `course-media/videos/${courseId}`,
        onProgress: setVideoUploadProgress,
      })
      commit({ video_url: url })
    } catch (err: any) {
      if (file.size > 20 * 1024 * 1024) {
        setVideoUploadError(err?.message || 'Failed to upload video')
        return
      }
      try {
        const body = new FormData()
        body.append('file', file)
        body.append('courseId', courseId)
        body.append('kind', 'video')
        const res = await fetch('/api/courses/media', { method: 'POST', body })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || err?.message || 'Upload failed')
        commit({ video_url: data.url })
      } catch (fallbackErr: any) {
        setVideoUploadError(fallbackErr?.message || err?.message || 'Failed to upload video')
      }
    } finally {
      setUploadingVideo(false)
      setVideoUploadProgress(0)
      if (videoInputRef.current) videoInputRef.current.value = ''
    }
  }

  const gates = readGateSettings(lesson.metadata)
  const youtubeId = lesson.video_url ? getYoutubeId(lesson.video_url) : ''
  const driveEmbed =
    lesson.video_url && !youtubeId ? getGoogleDriveEmbedUrl(lesson.video_url) : ''

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor={`lesson-title-${lesson.id}`} className="text-sm">
            Page title
          </Label>
          <Input
            id={`lesson-title-${lesson.id}`}
            value={lesson.title}
            onChange={(e) => onChange({ title: e.target.value })}
            onBlur={() => void onCommit({ title: lesson.title })}
            placeholder="Page title"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor={`lesson-description-${lesson.id}`} className="text-sm">
            Description
          </Label>
          <Textarea
            id={`lesson-description-${lesson.id}`}
            value={lesson.description || ''}
            onChange={(e) => onChange({ description: e.target.value })}
            onBlur={() => void onCommit({ description: lesson.description })}
            placeholder="Page description..."
            rows={3}
            className="mt-1 resize-none"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex items-center space-x-2">
            <Switch
              id={`lesson-published-${lesson.id}`}
              checked={Boolean(lesson.is_published)}
              onCheckedChange={(checked) => commit({ is_published: checked })}
            />
            <Label htmlFor={`lesson-published-${lesson.id}`} className="text-sm">
              Published
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id={`lesson-free-${lesson.id}`}
              checked={Boolean(lesson.is_free)}
              onCheckedChange={(checked) => commit({ is_free: checked })}
            />
            <Label htmlFor={`lesson-free-${lesson.id}`} className="text-sm">
              Free preview
            </Label>
          </div>
        </div>
        <div className="space-y-3 rounded-lg border p-4">
          <div>
            <p className="text-sm font-medium">Progression lock</p>
            <p className="text-xs text-muted-foreground">Off by default. Turn on only what you need.</p>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Label htmlFor={`gate-resources-${lesson.id}`} className="text-sm">
                Resources and flashcards after lesson complete
              </Label>
            </div>
            <Switch
              id={`gate-resources-${lesson.id}`}
              checked={Boolean(gates.gateResourcesUntilComplete)}
              onCheckedChange={(checked) =>
                commit({
                  metadata: withGateSettings(lesson.metadata, {
                    gateResourcesUntilComplete: checked,
                  }),
                })
              }
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Label htmlFor={`gate-next-${lesson.id}`} className="text-sm">
                Block next until mandatory activities are done
              </Label>
            </div>
            <Switch
              id={`gate-next-${lesson.id}`}
              checked={Boolean(gates.gateNextUntilActivitiesDone)}
              onCheckedChange={(checked) =>
                commit({
                  metadata: withGateSettings(lesson.metadata, {
                    gateNextUntilActivitiesDone: checked,
                  }),
                })
              }
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium">Lesson video</p>
          <p className="text-xs text-muted-foreground">
            Paste a YouTube or Google Drive link, or upload a private video (up to {MAX_VIDEO_UPLOAD_LABEL}).
          </p>
        </div>
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/webm,video/ogg,video/quicktime"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void uploadLessonVideo(file)
          }}
        />
        <div className="flex gap-2">
          <Input
            id={`video-url-${lesson.id}`}
            value={parseMediaRef(lesson.video_url) ? '' : lesson.video_url || ''}
            onChange={(e) => onChange({ video_url: e.target.value })}
            onBlur={() => {
              if (!parseMediaRef(lesson.video_url)) void onCommit({ video_url: lesson.video_url })
            }}
            placeholder="YouTube / Drive link, or upload"
            className="flex-1"
            disabled={!!parseMediaRef(lesson.video_url) || uploadingVideo}
          />
          <Button
            type="button"
            variant="outline"
            className="shrink-0 gap-1.5"
            disabled={uploadingVideo}
            onClick={() => videoInputRef.current?.click()}
          >
            {uploadingVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            <span className="hidden sm:inline">Upload</span>
          </Button>
        </div>
        {uploadingVideo && videoUploadProgress > 0 && (
          <p className="text-xs text-muted-foreground">Uploading… {videoUploadProgress}%</p>
        )}
        {videoUploadError && <p className="text-sm text-destructive">{videoUploadError}</p>}
        {isGoogleDriveUrl(lesson.video_url || '') && (
          <p className="text-xs text-amber-700 dark:text-amber-400">{DRIVE_SHARE_HINT}</p>
        )}
        {parseMediaRef(lesson.video_url)?.type === 'video' && (
          <div className="space-y-2 rounded-lg border p-3">
            <div className="aspect-video overflow-hidden rounded-lg bg-black">
              <video
                src={resolveMediaUrl(lesson.video_url) || undefined}
                controls
                controlsList="nodownload"
                className="h-full w-full"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" /> Private upload
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => commit({ video_url: '' })}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
        {youtubeId && (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <div className="aspect-video overflow-hidden rounded-lg bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&rel=0&modestbranding=1`}
                className="h-full w-full"
                allowFullScreen
                title={lesson.title || 'Lesson video'}
              />
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => commit({ video_url: '' })}>
              <Trash2 className="h-3 w-3" /> Remove
            </Button>
          </div>
        )}
        {driveEmbed && (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <div className="aspect-video overflow-hidden rounded-lg bg-black">
              <iframe
                src={driveEmbed}
                className="h-full w-full border-0"
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
                title={lesson.title || 'Drive video'}
              />
            </div>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Link className="h-3 w-3" /> Google Drive
            </span>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor={`duration-${lesson.id}`} className="flex items-center gap-1 text-sm">
              <Clock className="h-3 w-3" />
              Duration (minutes)
            </Label>
            <Input
              id={`duration-${lesson.id}`}
              type="number"
              value={lesson.duration_minutes ? Math.round(lesson.duration_minutes / 60) : ''}
              onChange={(e) => {
                const minutes = parseInt(e.target.value) || 0
                onChange({ duration_minutes: minutes * 60 })
              }}
              onBlur={() => {
                const minutes = lesson.duration_minutes ? Math.round(lesson.duration_minutes / 60) : 0
                void onCommit({ duration_minutes: minutes * 60 })
              }}
              placeholder="30"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor={`video-duration-${lesson.id}`} className="text-sm">
              Video duration (seconds)
            </Label>
            <Input
              id={`video-duration-${lesson.id}`}
              type="number"
              value={lesson.video_duration || ''}
              onChange={(e) => onChange({ video_duration: parseInt(e.target.value) || 0 })}
              onBlur={() => void onCommit({ video_duration: lesson.video_duration })}
              placeholder="1800"
              className="mt-1"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor={`transcript-${lesson.id}`} className="flex items-center gap-1 text-sm">
            <FileText className="h-3 w-3" />
            Transcript
          </Label>
          <Textarea
            id={`transcript-${lesson.id}`}
            value={lesson.transcript || ''}
            onChange={(e) => onChange({ transcript: e.target.value })}
            onBlur={() => void onCommit({ transcript: lesson.transcript })}
            placeholder="Lesson transcript for accessibility and search..."
            rows={4}
            className="mt-1 resize-none"
          />
        </div>
        <LessonActivitiesPanel
          courseId={courseId}
          lessonId={lesson.id}
          resources={lesson.resources}
          onChange={async (next) => {
            onChange({ resources: next })
            await onCommit({ resources: next })
          }}
        />
        <ScenarioEditor lessonId={lesson.id} />
      </div>
    </div>
  )
}
