'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Plus, Trash2, Loader2, Save, Wand2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type CreationMethod = 'form' | 'markdown' | 'ai' | 'advanced'

export default function NewCoursePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedMethod, setSelectedMethod] = useState<CreationMethod>('form')

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

  const [modules, setModules] = useState<Array<{
    id: string
    title: string
    description: string
    order_index: number
  }>>([])

  const supabase = createClient()

  const handleSave = async () => {
    if (!courseData.title.trim()) {
      alert('Please enter a course title')
      return
    }

    if (modules.length === 0) {
      alert('Please add at least one module')
      return
    }

    try {
      setSaving(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Generate slug from title if not provided
      const slug = courseData.slug || courseData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')

      // Create course
      const supabaseInsert = supabase as any
      const { data: course, error } = await supabaseInsert
        .from('courses')
        .insert({
          instructor_id: user.id,
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
          is_featured: courseData.is_featured
        })
        .select()
        .single()

      if (error) throw error

      // Create modules
      if (course && modules.length > 0) {
        const supabaseInsert = supabase as any
        const { error: modulesError } = await supabaseInsert
          .from('modules')
          .insert(modules.map((mod: any) => ({
            course_id: course.id,
            title: mod.title,
            description: mod.description,
            order_index: mod.order_index
          })))

        if (modulesError) throw modulesError
      }

      alert('Course created successfully!')
      router.push('/teach/dashboard')

    } catch (error) {
      console.error('Error creating course:', error)
      alert('Failed to create course. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const addModule = () => {
    setModules([...modules, {
      id: Date.now().toString(),
      title: '',
      description: '',
      order_index: modules.length
    }] as any)
  }

  const updateModule = (id: string, updates: Partial<typeof modules[0]>) => {
    setModules(modules.map((mod: any) => mod.id === id ? { ...mod, ...updates } : mod))
  }

  const deleteModule = (id: string) => {
    setModules(modules.filter((mod: any) => mod.id !== id))
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

  const generateWithAI = async () => {
    // Placeholder for AI course generation
    const topic = prompt('Enter the topic you want to create a course about:')
    if (topic) {
      alert(`AI course generation for "${topic}" will be implemented with Groq + Gemini integration.`)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-bhutan-yellow" />
          <span className="ml-3 text-muted-foreground">Loading...</span>
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
          <h1 className="text-3xl font-bold">Create New Course</h1>
        </div>

        {/* Creation Method Selection */}
        {!selectedMethod ? (
          <Card className="glass-strong">
            <CardHeader>
              <CardTitle>Choose Creation Method</CardTitle>
              <CardDescription>Select how you'd like to create your course content</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="h-24 flex flex-col items-center justify-center gap-2"
                onClick={() => setSelectedMethod('form')}
              >
                <div className="text-2xl">📝</div>
                <div className="text-center">
                  <div className="font-semibold">Form-Based</div>
                  <div className="text-xs text-muted-foreground">Step by step guide</div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-24 flex flex-col items-center justify-center gap-2"
                onClick={() => setSelectedMethod('markdown')}
              >
                <div className="text-2xl">📄</div>
                <div className="text-center">
                  <div className="font-semibold">Markdown</div>
                  <div className="text-xs text-muted-foreground">Paste markdown content</div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-24 flex flex-col items-center justify-center gap-2"
                onClick={() => setSelectedMethod('ai')}
              >
                <div className="text-2xl">🤖</div>
                <div className="text-center">
                  <div className="font-semibold">AI Assistant</div>
                  <div className="text-xs text-muted-foreground">Auto-generate content</div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-24 flex flex-col items-center justify-center gap-2"
                onClick={() => setSelectedMethod('advanced')}
              >
                <div className="text-2xl">⚡</div>
                <div className="text-center">
                  <div className="font-semibold">Advanced Editor</div>
                  <div className="text-xs text-muted-foreground">Rich text editor</div>
                </div>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
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
                    <Label htmlFor="published">Publish immediately</Label>
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
                  <Button type="button" onClick={() => document.getElementById('add-obj')?.click()}>
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
                    <CardDescription>Add modules to organize your content</CardDescription>
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
                          </div>
                          <Input
                            value={module.title}
                            onChange={(e) => updateModule(module.id, { title: e.target.value })}
                            placeholder="Module title"
                            className="mb-2"
                          />
                          <Textarea
                            value={module.description}
                            onChange={(e) => updateModule(module.id, { description: e.target.value })}
                            placeholder="Module description..."
                            rows={2}
                            className="resize-none"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteModule(module.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
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
                onClick={() => setSelectedMethod('form')}
                disabled={saving}
              >
                Back
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
                    Create Course
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}