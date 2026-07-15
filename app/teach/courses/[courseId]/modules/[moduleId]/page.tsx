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
import { ArrowLeft, Plus, Trash2, Loader2, Save, BookOpen, GripVertical, Link, Clock, FileText } from 'lucide-react'
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

      if ((courseData as any).instructor_id !== user.id && (profile as any)?.role !== 'admin') {
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

  // Direct add lesson function (called internally)
  const addLessonDirectly = async () => {
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
      order_index: lessons.length,
      is_published: false,
      is_free: false,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    try {
      const supabaseInsert = supabase as any
      const { data, error } = await supabaseInsert
        .from('lessons')
        .insert(newLesson)
        .select()
        .single()

      if (error) throw error

      setLessons([...lessons, data as Lesson] as any)
      setHasChanges(true)
    } catch (error) {
      console.error('Error adding lesson:', error)
    }
  }

  const addLesson = async () => {
    haptic()
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
      order_index: lessons.length,
      is_published: false,
      is_free: false,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    try {
      const supabaseInsert = supabase as any
      const { data, error } = await supabaseInsert
        .from('lessons')
        .insert(newLesson)
        .select()
        .single()

      if (error) throw error

      setLessons([...lessons, data as Lesson] as any)
      setHasChanges(true)
    } catch (error) {
      console.error('Error adding lesson:', error)
      alert('Failed to add lesson. Please try again.')
    }
  }

  const updateLesson = async (id: string, updates: Partial<Lesson>) => {
    haptic()

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
    haptic()
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
    haptic()
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
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/teach/dashboard')}
              className="h-auto p-0 text-muted-foreground hover:text-foreground"
            >
              Dashboard
            </Button>
            <span className="text-muted-foreground">/</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/teach/courses/${courseId}/edit`)}
              className="h-auto p-0 text-muted-foreground hover:text-foreground"
            >
              {course.title}
            </Button>
            <span className="text-muted-foreground">/</span>
            <span className="text-foreground font-medium">{module.title || 'Untitled Module'}</span>
          </div>

          {/* Main Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">{course.category}</Badge>
                <Badge className="text-xs bg-bhutan-yellow text-black">Module</Badge>
                {lessons.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'}
                  </Badge>
                )}
              </div>
              <h1 className="text-3xl font-bold">{module.title || 'Untitled Module'}</h1>
              <p className="text-muted-foreground">{course.title}</p>
            </div>

            <div className="flex items-center gap-2">
              {hasChanges && (
                <Badge variant="secondary" className="text-sm">Unsaved changes</Badge>
              )}
              <Button
                onClick={saveAllChanges}
                disabled={saving || !hasChanges}
                className="bg-bhutan-yellow hover:bg-bhutan-orange text-black"
                size="lg"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Module Info Card */}
        <Card className="glass">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Module Details</CardTitle>
            <CardDescription className="text-sm">Basic information about this module</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="module-title" className="text-sm">Module Title</Label>
              <Input
                id="module-title"
                value={module.title}
                onChange={(e) => {
                  setModule({ ...module, title: e.target.value })
                  setHasChanges(true)
                }}
                placeholder="Module title"
                className="mt-1"
              />
            </div>

            <div>
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
                className="mt-1 resize-none"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="module-published"
                checked={(module as any).is_published || false}
                onCheckedChange={(checked) => {
                  setModule({ ...module, is_published: checked } as any)
                  setHasChanges(true)
                }}
              />
              <Label htmlFor="module-published" className="text-sm">Published</Label>
            </div>
          </CardContent>
        </Card>

        {/* Lessons Card */}
        <Card className="glass">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Lessons</CardTitle>
                <CardDescription className="text-sm">
                  {lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'}
                </CardDescription>
              </div>
              <Button onClick={addLesson} size="sm" className="bg-bhutan-yellow hover:bg-bhutan-orange text-black">
                <Plus className="w-4 h-4 mr-2" />
                Add Lesson
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {lessons.length === 0 ? (
              <div className="text-center py-12 bg-muted/30 rounded-lg">
                <BookOpen className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">No lessons yet</p>
                <p className="text-sm text-muted-foreground">Add your first lesson to get started</p>
              </div>
            ) : (
              lessons.map((lesson, index) => (
                <div
                  key={lesson.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, lesson.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, lesson.id)}
                  className="group border rounded-lg hover:border-bhutan-yellow/50 transition-all overflow-hidden"
                >
                  <div className="p-4 space-y-3">
                    {/* Lesson Header */}
                    <div className="flex items-start gap-3">
                      <div className="cursor-move flex-shrink-0 mt-1">
                        <GripVertical className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <Badge variant="secondary" className="text-xs">
                            {index + 1}
                          </Badge>
                          {lesson.duration_minutes > 0 && (
                            <Badge variant="outline" className="text-xs flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {Math.floor(lesson.duration_minutes / 60)}m
                            </Badge>
                          )}
                          {!(lesson as any).is_published && (
                            <Badge variant="secondary" className="text-xs">Draft</Badge>
                          )}
                          {lesson.is_free && (
                            <Badge variant="default" className="text-xs bg-bhutan-yellow text-black">Preview</Badge>
                          )}
                        </div>

                        {/* Title */}
                        <Input
                          value={lesson.title}
                          onChange={(e) => {
                            updateLesson(lesson.id, { title: e.target.value })
                          }}
                          placeholder="Lesson title"
                          className="mb-2"
                        />

                        {/* Description */}
                        <Textarea
                          value={lesson.description || ''}
                          onChange={(e) => {
                            updateLesson(lesson.id, { description: e.target.value })
                          }}
                          placeholder="Lesson description..."
                          rows={2}
                          className="resize-none mb-2"
                        />

                        {/* YouTube URL & Duration */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs flex items-center gap-1">
                              <Link className="w-3 h-3" />
                              YouTube URL
                            </Label>
                            <Input
                              value={lesson.video_url || ''}
                              onChange={(e) => {
                                updateLesson(lesson.id, { video_url: e.target.value })
                              }}
                              placeholder="https://youtube.com/watch?v=..."
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Duration (minutes)
                            </Label>
                            <Input
                              type="number"
                              value={lesson.duration_minutes ? Math.round(lesson.duration_minutes / 60) : ''}
                              onChange={(e) => {
                                updateLesson(lesson.id, {
                                  duration_minutes: parseInt(e.target.value) * 60 || 0
                                })
                              }}
                              placeholder="30"
                              className="mt-1"
                            />
                          </div>
                        </div>

                        {/* Video Preview */}
                        {lesson.video_url && getYoutubeId(lesson.video_url) && (
                          <div className="mt-2 p-2 bg-muted/30 rounded">
                            <p className="text-xs text-muted-foreground mb-1">Preview:</p>
                            <div className="aspect-video bg-black rounded overflow-hidden">
                              <iframe
                                src={`https://www.youtube.com/embed/${getYoutubeId(lesson.video_url)}?enablejsapi=1&rel=0&modestbranding=1`}
                                className="w-full h-full"
                                allowFullScreen
                                title={lesson.title || 'Lesson video'}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-3 items-end">
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={(lesson as any).is_published}
                            onCheckedChange={(checked) => {
                              updateLesson(lesson.id, { is_published: checked })
                            }}
                          />
                          <span className="text-xs text-muted-foreground">Published</span>
                        </div>

                        <div className="flex items-center gap-3">
                          <Switch
                            checked={lesson.is_free}
                            onCheckedChange={(checked) => {
                              updateLesson(lesson.id, { is_free: checked })
                            }}
                          />
                          <span className="text-xs text-muted-foreground">Free</span>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteLesson(lesson.id)}
                          className="text-red-600 hover:text-red-700 mt-auto"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
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
                <BookOpen className="w-4 h-4 mr-2" />
                View Students
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}