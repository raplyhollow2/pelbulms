'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown,
  ChevronUp,
  FileText,
  GripVertical,
  Loader2,
  Paperclip,
  Plus,
  Trash2,
  UploadCloud,
  Video,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LessonActivitiesPanel } from '@/components/teach/lesson-activities-panel'
import { LessonResourcesEditor } from '@/components/teach/lesson-resources-editor'
import { uploadVideoDirectToCloudinary } from '@/lib/cloudinary-direct-upload'
import { parseMediaRef, resolveMediaUrl } from '@/lib/media'
import {
  DRIVE_SHARE_HINT,
  getYoutubeId,
  isGoogleDriveUrl,
  MAX_VIDEO_UPLOAD_LABEL,
} from '@/lib/video-url'
import {
  formatLectureDuration,
  inferLectureKind,
  lectureKindLabel,
  withLectureKind,
  type LectureKind,
} from '@/lib/lesson-kind'
import { parseLessonActivities } from '@/lib/lesson-activities'
import type { Database } from '@/types/database.types'

type Lesson = Database['public']['Tables']['lessons']['Row']

type Props = {
  courseId: string
  lessons: Lesson[]
  onAdd: (kind: LectureKind) => Promise<void>
  onUpdate: (id: string, updates: Partial<Lesson>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onDragStart: (e: React.DragEvent, lessonId: string) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, lessonId: string) => void
}

