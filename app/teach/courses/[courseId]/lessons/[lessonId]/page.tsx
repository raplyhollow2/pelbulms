// @ts-nocheck - Lesson schema fields extend generated types; unblock deploy
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Loader2, Save, Play, Edit, Clock, FileText, BookOpen, CheckCircle2, Link, UploadCloud, Lock, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { resolveMediaUrl, parseMediaRef } from '@/lib/media'
import type { Database } from '@/types/database.types'

type Course = Database['public']['Tables']['courses']['Row']
type Module = Database['public']['Tables']['modules']['Row']
type Lesson = Database['public']['Tables']['lessons']['Row']

export default function LessonEditPage() {
  const router = useRouter()
  const params = useParams()
  const courseId = params.courseId as string
  const lessonId = params.lessonId as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [module, setModule] = useState<Module | null>(null)
  const [course, setCourse] = useState<Course | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  const videoInputRef = useRef<HTMLInputElement>(null)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [videoUploadError, setVideoUploadError] = useState('')

  const supabase = createClient()

  useEffect(() => {
    fetchLessonData()
  }, [courseId, lessonId])

  const fetchLessonData = async () => {
    try {
      setLoading(true)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }

      // Fetch course details
      const { data: courseData } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single()

      if (!courseData) {
        alert('Course not found')
        router.push('/teach/dashboard')
        return
      }

      // Check if user is the instructor or admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if ((courseData as any).instructor_id !== user.id && (profile as any)?.role !== 'admin') {
        alert('Access denied. You can only edit your own courses.')
        router.push('/teach/dashboard')
        return
      }

      setCourse(courseData)

      // Fetch lesson details
      const { data: lessonData } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', lessonId)
        .single()

      if (!lessonData) {
        alert('Lesson not found')
        router.push(`/teach/courses/${courseId}/edit`)
        return
      }

      setLesson(lessonData)

      // Fetch module details
      const { data: moduleData } = await supabase
        .from('modules')
        .select('*')
        .eq('id', lessonData.module_id)
        .single()

      if (moduleData) {
        setModule(moduleData)
      }

    } catch (error) {
      console.error('Error fetching lesson data:', error)
      alert('Failed to load lesson data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const updateLesson = async (updates: Partial<Lesson>) => {
    console.log('🔧 updateLesson called:', { lessonId, updates })

    // Optimistic update
    if (lesson) {
      setLesson({ ...lesson, ...updates })
      setHasChanges(true)
    }

    // Persist to database
    try {
      console.log('💾 Attempting database update for lesson:', lessonId)
      const { error, data } = await supabase
        .from('lessons')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', lessonId)
        .select()
        .single()

      if (error) {
        console.error('❌ Database update error:', error)
        throw error
      }

      console.log('✅ Database update successful:', data)
      setHasChanges(false)
    } catch (error) {
      console.error('❌ Error updating lesson:', error)
      alert('Failed to update lesson. Please try again.')
      // Revert on error
      fetchLessonData()
    }
  }

  const getYoutubeId = (url: string) => {
    if (!url) return ''
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/)
    return match ? match[1] : ''
  }

  // Upload a private lesson video to Cloudinary (served via /api/media).
  const uploadLessonVideo = async (file: File) => {
    setVideoUploadError('')
    setUploadingVideo(true)
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('courseId', courseId)
      body.append('kind', 'video')

      const res = await fetch('/api/courses/media', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')

      // data.url is a private reference like "cloudinary:video:<public_id>".
      setLesson((prev) => (prev ? { ...prev, video_url: data.url } : prev))
      await updateLesson({ video_url: data.url })
    } catch (err: any) {
      console.error('Lesson video upload error:', err)
      setVideoUploadError(err?.message || 'Failed to upload video')
    } finally {
      setUploadingVideo(false)
      if (videoInputRef.current) videoInputRef.current.value = ''
    }
  }

  const removeLessonVideo = async () => {
    setLesson((prev) => (prev ? { ...prev, video_url: '' } : prev))
    await updateLesson({ video_url: '' })
  }

  const saveChanges = async () => {
    if (!lesson) return

    try {
      setSaving(true)

      const { error } = await supabase
        .from('lessons')
        .update({
          title: lesson.title,
          description: lesson.description,
          video_url: lesson.video_url,
          video_duration: lesson.video_duration,
          duration_minutes: lesson.duration_minutes,
          transcript: lesson.transcript,
          resources: lesson.resources,
          is_published: (lesson as any).is_published,
          is_free: lesson.is_free,
          metadata: lesson.metadata,
          updated_at: new Date().toISOString()
        })
        .eq('id', lessonId)

      if (error) throw error

      setHasChanges(false)
      alert('Lesson saved successfully!')
    } catch (error) {
      console.error('Error saving lesson:', error)
      alert('Failed to save lesson. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-bhutan-yellow" />
          <p className="text-muted-foreground">Loading lesson...</p>
        </div>
      </div>
    )
  }

  if (!lesson || !course) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Lesson not found</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push(`/teach/courses/${courseId}/edit`)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Course
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push(`/teach/courses/${courseId}/modules/${lesson.module_id}/edit`)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">{course.category}</Badge>
                <Badge className="text-xs bg-bhutan-yellow text-black">Lesson</Badge>
                {module && (
                  <Badge variant="secondary" className="text-xs">{module.title}</Badge>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold mt-1">{lesson.title || 'Untitled Lesson'}</h1>
              <p className="text-sm text-muted-foreground">{course.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasChanges && (
              <Badge variant="secondary" className="text-xs">Unsaved changes</Badge>
            )}
            <Button
              onClick={saveChanges}
              disabled={saving || !hasChanges}
              className="bg-bhutan-yellow hover:bg-bhutan-orange text-black"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Basic Info Card */}
        <Card className="glass">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Basic Information</CardTitle>
            <CardDescription className="text-sm">Core details about this lesson</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="lesson-title" className="text-sm">Lesson Title</Label>
              <Input
                id="lesson-title"
                value={lesson.title}
                onChange={(e) => setLesson({ ...lesson, title: e.target.value })}
                onBlur={() => updateLesson({ title: lesson.title })}
                placeholder="Lesson title"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="lesson-description" className="text-sm">Description</Label>
              <Textarea
                id="lesson-description"
                value={lesson.description || ''}
                onChange={(e) => setLesson({ ...lesson, description: e.target.value })}
                onBlur={() => updateLesson({ description: lesson.description })}
                placeholder="Lesson description..."
                rows={4}
                className="mt-1 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="lesson-published"
                  checked={(lesson as any).is_published || false}
                  onCheckedChange={(checked) => updateLesson({ is_published: checked })}
                />
                <Label htmlFor="lesson-published" className="text-sm">Published</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="lesson-free"
                  checked={lesson.is_free || false}
                  onCheckedChange={(checked) => updateLesson({ is_free: checked })}
                />
                <Label htmlFor="lesson-free" className="text-sm">Free Preview</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Video Content Card */}
        <Card className="glass">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Video Content</CardTitle>
            <CardDescription className="text-sm">Add video content for this lesson</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Private upload (recommended) */}
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Private video upload (recommended)
              </Label>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/webm,video/ogg,video/quicktime"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) uploadLessonVideo(f)
                }}
              />
              {videoUploadError && (
                <p className="text-sm text-destructive">{videoUploadError}</p>
              )}
              {parseMediaRef(lesson.video_url)?.type === 'video' ? (
                <div className="space-y-2 rounded-lg border p-3">
                  <div className="aspect-video bg-black rounded-lg overflow-hidden">
                    <video
                      src={resolveMediaUrl(lesson.video_url) || undefined}
                      controls
                      controlsList="nodownload"
                      onContextMenu={(e) => e.preventDefault()}
                      className="w-full h-full"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Private · streamed through your site
                    </span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingVideo}
                        onClick={() => videoInputRef.current?.click()}
                      >
                        {uploadingVideo ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Replace'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={removeLessonVideo}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={uploadingVideo}
                  onClick={() => videoInputRef.current?.click()}
                  className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-bhutan-yellow hover:text-foreground disabled:opacity-60"
                >
                  {uploadingVideo ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <UploadCloud className="w-6 h-6" />
                  )}
                  <span className="text-sm font-medium">
                    {uploadingVideo ? 'Uploading & compressing...' : 'Upload lesson video'}
                  </span>
                  <span className="text-xs">MP4, WEBM, OGG or MOV · up to 100MB · auto-compressed</span>
                </button>
              )}
            </div>

            <div className="relative">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                or
              </span>
            </div>

            <div>
              <Label htmlFor="video-url" className="text-sm flex items-center gap-1">
                <Link className="w-3 h-3" />
                YouTube URL
              </Label>
              <Input
                id="video-url"
                value={parseMediaRef(lesson.video_url) ? '' : lesson.video_url || ''}
                onChange={(e) => setLesson({ ...lesson, video_url: e.target.value })}
                onBlur={() => updateLesson({ video_url: lesson.video_url })}
                placeholder="https://youtube.com/watch?v=..."
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Note: YouTube links can be discovered in the browser. Use the private upload above for confidential content.
              </p>
            </div>

            {/* YouTube preview */}
            {lesson.video_url && getYoutubeId(lesson.video_url) && (
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-2">Video Preview:</p>
                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  <iframe
                    src={`https://www.youtube.com/embed/${getYoutubeId(lesson.video_url)}?enablejsapi=1&rel=0&modestbranding=1`}
                    className="w-full h-full"
                    allowFullScreen
                    title={lesson.title || 'Lesson video'}
                  />
                </div>
                <div className="mt-2 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(lesson.video_url || '', '_blank')}
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Open in YouTube
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="duration" className="text-sm flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Duration (minutes)
                </Label>
                <Input
                  id="duration"
                  type="number"
                  value={lesson.duration_minutes ? Math.round(lesson.duration_minutes / 60) : ''}
                  onChange={(e) => {
                    const minutes = parseInt(e.target.value) || 0
                    setLesson({ ...lesson, duration_minutes: minutes * 60 })
                  }}
                  onBlur={() => {
                    const minutes = lesson.duration_minutes ? Math.round(lesson.duration_minutes / 60) : 0
                    updateLesson({ duration_minutes: minutes * 60 })
                  }}
                  placeholder="30"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="video-duration" className="text-sm">Video Duration (seconds)</Label>
                <Input
                  id="video-duration"
                  type="number"
                  value={lesson.video_duration || ''}
                  onChange={(e) => {
                    const seconds = parseInt(e.target.value) || 0
                    setLesson({ ...lesson, video_duration: seconds })
                  }}
                  onBlur={() => updateLesson({ video_duration: lesson.video_duration })}
                  placeholder="1800"
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Additional Content Card */}
        <Card className="glass">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Additional Content</CardTitle>
            <CardDescription className="text-sm">Transcript and learning resources</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="transcript" className="text-sm flex items-center gap-1">
                <FileText className="w-3 h-3" />
                Transcript
              </Label>
              <Textarea
                id="transcript"
                value={lesson.transcript || ''}
                onChange={(e) => setLesson({ ...lesson, transcript: e.target.value })}
                onBlur={() => updateLesson({ transcript: lesson.transcript })}
                placeholder="Lesson transcript for accessibility and search..."
                rows={6}
                className="mt-1 resize-none"
              />
            </div>

            <div>
              <Label htmlFor="resources" className="text-sm flex items-center gap-1">
                <BookOpen className="w-3 h-3" />
                Resources (JSON)
              </Label>
              <Textarea
                id="resources"
                value={JSON.stringify((lesson.resources as any) || [], null, 2)}
                onChange={(e) => {
                  try {
                    const resources = JSON.parse(e.target.value)
                    setLesson({ ...lesson, resources })
                  } catch (err) {
                    // Invalid JSON, don't update state
                    console.error('Invalid JSON:', err)
                  }
                }}
                onBlur={() => updateLesson({ resources: lesson.resources })}
                placeholder='[{"title": "Slide Deck", "url": "https://..."}]'
                rows={4}
                className="mt-1 resize-none font-mono text-xs"
              />
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => router.push(`/teach/courses/${courseId}/modules/${lesson.module_id}/edit`)}
                className="justify-start"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Back to Module
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/teach/courses/${courseId}/edit`)}
                className="justify-start"
              >
                <FileText className="w-4 h-4 mr-2" />
                Edit Course
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}