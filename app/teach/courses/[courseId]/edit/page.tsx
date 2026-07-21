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
import {
  ArrowLeft, Plus, Trash2, Loader2, Save, BookOpen,
  Image as ImageIcon, Video, UploadCloud, X, Link as LinkIcon,
  Info, Settings as SettingsIcon, ListChecks, CheckCircle2, GripVertical,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'
import { resolveMediaUrl } from '@/lib/media'

type Course = Database['public']['Tables']['courses']['Row']
type Module = Database['public']['Tables']['modules']['Row']

export default function EditCoursePage() {
  const router = useRouter()
  const params = useParams()
  const courseId = params.courseId as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('details')

  const [course, setCourse] = useState<Course | null>(null)
  const [modules, setModules] = useState<Array<Module & { lessons_count?: number }>>([])

  const [courseData, setCourseData] = useState({
    title: '',
    slug: '',
    description: '',
    category: '',
    level: 'beginner',
    language: 'English',
    price: 0,
    duration_minutes: 0,
    prerequisites: [] as string[],
    learning_objectives: [] as string[],
    requirements: [] as string[],
    tags: [] as string[],
    is_published: false,
    is_featured: false,
    thumbnail_url: '',
    preview_video_url: '',
  })

  // Featured media
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [mediaError, setMediaError] = useState('')
  const [newObjective, setNewObjective] = useState('')

  const supabase = createClient()

  useEffect(() => {
    fetchCourseData()
  }, [courseId])

  const fetchCourseData = async () => {
    try {
      setLoading(true)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }

      // Fetch course details
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single()

      if (courseError) throw courseError
      if (!courseData) {
        alert('Course not found')
        router.push('/teach/dashboard')
        return
      }

      // Check if user is the instructor
      if ((courseData as any).instructor_id !== user.id) {
        alert('Access denied. You can only edit your own courses.')
        router.push('/teach/dashboard')
        return
      }

      setCourse(courseData)
      const course = courseData as any
      setCourseData({
        title: course.title,
        slug: course.slug,
        description: course.description || '',
        category: course.category,
        level: course.level,
        language: course.language,
        price: course.price,
        duration_minutes: course.duration_minutes || 0,
        prerequisites: course.prerequisites || [],
        learning_objectives: course.learning_objectives || [],
        requirements: course.requirements || [],
        tags: course.tags || [],
        is_published: (course as any).is_published,
        is_featured: course.is_featured,
        thumbnail_url: course.thumbnail_url || '',
        preview_video_url: (course.metadata as any)?.preview_video_url || '',
      } as any)

      // Fetch modules
      const { data: modulesData } = await supabase
        .from('modules')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index', { ascending: true })

      if (modulesData) {
        // Count lessons for each module
        const modulesWithCounts = await Promise.all(
          (modulesData as any).map(async (module: any) => {
            const { count } = await supabase
              .from('lessons')
              .select('*', { count: 'exact', head: true })
              .eq('module_id', module.id)

            return { ...module, lessons_count: count || 0 }
          })
        )
        setModules(modulesWithCounts)
      }

    } catch (error) {
      console.error('Error fetching course data:', error)
      alert('Failed to load course data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!courseData.title.trim()) {
      alert('Please enter a course title')
      return
    }

    try {
      setSaving(true)

      // Generate slug from title if not provided
      const slug = courseData.slug || courseData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')

      // Merge preview video URL into the existing metadata JSON
      const mergedMetadata = {
        ...((course?.metadata as Record<string, unknown>) || {}),
        preview_video_url: courseData.preview_video_url || null,
      }

      // Update course
      const supabaseUpdate = supabase as any
      const { error } = await supabaseUpdate
        .from('courses')
        .update({
          title: courseData.title,
          slug,
          description: courseData.description || null,
          category: courseData.category,
          level: courseData.level,
          language: courseData.language,
          price: courseData.price,
          duration_minutes: courseData.duration_minutes || null,
          prerequisites: courseData.prerequisites.length > 0 ? courseData.prerequisites : null,
          learning_objectives: courseData.learning_objectives.length > 0 ? courseData.learning_objectives : null,
          requirements: courseData.requirements.length > 0 ? courseData.requirements : null,
          tags: courseData.tags.length > 0 ? courseData.tags : null,
          is_published: (courseData as any).is_published,
          is_featured: courseData.is_featured,
          thumbnail_url: courseData.thumbnail_url || null,
          metadata: mergedMetadata,
          updated_at: new Date().toISOString()
        })
        .eq('id', courseId)

      if (error) throw error

      alert('Course updated successfully!')
      router.push('/teach/dashboard')

    } catch (error) {
      console.error('Error updating course:', error)
      alert('Failed to update course. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const addModule = async () => {
    try {
      const supabaseInsert = supabase as any
      const { data, error } = await supabaseInsert
        .from('modules')
        .insert({
          course_id: courseId,
          title: '',
          description: '',
          order_index: modules.length,
          is_published: true,
        })
        .select('*')
        .single()

      if (error) throw error

      setModules([...modules, { ...(data as any), lessons_count: 0 }])
    } catch (error) {
      console.error('Error adding module:', error)
      alert('Failed to add module. Please try again.')
    }
  }

  const updateModule = async (id: string, updates: Partial<typeof modules[0]>) => {
    // Optimistic update
    setModules(modules.map((mod: any) => mod.id === id ? { ...mod, ...updates } : mod))

    // Persist to database
    try {
      const supabaseUpdate = supabase as any
      const { error } = await supabaseUpdate
        .from('modules')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      console.error('Error updating module:', error)
      alert('Failed to update module. Please try again.')
      // Revert on error
      fetchCourseData()
    }
  }

  const deleteModule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this module? All lessons within will also be deleted.')) {
      return
    }

    try {
      // Delete lessons first
      const { error: lessonsError } = await supabase
        .from('lessons')
        .delete()
        .eq('module_id', id)

      if (lessonsError) throw lessonsError

      // Delete module
      const { error: moduleError } = await supabase
        .from('modules')
        .delete()
        .eq('id', id)

      if (moduleError) throw moduleError

      // Update local state
      setModules(modules.filter((mod: any) => mod.id !== id))
    } catch (error) {
      console.error('Error deleting module:', error)
      alert('Failed to delete module. Please try again.')
    }
  }

  const addArrayItem = (field: 'prerequisites' | 'learning_objectives' | 'requirements' | 'tags', value: string) => {
    if (value.trim()) {
      setCourseData(prev => ({
        ...prev,
        [field]: [...prev[field], value.trim()]
      }))
    }
  }

  const removeArrayItem = (field: 'prerequisites' | 'learning_objectives' | 'requirements' | 'tags', index: number) => {
    setCourseData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }))
  }

  const uploadMedia = async (file: File, kind: 'image' | 'video') => {
    setMediaError('')
    const setUploading = kind === 'image' ? setUploadingImage : setUploadingVideo
    setUploading(true)
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('courseId', courseId)
      body.append('kind', kind)

      const res = await fetch('/api/courses/media', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')

      setCourseData((prev) => ({
        ...prev,
        ...(kind === 'image'
          ? { thumbnail_url: data.url }
          : { preview_video_url: data.url }),
      }))
    } catch (err: any) {
      console.error('Media upload error:', err)
      setMediaError(err?.message || 'Failed to upload media')
    } finally {
      setUploading(false)
      if (kind === 'image' && imageInputRef.current) imageInputRef.current.value = ''
      if (kind === 'video' && videoInputRef.current) videoInputRef.current.value = ''
    }
  }

  // Convert common video URLs (YouTube/Vimeo) into embeddable form; return null
  // for direct video files so we can render them with a <video> element.
  const getEmbedUrl = (url: string): { type: 'iframe' | 'file'; src: string } | null => {
    if (!url) return null
    const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/)
    if (yt) return { type: 'iframe', src: `https://www.youtube.com/embed/${yt[1]}` }
    const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
    if (vimeo) return { type: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}` }
    if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url)) return { type: 'file', src: url }
    return { type: 'iframe', src: url }
  }

  const addObjective = () => {
    if (newObjective.trim()) {
      addArrayItem('learning_objectives', newObjective)
      setNewObjective('')
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-bhutan-yellow" />
          <span className="ml-3 text-muted-foreground">Loading course...</span>
        </div>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Course not found</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push('/teach/dashboard')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:px-6 sm:py-8 max-w-4xl pb-28 lg:pb-8">
      <div className="space-y-4">
        {/* Sticky header with always-visible Save */}
        <div className="sticky top-0 z-30 -mx-4 border-b border-border/40 bg-background/85 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => router.push('/teach/dashboard')}
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-bold sm:text-xl">
                {courseData.title || 'Edit Course'}
              </h1>
              <div className="mt-0.5 flex items-center gap-1.5">
                <Badge
                  variant={(courseData as any).is_published ? 'default' : 'secondary'}
                  className={(courseData as any).is_published ? 'bg-green-600 text-white' : ''}
                >
                  {(courseData as any).is_published ? 'Published' : 'Draft'}
                </Badge>
                {courseData.is_featured && (
                  <Badge className="bg-bhutan-yellow text-black">Featured</Badge>
                )}
              </div>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="shrink-0 bg-bhutan-yellow hover:bg-bhutan-orange text-black"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin sm:mr-2" />
              ) : (
                <Save className="w-4 h-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline">{saving ? 'Saving...' : 'Save'}</span>
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start gap-1 overflow-x-auto scrollbar-hide [&>*]:flex-none [&>*]:px-3.5">
            <TabsTrigger value="details" className="gap-1.5">
              <Info className="w-4 h-4" /> Details
            </TabsTrigger>
            <TabsTrigger value="media" className="gap-1.5">
              <ImageIcon className="w-4 h-4" /> Media
            </TabsTrigger>
            <TabsTrigger value="curriculum" className="gap-1.5">
              <BookOpen className="w-4 h-4" /> Curriculum
              {modules.length > 0 && (
                <span className="ml-1 rounded-full bg-muted-foreground/15 px-1.5 text-[10px] font-semibold">
                  {modules.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5">
              <SettingsIcon className="w-4 h-4" /> Settings
            </TabsTrigger>
          </TabsList>

          {/* DETAILS TAB */}
          <TabsContent value="details" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="w-5 h-5" /> Course Details
                </CardTitle>
                <CardDescription>Basic information about your course</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={courseData.title}
                      onChange={(e) => setCourseData({ ...courseData, title: e.target.value } as any)}
                      placeholder="Introduction to Python Programming"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="category">Category *</Label>
                    <Input
                      id="category"
                      value={courseData.category}
                      onChange={(e) => setCourseData({ ...courseData, category: e.target.value } as any)}
                      placeholder="Programming"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={courseData.description}
                    onChange={(e) => setCourseData({ ...courseData, description: e.target.value } as any)}
                    placeholder="Learn Python from scratch..."
                    rows={4}
                    className="resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="level">Level</Label>
                    <select
                      id="level"
                      value={courseData.level}
                      onChange={(e) => setCourseData({ ...courseData, level: e.target.value } as any)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="language">Language</Label>
                    <Input
                      id="language"
                      value={courseData.language}
                      onChange={(e) => setCourseData({ ...courseData, language: e.target.value } as any)}
                      placeholder="English"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="duration">Duration (min)</Label>
                    <Input
                      id="duration"
                      type="number"
                      value={courseData.duration_minutes}
                      onChange={(e) => setCourseData({ ...courseData, duration_minutes: parseInt(e.target.value) || 0 } as any)}
                      placeholder="300"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListChecks className="w-5 h-5" /> Learning Objectives
                </CardTitle>
                <CardDescription>What students will learn from this course</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={newObjective}
                    onChange={(e) => setNewObjective(e.target.value)}
                    placeholder="Add learning objective..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addObjective()
                      }
                    }}
                  />
                  <Button type="button" onClick={addObjective} className="shrink-0">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {courseData.learning_objectives.length > 0 ? (
                  <div className="space-y-2">
                    {courseData.learning_objectives.map((objective, index) => (
                      <div key={index} className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 p-3">
                        <span className="flex min-w-0 items-center gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600" />
                          <span className="truncate">{objective}</span>
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => removeArrayItem('learning_objectives', index)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No objectives added yet.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* MEDIA TAB */}
          <TabsContent value="media" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5" />
                  Featured Media
                </CardTitle>
                <CardDescription>
                  Add a cover image and an intro/preview video for your course
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {mediaError && <p className="text-sm text-destructive">{mediaError}</p>}

                {/* Featured Image */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" /> Featured Image
                  </Label>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) uploadMedia(f, 'image')
                    }}
                  />
                  {courseData.thumbnail_url ? (
                    <div className="relative overflow-hidden rounded-lg border">
                      <img
                        src={resolveMediaUrl(courseData.thumbnail_url) || courseData.thumbnail_url}
                        alt="Course cover"
                        className="aspect-video w-full object-cover"
                      />
                      <div className="absolute right-2 top-2 flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={uploadingImage}
                          onClick={() => imageInputRef.current?.click()}
                        >
                          {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Replace'}
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="destructive"
                          className="h-8 w-8"
                          onClick={() => setCourseData({ ...courseData, thumbnail_url: '' } as any)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={uploadingImage}
                      onClick={() => imageInputRef.current?.click()}
                      className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-bhutan-yellow hover:text-foreground disabled:opacity-60"
                    >
                      {uploadingImage ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <UploadCloud className="w-6 h-6" />
                      )}
                      <span className="text-sm font-medium">
                        {uploadingImage ? 'Uploading...' : 'Upload cover image'}
                      </span>
                      <span className="text-xs">JPG, PNG, WEBP, AVIF or GIF · up to 8MB</span>
                    </button>
                  )}
                  <div className="flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <Input
                      value={courseData.thumbnail_url}
                      onChange={(e) => setCourseData({ ...courseData, thumbnail_url: e.target.value } as any)}
                      placeholder="…or paste an image URL"
                    />
                  </div>
                </div>

                {/* Preview Video */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Video className="w-4 h-4" /> Preview Video
                  </Label>
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/ogg,video/quicktime"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) uploadMedia(f, 'video')
                    }}
                  />
                  {courseData.preview_video_url ? (
                    <div className="space-y-2">
                      <div className="relative aspect-video overflow-hidden rounded-lg border bg-black">
                        {(() => {
                          const embed = getEmbedUrl(courseData.preview_video_url)
                          if (!embed) return null
                          return embed.type === 'file' ? (
                            <video src={embed.src} controls className="h-full w-full" />
                          ) : (
                            <iframe
                              src={embed.src}
                              className="h-full w-full"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          )
                        })()}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => setCourseData({ ...courseData, preview_video_url: '' } as any)}
                      >
                        <X className="w-4 h-4 mr-1" /> Remove video
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={uploadingVideo}
                      onClick={() => videoInputRef.current?.click()}
                      className="w-full gap-2"
                    >
                      {uploadingVideo ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <UploadCloud className="w-4 h-4" />
                      )}
                      {uploadingVideo ? 'Uploading...' : 'Upload video (up to 100MB)'}
                    </Button>
                  )}
                  <div className="flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <Input
                      value={courseData.preview_video_url}
                      onChange={(e) => setCourseData({ ...courseData, preview_video_url: e.target.value } as any)}
                      placeholder="…or paste a YouTube / Vimeo / video URL"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CURRICULUM TAB */}
          <TabsContent value="curriculum" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5" /> Course Structure
                    </CardTitle>
                    <CardDescription>Manage your course modules and lessons</CardDescription>
                  </div>
                  <Button onClick={addModule} size="sm" className="w-full sm:w-auto">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Module
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {modules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-10 text-center">
                    <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm font-medium">No modules yet</p>
                    <p className="mb-4 text-xs text-muted-foreground">
                      Add your first module to start building the course
                    </p>
                    <Button onClick={addModule} size="sm">
                      <Plus className="w-4 h-4 mr-2" /> Add Module
                    </Button>
                  </div>
                ) : (
                  modules.map((module, index) => (
                    <div key={module.id} className="rounded-lg border bg-card/50 p-3 space-y-3 sm:p-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <GripVertical className="hidden h-4 w-4 text-muted-foreground sm:block" />
                        <Badge variant="secondary">Module {index + 1}</Badge>
                        <Badge variant="outline" className="text-xs">
                          {module.lessons_count || 0} lessons
                        </Badge>
                        {!(module as any).is_published && (
                          <Badge variant="secondary" className="text-xs">Draft</Badge>
                        )}
                      </div>
                      <Input
                        value={module.title}
                        onChange={(e) => updateModule(module.id, { title: e.target.value })}
                        placeholder="Module title"
                      />
                      <Textarea
                        value={module.description || ''}
                        onChange={(e) => updateModule(module.id, { description: e.target.value })}
                        placeholder="Module description..."
                        rows={2}
                        className="resize-none"
                      />
                      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 sm:flex sm:flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-center sm:w-auto"
                          onClick={() => router.push(`/teach/courses/${courseId}/modules/${module.id}`)}
                        >
                          <BookOpen className="w-4 h-4 mr-1" />
                          Manage
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => router.push(`/teach/courses/${courseId}/modules/${module.id}?action=add-lesson`)}
                          className="w-full justify-center sm:w-auto bg-bhutan-yellow hover:bg-bhutan-orange text-black"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add Lesson
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() => deleteModule(module.id)}
                          aria-label="Delete module"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* SETTINGS TAB */}
          <TabsContent value="settings" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SettingsIcon className="w-5 h-5" /> Publishing & Visibility
                </CardTitle>
                <CardDescription>Control how this course appears to students</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                  <div className="min-w-0">
                    <Label htmlFor="published" className="font-medium">Published</Label>
                    <p className="text-xs text-muted-foreground">
                      Make this course visible and enrollable by students
                    </p>
                  </div>
                  <Switch
                    id="published"
                    checked={(courseData as any).is_published}
                    onCheckedChange={(checked) => setCourseData({ ...courseData, is_published: checked } as any)}
                  />
                </div>
                <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                  <div className="min-w-0">
                    <Label htmlFor="featured" className="font-medium">Featured course</Label>
                    <p className="text-xs text-muted-foreground">
                      Highlight this course on the homepage and catalog
                    </p>
                  </div>
                  <Switch
                    id="featured"
                    checked={courseData.is_featured}
                    onCheckedChange={(checked) => setCourseData({ ...courseData, is_featured: checked } as any)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}