export function CurriculumSequenceEditor({
  courseId,
  lessons,
  onAdd,
  onUpdate,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
}: Props) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [adding, setAdding] = useState<LectureKind | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const videoInputByLesson = useRef<Record<string, HTMLInputElement | null>>({})
  const prevCount = useRef(lessons.length)

  useEffect(() => {
    if (lessons.length > prevCount.current) {
      setExpandedId(lessons[lessons.length - 1]?.id || null)
    }
    prevCount.current = lessons.length
  }, [lessons])

  const add = async (kind: LectureKind) => {
    setAdding(kind)
    try {
      await onAdd(kind)
    } finally {
      setAdding(null)
    }
  }

  const uploadVideo = async (lesson: Lesson, file: File) => {
    setUploadingId(lesson.id)
    setUploadProgress(0)
    try {
      const { url } = await uploadVideoDirectToCloudinary(file, {
        folder: `course-media/videos/${courseId}`,
        onProgress: setUploadProgress,
      })
      await onUpdate(lesson.id, {
        video_url: url,
        metadata: withLectureKind((lesson as any).metadata, 'video') as any,
      })
    } catch (err: any) {
      if (file.size > 20 * 1024 * 1024) {
        alert(err?.message || 'Failed to upload video')
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
        await onUpdate(lesson.id, {
          video_url: data.url,
          metadata: withLectureKind((lesson as any).metadata, 'video') as any,
        })
      } catch (fallbackErr: any) {
        alert(fallbackErr?.message || err?.message || 'Failed to upload video')
      }
    } finally {
      setUploadingId(null)
      setUploadProgress(0)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Course content</p>
          <p className="text-xs text-muted-foreground">
            Udemy-style sequence: video lectures, articles, then files and activities
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={Boolean(adding)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-bhutan-yellow px-2.5 text-sm font-medium text-black hover:bg-bhutan-orange disabled:opacity-50"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add lecture
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => void add('video')}>
              <Video className="h-4 w-4" />
              Video lecture
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void add('article')}>
              <FileText className="h-4 w-4" />
              Article
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void add('resource')}>
              <Paperclip className="h-4 w-4" />
              File / resource
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {lessons.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-12 text-center">
          <Video className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">No lectures yet</p>
          <p className="mb-4 text-xs text-muted-foreground">
            Add a video, article, or file so students see them in order
          </p>
          <Button onClick={() => void add('video')} size="sm">
            <Plus className="mr-1.5 h-4 w-4" /> Add video lecture
          </Button>
        </div>
      ) : (
        <ol className="overflow-hidden rounded-lg border">
          {lessons.map((lesson, index) => {
            const kind = inferLectureKind(lesson)
            const expanded = expandedId === lesson.id
            const duration = formatLectureDuration(lesson.duration_minutes)
            const resourceCount = parseLessonActivities((lesson as any).resources).length
            const KindIcon = kind === 'article' ? FileText : kind === 'resource' ? Paperclip : Video

            return (
              <li
                key={lesson.id}
                draggable
                onDragStart={(e) => onDragStart(e, lesson.id)}
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, lesson.id)}
                className="border-b last:border-b-0"
              >
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <GripVertical className="hidden h-4 w-4 shrink-0 cursor-move text-muted-foreground sm:block" />
                  <span className="w-6 shrink-0 text-xs font-semibold text-muted-foreground">
                    {index + 1}.
                  </span>
                  <KindIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setExpandedId(expanded ? null : lesson.id)}
                  >
                    <span className="block truncate text-sm font-medium">
                      {lesson.title || `Untitled ${lectureKindLabel(kind).toLowerCase()}`}
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{lectureKindLabel(kind)}</span>
                      {duration ? <span>{duration}</span> : null}
                      {resourceCount > 0 ? <span>{resourceCount} resources</span> : null}
                      {!(lesson as any).is_published ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Draft
                        </Badge>
                      ) : null}
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setExpandedId(expanded ? null : lesson.id)}
                    aria-label={expanded ? 'Collapse lecture' : 'Expand lecture'}
                  >
                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>

                {expanded ? (
                  <div className="space-y-4 border-t bg-muted/20 px-3 py-4 sm:px-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Title</Label>
                        <Input
                          value={lesson.title}
                          onChange={(e) => void onUpdate(lesson.id, { title: e.target.value })}
                          placeholder={`${lectureKindLabel(kind)} title`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Duration (minutes)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={
                            lesson.duration_minutes ? Math.round(lesson.duration_minutes / 60) : ''
                          }
                          onChange={(e) =>
                            void onUpdate(lesson.id, {
                              duration_minutes: parseInt(e.target.value, 10) * 60 || 0,
                            })
                          }
                          placeholder="10"
                        />
                      </div>
                    </div>

                    {(kind === 'article' || kind === 'resource') && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Article / description</Label>
                        <Textarea
                          value={lesson.description || ''}
                          onChange={(e) =>
                            void onUpdate(lesson.id, { description: e.target.value })
                          }
                          placeholder="Reading text students see in this lecture"
                          rows={3}
                          className="resize-none"
                        />
                      </div>
                    )}

                    {kind !== 'article' && (
                      <div className="space-y-2 rounded-md border bg-background p-3">
                        <Label className="text-xs">Video</Label>
                        <input
                          ref={(el) => {
                            videoInputByLesson.current[lesson.id] = el
                          }}
                          type="file"
                          accept="video/mp4,video/webm,video/ogg,video/quicktime"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) void uploadVideo(lesson, file)
                            e.target.value = ''
                          }}
                        />
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            value={parseMediaRef(lesson.video_url) ? '' : lesson.video_url || ''}
                            onChange={(e) => void onUpdate(lesson.id, { video_url: e.target.value })}
                            placeholder="YouTube / Drive URL"
                            disabled={!!parseMediaRef(lesson.video_url) || uploadingId === lesson.id}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="shrink-0 gap-1.5"
                            disabled={uploadingId === lesson.id}
                            onClick={() => videoInputByLesson.current[lesson.id]?.click()}
                          >
                            {uploadingId === lesson.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <UploadCloud className="h-4 w-4" />
                            )}
                            {uploadingId === lesson.id
                              ? uploadProgress > 0
                                ? `${uploadProgress}%`
                                : 'Uploading…'
                              : `Upload (${MAX_VIDEO_UPLOAD_LABEL})`}
                          </Button>
                        </div>
                        {isGoogleDriveUrl(lesson.video_url || '') && (
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            {DRIVE_SHARE_HINT}
                          </p>
                        )}
                        {lesson.video_url && getYoutubeId(lesson.video_url) ? (
                          <div className="overflow-hidden rounded-md border">
                            <iframe
                              src={`https://www.youtube.com/embed/${getYoutubeId(lesson.video_url)}?rel=0&modestbranding=1`}
                              className="aspect-video w-full"
                              allowFullScreen
                              title={lesson.title || 'Lecture video'}
                            />
                          </div>
                        ) : parseMediaRef(lesson.video_url)?.type === 'video' ? (
                          <video
                            src={resolveMediaUrl(lesson.video_url) || undefined}
                            controls
                            className="aspect-video w-full rounded-md bg-black"
                          />
                        ) : null}
                      </div>
                    )}

                    <div className="rounded-md border bg-background p-3">
                      <p className="mb-2 text-xs font-medium">Downloadable resources</p>
                      <LessonResourcesEditor
                        courseId={courseId}
                        lessonId={lesson.id}
                        resources={parseLessonActivities((lesson as any).resources)
                          .filter((item) => item.activity === 'file' && (item.url || item.fileUrl))
                          .map((item) => ({
                            title: item.title,
                            url: item.url || item.fileUrl,
                            type: item.description,
                          }))}
                        onChange={async (next) => {
                          const existing = parseLessonActivities((lesson as any).resources)
                          const withoutFiles = existing.filter((item) => item.activity !== 'file')
                          const files = next.map((item) => ({
                            id: `file_${item.url || item.title}`,
                            activity: 'file' as const,
                            title: item.title || 'File',
                            url: item.url,
                            fileUrl: item.url,
                            fileName: item.title,
                            description: item.type,
                          }))
                          await onUpdate(lesson.id, {
                            resources: [...withoutFiles, ...files] as any,
                          })
                        }}
                        compact
                      />
                    </div>

                    <div className="rounded-md border bg-background p-3">
                      <LessonActivitiesPanel
                        courseId={courseId}
                        lessonId={lesson.id}
                        resources={(lesson as any).resources}
                        onChange={async (next) => {
                          await onUpdate(lesson.id, { resources: next as any })
                        }}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Switch
                            checked={Boolean((lesson as any).is_published)}
                            onCheckedChange={(checked) =>
                              void onUpdate(lesson.id, { is_published: checked } as any)
                            }
                          />
                          Published
                        </label>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Switch
                            checked={Boolean(lesson.is_free)}
                            onCheckedChange={(checked) =>
                              void onUpdate(lesson.id, { is_free: checked })
                            }
                          />
                          Preview
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            router.push(`/teach/courses/${courseId}/lessons/${lesson.id}`)
                          }
                        >
                          Full editor
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => void onDelete(lesson.id)}
                        >
                          <Trash2 className="mr-1.5 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
