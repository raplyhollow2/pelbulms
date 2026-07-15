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
import { ArrowLeft, Plus, Trash2, Loader2, Save, BookOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Course = Database['public']['Tables']['courses']['Row']
type Module = Database['public']['Tables']['modules']['Row']

export default function EditCoursePage() {
  const router = useRouter()
  const params = useParams()
  const courseId = params.courseId as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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
    is_featured: false
  })

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
        is_featured: course.is_featured
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

  const addModule = () => {
    const newModule = {
      id: crypto.randomUUID(),
      course_id: courseId,
      title: '',
      description: '',
      order_index: modules.length,
      is_published: true,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      lessons_count: 0
    }
    setModules([...modules, newModule] as any)
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
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/teach/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold">Edit Course</h1>
        </div>

        {/* Course Details Form */}
        <Card className="glass-strong">
          <CardHeader>
            <CardTitle>Course Details</CardTitle>
            <CardDescription>Basic information about your course</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={courseData.title}
                  onChange={(e) => setCourseData({ ...courseData, title: e.target.value } as any)}
                  placeholder="Introduction to Python Programming"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="category">Category *</Label>
                <Input
                  id="category"
                  value={courseData.category}
                  onChange={(e) => setCourseData({ ...courseData, category: e.target.value } as any)}
                  placeholder="Programming"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={courseData.description}
                onChange={(e) => setCourseData({ ...courseData, description: e.target.value } as any)}
                placeholder="Learn Python from scratch..."
                rows={3}
                className="mt-1 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="level">Level</Label>
                <select
                  id="level"
                  value={courseData.level}
                  onChange={(e) => setCourseData({ ...courseData, level: e.target.value } as any)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              <div>
                <Label htmlFor="language">Language</Label>
                <Input
                  id="language"
                  value={courseData.language}
                  onChange={(e) => setCourseData({ ...courseData, language: e.target.value } as any)}
                  placeholder="English"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={courseData.duration_minutes}
                  onChange={(e) => setCourseData({ ...courseData, duration_minutes: parseInt(e.target.value) || 0 } as any)}
                  placeholder="300"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="published"
                  checked={(courseData as any).is_published}
                  onCheckedChange={(checked) => setCourseData({ ...courseData, is_published: checked } as any)}
                />
                <Label htmlFor="published">Published</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="featured"
                  checked={courseData.is_featured}
                  onCheckedChange={(checked) => setCourseData({ ...courseData, is_featured: checked } as any)}
                />
                <Label htmlFor="featured">Featured course</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Learning Objectives */}
        <Card className="glass-strong">
          <CardHeader>
            <CardTitle>Learning Objectives</CardTitle>
            <CardDescription>What students will learn from this course</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Add learning objective..."
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    addArrayItem('learning_objectives', e.currentTarget.value)
                    e.currentTarget.value = ''
                  }
                }}
              />
              <Button
                type="button"
                onClick={() => {
                  const input = document.getElementById('add-obj') as HTMLInputElement
                  if (input?.value) {
                    addArrayItem('learning_objectives', input.value)
                    input.value = ''
                  }
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {courseData.learning_objectives.length > 0 && (
              <div className="space-y-2">
                {courseData.learning_objectives.map((objective, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
                    <span className="text-sm">• {objective}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeArrayItem('learning_objectives', index)}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Course Structure */}
        <Card className="glass-strong">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Course Structure</CardTitle>
                <CardDescription>Manage your course modules</CardDescription>
              </div>
              <Button onClick={addModule} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Module
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {modules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No modules yet. Add your first module to get started.
              </div>
            ) : (
              modules.map((module, index) => (
                <div key={module.id} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
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
                        className="mb-2"
                      />
                      <Textarea
                        value={module.description || ''}
                        onChange={(e) => updateModule(module.id, { description: e.target.value })}
                        placeholder="Module description..."
                        rows={2}
                        className="resize-none"
                      />
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/teach/courses/${courseId}/modules/${module.id}`)}
                      >
                        <BookOpen className="w-4 h-4 mr-1" />
                        Manage
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => router.push(`/teach/courses/${courseId}/modules/${module.id}?action=add-lesson`)}
                        className="bg-bhutan-yellow hover:bg-bhutan-orange text-black"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Lesson
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteModule(module.id)}
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

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => router.push('/teach/dashboard')}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-bhutan-yellow hover:bg-bhutan-orange"
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
  )
}