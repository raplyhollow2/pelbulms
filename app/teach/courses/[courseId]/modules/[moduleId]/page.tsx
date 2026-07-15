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
import { ArrowLeft, Plus, Trash2, Loader2, Save, BookOpen, Play, Edit } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
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

      // Check if user is the instructor
      if ((courseData as any).instructor_id !== user.id) {
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

    } catch (error) {
      console.error('Error fetching module data:', error)
      alert('Failed to load module data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const addLesson = async () => {
    const newLesson = {
      id: crypto.randomUUID(),
      module_id: moduleId,
      title: '',
      description: '',
      video_url: '',
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
    } catch (error) {
      console.error('Error adding lesson:', error)
      alert('Failed to add lesson. Please try again.')
    }
  }

  const updateLesson = async (id: string, updates: Partial<Lesson>) => {
    // Optimistic update
    setLessons(lessons.map((lesson: any) => lesson.id === id ? { ...lesson, ...updates } : lesson))

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

      if (error) throw error
    } catch (error) {
      console.error('Error updating lesson:', error)
      alert('Failed to update lesson. Please try again.')
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

  const markAsChanged = () => {
    setHasChanges(true)
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-bhutan-yellow" />
          <span className="ml-3 text-muted-foreground">Loading lessons...</span>
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
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.push(`/teach/courses/${courseId}/edit`)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Course
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{module.title || 'Untitled Module'}</h1>
              <p className="text-muted-foreground">{course.title}</p>
            </div>
          </div>
          <Button
            onClick={saveAllChanges}
            disabled={saving || !hasChanges}
            className="bg-bhutan-yellow hover:bg-bhutan-orange touch-feedback"
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

        {/* Module Info */}
        <Card className="glass-strong">
          <CardHeader>
            <CardTitle>Module Details</CardTitle>
            <CardDescription>Basic information about this module</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="module-title">Module Title</Label>
              <Input
                id="module-title"
                value={module.title}
                onChange={(e) => {
                  setModule({ ...module, title: e.target.value })
                  markAsChanged()
                }}
                placeholder="Module title"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="module-description">Module Description</Label>
              <Textarea
                id="module-description"
                value={module.description || ''}
                onChange={(e) => {
                  setModule({ ...module, description: e.target.value })
                  markAsChanged()
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
                  markAsChanged()
                }}
              />
              <Label htmlFor="module-published">Published</Label>
            </div>
          </CardContent>
        </Card>

        {/* Lessons */}
        <Card className="glass-strong">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Lessons</CardTitle>
                <CardDescription>Manage your lesson content</CardDescription>
              </div>
              <Button onClick={addLesson} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Lesson
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {lessons.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No lessons yet. Add your first lesson to get started.
              </div>
            ) : (
              lessons.map((lesson, index) => (
                <div key={lesson.id} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary">Lesson {index + 1}</Badge>
                        <Badge variant="outline" className="text-xs">
                          {lesson.duration_minutes ? `${Math.floor(lesson.duration_minutes / 60)}m` : 'No duration'}
                        </Badge>
                        {!(lesson as any).is_published && (
                          <Badge variant="secondary" className="text-xs">Draft</Badge>
                        )}
                        {lesson.is_free && (
                          <Badge variant="default" className="text-xs">Preview</Badge>
                        )}
                      </div>

                      <Input
                        value={lesson.title}
                        onChange={(e) => {
                          updateLesson(lesson.id, { title: e.target.value })
                          markAsChanged()
                        }}
                        placeholder="Lesson title"
                        className="mb-2"
                      />

                      <Textarea
                        value={lesson.description || ''}
                        onChange={(e) => {
                          updateLesson(lesson.id, { description: e.target.value })
                          markAsChanged()
                        }}
                        placeholder="Lesson description..."
                        rows={2}
                        className="resize-none mb-2"
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                        <div>
                          <Label className="text-xs">YouTube URL</Label>
                          <Input
                            value={lesson.video_url || ''}
                            onChange={(e) => {
                              updateLesson(lesson.id, { video_url: e.target.value })
                              markAsChanged()
                            }}
                            placeholder="https://youtube.com/watch?v=..."
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Duration (minutes)</Label>
                          <Input
                            type="number"
                            value={lesson.duration_minutes ? Math.round(lesson.duration_minutes / 60) : ''}
                            onChange={(e) => {
                              updateLesson(lesson.id, {
                                duration_minutes: parseInt(e.target.value) * 60 || 0
                              })
                              markAsChanged()
                            }}
                            placeholder="30"
                            className="mt-1"
                          />
                        </div>
                      </div>

                      {lesson.video_url && (
                        <div className="mt-2 p-2 bg-secondary/30 rounded">
                          <p className="text-xs text-muted-foreground mb-1">Preview:</p>
                          <div className="aspect-video bg-black rounded flex items-center justify-center">
                            <iframe
                              src={`https://www.youtube.com/embed/${getYoutubeId(lesson.video_url)}?enablejsapi=1&rel=0&modestbranding=1`}
                              className="w-full h-full rounded"
                              allowFullScreen
                              title={lesson.title || 'Lesson video'}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <div className="flex flex-col gap-2">
                        <Switch
                          checked={(lesson as any).is_published}
                          onCheckedChange={(checked) => {
                            updateLesson(lesson.id, { is_published: checked })
                            markAsChanged()
                          }}
                        />
                        <span className="text-xs text-muted-foreground">Published</span>

                        <Switch
                          checked={lesson.is_free}
                          onCheckedChange={(checked) => {
                            updateLesson(lesson.id, { is_free: checked })
                            markAsChanged()
                          }}
                        />
                        <span className="text-xs text-muted-foreground">Preview</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(lesson.video_url || '', '_blank')}
                        disabled={!lesson.video_url}
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/teach/courses/${courseId}/lessons/${lesson.id}`)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteLesson(lesson.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}