'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft, Plus, Trash2, Loader2, Save, BookOpen, GripVertical,
  Link, Clock, FileText, Users, Settings as SettingsIcon,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import { haptic } from '@/lib/utils'
import type { Database } from '@/types/database.types'

type Course = Database['public']['Tables']['courses']['Row']
type Module = Database['public']['Tables']['modules']['Row']
type Lesson = Database['public']['Tables']['lessons']['Row']

export default function ModuleLessonsPage() {
  const router = useRouter()
  const params = useParams()
  const courseId = params.courseId as string
  const moduleId = params.moduleId as string

  const [loading, setLoading] = useState(true)
  const [module, setModule] = useState<Module | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [course, setCourse] = useState<Course | null>(null)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [draggedLesson, setDraggedLesson] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('lessons')

  const supabase = createClient()

  useEffect(() => {
    fetchModuleData()
  }, [courseId, moduleId])

  const fetchModuleData = async () => {
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

      if ((courseData as any).instructor_id !== user.id && (profile as any)?.role !== 'admin' && (profile as any)?.role !== 'superadmin') {
        alert('Access denied. You can only edit your own courses.')
        router.push('/teach/dashboard')
        return
      }

      setCourse(courseData)

      // Fetch module details
      const { data: moduleData } = await supabase
        .from('modules')
        .select('*')
        .eq('id', moduleId)
        .single()

      if (!moduleData) {
        alert('Module not found')
        router.push(`/teach/courses/${courseId}/edit`)
        return
      }

      setModule(moduleData)

      // Fetch lessons
      const { data: lessonsData } = await supabase
        .from('lessons')
        .select('*')
        .eq('module_id', moduleId)
        .order('order_index', { ascending: true })

      if (lessonsData) {
        setLessons(lessonsData)
      }

      // Check for action query parameter to auto-add lesson
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search)
        const action = urlParams.get('action')

        if (action === 'add-lesson') {
          // Call addLesson directly after data is loaded
          setTimeout(() => {
            addLessonDirectly()
            // Clean up the URL
            window.history.replaceState({}, '', `/teach/courses/${courseId}/modules/${moduleId}`)
          }, 100)
        }
      }

    } catch (error) {
      console.error('Error fetching module data:', error)
      alert('Failed to load module data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Compute the next order_index from the DB to avoid unique-constraint collisions
  const getNextOrderIndex = async () => {
    const { data } = await supabase
      .from('lessons')
      .select('order_index')
      .eq('module_id', moduleId)
      .order('order_index', { ascending: false })
      .limit(1)
    const max = data && data.length > 0 ? ((data[0] as any).order_index ?? -1) : -1
    return max + 1
  }

  const insertLesson = async () => {
    const newLesson = {
      id: crypto.randomUUID(),
      module_id: moduleId,
      title: '',
      description: '',
      video_url: '',
      video_duration: 0,
      duration_minutes: 0,
      transcript: '',
      resources: [],
      order_index: await getNextOrderIndex(),
      is_published: false,
      is_free: false,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const supabaseInsert = supabase as any
    const { data, error } = await supabaseInsert
      .from('lessons')
      .insert(newLesson)
      .select()
      .single()

    if (error) throw error

    setLessons((prev) => [...prev, data as Lesson] as any)
    setHasChanges(true)
  }

  // Direct add lesson function (called internally after auto-add navigation)
  const addLessonDirectly = async () => {
    try {
      await insertLesson()
    } catch (error) {
      console.error('Error adding lesson:', error)
    }
  }

  const addLesson = async () => {
    try {
      await insertLesson()
    } catch (error) {
      console.error('Error adding lesson:', error)
      alert('Failed to add lesson. Please try again.')
    }
  }

  const updateLesson = async (id: string, updates: Partial<Lesson>) => {
    // Optimistic update
    setLessons(lessons.map((lesson: any) => lesson.id === id ? { ...lesson, ...updates } : lesson))
    setHasChanges(true)

    // Persist to database
    try {
      const supabaseUpdate = supabase as any
      const { error } = await supabaseUpdate
        .from('lessons')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) {
        throw error
      }
    } catch (error) {
      console.error('Error updating lesson:', error)
      // Revert on error
      fetchModuleData()
    }
  }

  const deleteLesson = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lesson?')) {
      return
    }

    try {
      // Delete lesson progress first
      await supabase
        .from('lesson_progress')
        .delete()
        .eq('lesson_id', id)

      // Delete quiz questions and attempts
      const { data: quizzes } = await supabase
        .from('quizzes')
        .select('id')
        .eq('lesson_id', id)

      if (quizzes) {
        for (const quiz of (quizzes as any)) {
          await supabase.from('quiz_attempts').delete().eq('quiz_id', quiz.id)
          await supabase.from('quiz_questions').delete().eq('quiz_id', quiz.id)
        }
        await supabase.from('quizzes').delete().eq('lesson_id', id)
      }

      // Delete notes
      await supabase
        .from('notes')
        .delete()
        .eq('lesson_id', id)

      // Delete lesson
      const { error } = await supabase
        .from('lessons')
        .delete()
        .eq('id', id)

      if (error) throw error

      // Update local state
      setLessons(lessons.filter((lesson: any) => lesson.id !== id))
      setHasChanges(true)
    } catch (error) {
      console.error('Error deleting lesson:', error)
      alert('Failed to delete lesson. Please try again.')
    }
  }

  const getYoutubeId = (url: string) => {
    if (!url) return ''
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/)
    return match ? match[1] : ''
  }

  const handleDragStart = (e: React.DragEvent, lessonId: string) => {
    setDraggedLesson(lessonId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (e: React.DragEvent, dropTargetId: string) => {
    e.preventDefault()
    if (!draggedLesson || draggedLesson === dropTargetId) return

    const draggedIndex = lessons.findIndex(l => l.id === draggedLesson)
    const dropIndex = lessons.findIndex(l => l.id === dropTargetId)

    if (draggedIndex === -1 || dropIndex === -1) return

    // Reorder lessons
    const newLessons = [...lessons]
    const [removed] = newLessons.splice(draggedIndex, 1)
    newLessons.splice(dropIndex, 0, removed)

    // Update order indices
    const updates = newLessons.map((lesson, index) => ({
      id: lesson.id,
      order_index: index
    }))

    try {
      // Update all lessons with new order
      for (const update of updates) {
        await supabase
          .from('lessons')
          .update({ order_index: update.order_index })
          .eq('id', update.id)
      }

      setLessons(newLessons)
      setHasChanges(true)
    } catch (error) {
      console.error('Error reordering lessons:', error)
      alert('Failed to reorder lessons. Please try again.')
    }

    setDraggedLesson(null)
  }

  const saveAllChanges = async () => {
    try {
      setSaving(true)

      // Save all lessons
      await Promise.all(
        lessons.map(async (lesson) => {
          const supabaseUpdate = supabase as any
          await supabaseUpdate
            .from('lessons')
            .update({
              title: lesson.title,
              description: lesson.description,
              video_url: lesson.video_url,
              duration_minutes: lesson.duration_minutes,
              is_published: (lesson as any).is_published,
              is_free: lesson.is_free,
              updated_at: new Date().toISOString()
            })
            .eq('id', lesson.id)
        })
      )

      // Save module details
      if (module) {
        const supabaseUpdate = supabase as any
        await supabaseUpdate
          .from('modules')
          .update({
            title: module.title,
            description: module.description,
            is_published: (module as any).is_published,
            updated_at: new Date().toISOString()
          })
          .eq('id', moduleId)
      }

      setHasChanges(false)
      alert('All changes saved successfully!')
    } catch (error) {
      console.error('Error saving changes:', error)
      alert('Failed to save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-bhutan-yellow" />
          <p className="text-muted-foreground">Loading lessons...</p>
        </div>
      </div>
    )
  }

  if (!module || !course) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Module not found</p>
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
    <div className="container mx-auto px-4 py-4 sm:px-6 sm:py-6 max-w-5xl pb-28 lg:pb-6">
      <div className="space-y-4">
        {/* Sticky header with always-visible Save */}
        <div className="sticky top-0 z-30 -mx-4 border-b border-border/40 bg-background/85 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
          <div className="mb-1 flex items-center gap-1 overflow-x-auto scrollbar-hide whitespace-nowrap text-xs text-muted-foreground">
            <button
              onClick={() => router.push(`/teach/courses/${courseId}/edit`)}
              className="shrink-0 hover:text-foreground"
            >
              {course.title}
            </button>
            <span className="shrink-0">/</span>
            <span className="truncate font-medium text-foreground">
              {module.title || 'Untitled Module'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => router.push(`/teach/courses/${courseId}/edit`)}
              aria-label="Back to course"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-bold sm:text-xl">
                {module.title || 'Untitled Module'}
              </h1>
              <p className="text-xs text-muted-foreground">
                {lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'}
                {hasChanges && ' · Unsaved changes'}
              </p>
            </div>
            <Button
              onClick={saveAllChanges}
              disabled={saving || !hasChanges}
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
            <TabsTrigger value="lessons" className="gap-1.5">
              <BookOpen className="w-4 h-4" /> Lessons
              {lessons.length > 0 && (
                <span className="ml-1 rounded-full bg-muted-foreground/15 px-1.5 text-[10px] font-semibold">
                  {lessons.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5">
              <SettingsIcon className="w-4 h-4" /> Module Settings
            </TabsTrigger>
          </TabsList>

          {/* LESSONS TAB */}
          <TabsContent value="lessons" className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'} in this module
              </p>
              <Button onClick={addLesson} size="sm" className="bg-bhutan-yellow hover:bg-bhutan-orange text-black">
                <Plus className="w-4 h-4 mr-1.5" />
                Add Lesson
              </Button>
            </div>

            {lessons.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-12 text-center">
                <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium">No lessons yet</p>
                <p className="mb-4 text-xs text-muted-foreground">
                  Add your first lesson to get started
                </p>
                <Button onClick={addLesson} size="sm">
                  <Plus className="w-4 h-4 mr-1.5" /> Add Lesson
                </Button>
              </div>
            ) : (
              lessons.map((lesson, index) => (
                <div
                  key={lesson.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, lesson.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, lesson.id)}
                  className="rounded-lg border bg-card/50 transition-colors hover:border-bhutan-yellow/50"
                >
                  <div className="space-y-3 p-3 sm:p-4">
                    {/* Badges row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <GripVertical className="hidden h-4 w-4 shrink-0 cursor-move text-muted-foreground sm:block" />
                      <Badge variant="secondary" className="text-xs">Lesson {index + 1}</Badge>
                      {lesson.duration_minutes > 0 && (
                        <Badge variant="outline" className="flex items-center gap-1 text-xs">
                          <Clock className="w-3 h-3" />
                          {Math.round(lesson.duration_minutes / 60)}m
                        </Badge>
                      )}
                      {!(lesson as any).is_published && (
                        <Badge variant="secondary" className="text-xs">Draft</Badge>
                      )}
                      {lesson.is_free && (
                        <Badge className="bg-bhutan-yellow text-black text-xs">Preview</Badge>
                      )}
                    </div>

                    {/* Title */}
                    <Input
                      value={lesson.title}
                      onChange={(e) => updateLesson(lesson.id, { title: e.target.value })}
                      placeholder="Lesson title"
                    />

                    {/* Description */}
                    <Textarea
                      value={lesson.description || ''}
                      onChange={(e) => updateLesson(lesson.id, { description: e.target.value })}
                      placeholder="Lesson description..."
                      rows={2}
                      className="resize-none"
                    />

                    {/* YouTube URL & Duration */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="flex items-center gap-1 text-xs">
                          <Link className="w-3 h-3" /> YouTube URL
                        </Label>
                        <Input
                          value={lesson.video_url || ''}
                          onChange={(e) => updateLesson(lesson.id, { video_url: e.target.value })}
                          placeholder="https://youtube.com/watch?v=..."
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="flex items-center gap-1 text-xs">
                          <Clock className="w-3 h-3" /> Duration (minutes)
                        </Label>
                        <Input
                          type="number"
                          value={lesson.duration_minutes ? Math.round(lesson.duration_minutes / 60) : ''}
                          onChange={(e) =>
                            updateLesson(lesson.id, {
                              duration_minutes: parseInt(e.target.value) * 60 || 0,
                            })
                          }
                          placeholder="30"
                        />
                      </div>
                    </div>

                    {/* Video Preview */}
                    {lesson.video_url && getYoutubeId(lesson.video_url) && (
                      <div className="overflow-hidden rounded-lg border">
                        <div className="aspect-video bg-black">
                          <iframe
                            src={`https://www.youtube.com/embed/${getYoutubeId(lesson.video_url)}?enablejsapi=1&rel=0&modestbranding=1`}
                            className="h-full w-full"
                            allowFullScreen
                            title={lesson.title || 'Lesson video'}
                          />
                        </div>
                      </div>
                    )}

                    <Separator />

                    {/* Action toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Switch
                            checked={(lesson as any).is_published}
                            onCheckedChange={(checked) => updateLesson(lesson.id, { is_published: checked })}
                          />
                          Published
                        </label>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Switch
                            checked={lesson.is_free}
                            onCheckedChange={(checked) => updateLesson(lesson.id, { is_free: checked })}
                          />
                          Free preview
                        </label>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteLesson(lesson.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4 mr-1.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* SETTINGS TAB */}
          <TabsContent value="settings" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <SettingsIcon className="w-5 h-5" /> Module Details
                </CardTitle>
                <CardDescription>Basic information about this module</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="module-title" className="text-sm">Module Title</Label>
                  <Input
                    id="module-title"
                    value={module.title}
                    onChange={(e) => {
                      setModule({ ...module, title: e.target.value })
                      setHasChanges(true)
                    }}
                    placeholder="Module title"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="module-description" className="text-sm">Module Description</Label>
                  <Textarea
                    id="module-description"
                    value={module.description || ''}
                    onChange={(e) => {
                      setModule({ ...module, description: e.target.value })
                      setHasChanges(true)
                    }}
                    placeholder="Module description..."
                    rows={3}
                    className="resize-none"
                  />
                </div>

                <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                  <div className="min-w-0">
                    <Label htmlFor="module-published" className="font-medium">Published</Label>
                    <p className="text-xs text-muted-foreground">
                      Make this module visible to enrolled students
                    </p>
                  </div>
                  <Switch
                    id="module-published"
                    checked={(module as any).is_published || false}
                    onCheckedChange={(checked) => {
                      setModule({ ...module, is_published: checked } as any)
                      setHasChanges(true)
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/teach/courses/${courseId}/edit`)}
                    className="justify-start"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Edit Course Details
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/teach/courses/${courseId}/students`)}
                    className="justify-start"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    View Students
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}