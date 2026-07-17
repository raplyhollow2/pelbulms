'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  Check,
  CloudUpload,
  Settings2,
  BookOpen,
  CircleDashed,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface ModuleRow {
  id: string // DB id
  title: string
  description: string
  order_index: number
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function NewCoursePage() {
  const router = useRouter()
  const supabase = createClient()

  const [courseId, setCourseId] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const [courseData, setCourseData] = useState({
    title: '',
    description: '',
    category: '',
    level: 'beginner',
    language: 'English',
    duration_minutes: 0,
    learning_objectives: [] as string[],
    is_published: false,
    is_featured: false,
  })

  const [modules, setModules] = useState<ModuleRow[]>([])
  const [objectiveDraft, setObjectiveDraft] = useState('')

  // Refs to avoid stale closures / duplicate draft creation
  const courseIdRef = useRef<string | null>(null)
  const creatingRef = useRef(false)
  const slugRef = useRef<string>('')
  const courseSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const moduleSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    courseIdRef.current = courseId
  }, [courseId])

  // Create a draft course row the first time we have meaningful input.
  const ensureCourse = useCallback(async (): Promise<string | null> => {
    if (courseIdRef.current) return courseIdRef.current
    if (creatingRef.current) return null
    creatingRef.current = true
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        toast.error('You must be signed in to create a course')
        return null
      }

      const base = courseData.title.trim() || 'Untitled course'
      slugRef.current = `${slugify(base) || 'course'}-${Date.now().toString(36).slice(-5)}`

      const db = supabase as any
      const { data, error } = await db
        .from('courses')
        .insert({
          instructor_id: user.id,
          title: courseData.title.trim() || 'Untitled course',
          slug: slugRef.current,
          description: courseData.description || null,
          category: courseData.category || 'General',
          level: courseData.level,
          language: courseData.language,
          is_published: false,
          is_featured: courseData.is_featured,
        })
        .select('id')
        .single()

      if (error) throw error
      setCourseId(data.id)
      courseIdRef.current = data.id
      toast.success('Draft created — changes now save automatically')
      return data.id
    } catch (err: any) {
      console.error('Draft create error:', err)
      toast.error(err?.message || 'Could not create draft')
      return null
    } finally {
      creatingRef.current = false
    }
  }, [courseData.title, courseData.description, courseData.category, courseData.level, courseData.language, courseData.is_featured, supabase])

  // Persist course fields (debounced by caller).
  const persistCourse = useCallback(async () => {
    const id = courseIdRef.current
    if (!id) return
    setSaveState('saving')
    try {
      const db = supabase as any
      const { error } = await db
        .from('courses')
        .update({
          title: courseData.title.trim() || 'Untitled course',
          description: courseData.description || null,
          category: courseData.category || 'General',
          level: courseData.level,
          language: courseData.language,
          duration_minutes: courseData.duration_minutes || null,
          learning_objectives:
            courseData.learning_objectives.length > 0 ? courseData.learning_objectives : null,
          is_published: courseData.is_published,
          is_featured: courseData.is_featured,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
      setSaveState('saved')
    } catch (err: any) {
      console.error('Autosave error:', err)
      setSaveState('error')
      toast.error('Autosave failed — retrying on next change')
    }
  }, [courseData, supabase])

  // Debounced autosave whenever course fields change (after a draft exists).
  useEffect(() => {
    const hasInput =
      courseData.title.trim().length > 0 ||
      courseData.description.trim().length > 0 ||
      courseData.category.trim().length > 0
    if (!courseIdRef.current && !hasInput) return

    setSaveState('saving')
    if (courseSaveTimer.current) clearTimeout(courseSaveTimer.current)
    courseSaveTimer.current = setTimeout(async () => {
      const id = courseIdRef.current || (await ensureCourse())
      if (id) await persistCourse()
    }, 800)

    return () => {
      if (courseSaveTimer.current) clearTimeout(courseSaveTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseData])

  const addObjective = () => {
    const v = objectiveDraft.trim()
    if (!v) return
    setCourseData((prev) => ({ ...prev, learning_objectives: [...prev.learning_objectives, v] }))
    setObjectiveDraft('')
  }

  const removeObjective = (index: number) => {
    setCourseData((prev) => ({
      ...prev,
      learning_objectives: prev.learning_objectives.filter((_, i) => i !== index),
    }))
  }

  // Modules persist immediately to the DB so the "Manage lessons" action appears.
  const addModule = async () => {
    const id = courseIdRef.current || (await ensureCourse())
    if (!id) return
    const order_index = modules.length
    try {
      const db = supabase as any
      const { data, error } = await db
        .from('modules')
        .insert({ course_id: id, title: '', description: '', order_index })
        .select('id')
        .single()
      if (error) throw error
      setModules((prev) => [...prev, { id: data.id, title: '', description: '', order_index }])
      toast.success('Module added')
    } catch (err: any) {
      console.error('Add module error:', err)
      toast.error(err?.message || 'Could not add module')
    }
  }

  const updateModule = (id: string, updates: Partial<ModuleRow>) => {
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)))
    if (moduleSaveTimers.current[id]) clearTimeout(moduleSaveTimers.current[id])
    moduleSaveTimers.current[id] = setTimeout(async () => {
      try {
        const current = { ...updates }
        const db = supabase as any
        const { error } = await db
          .from('modules')
          .update({ ...current, updated_at: new Date().toISOString() })
          .eq('id', id)
        if (error) throw error
        setSaveState('saved')
      } catch (err: any) {
        console.error('Module autosave error:', err)
        toast.error('Could not save module')
      }
    }, 700)
  }

  const deleteModule = async (id: string) => {
    setModules((prev) => prev.filter((m) => m.id !== id))
    try {
      const db = supabase as any
      await db.from('modules').delete().eq('id', id)
      toast.success('Module removed')
    } catch (err: any) {
      console.error('Delete module error:', err)
      toast.error('Could not remove module')
    }
  }

  const SaveIndicator = () => {
    const map: Record<SaveState, { icon: React.ReactNode; label: string; className: string }> = {
      idle: { icon: <CircleDashed className="h-3.5 w-3.5" />, label: 'Draft', className: 'text-muted-foreground' },
      saving: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, label: 'Saving…', className: 'text-muted-foreground' },
      saved: { icon: <Check className="h-3.5 w-3.5" />, label: 'All changes saved', className: 'text-green-600' },
      error: { icon: <CloudUpload className="h-3.5 w-3.5" />, label: 'Save failed', className: 'text-destructive' },
    }
    const s = map[saveState]
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.className}`}>
        {s.icon}
        {s.label}
      </span>
    )
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 sm:py-8">
      <div className="space-y-6">
        {/* Sticky header */}
        <div className="sticky top-0 z-20 -mx-4 flex items-center justify-between gap-3 border-b border-border/50 bg-background/80 px-4 py-3 backdrop-blur">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="icon-sm" onClick={() => router.push('/teach/dashboard')} aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
                {courseData.title.trim() || 'Create new course'}
              </h1>
              <SaveIndicator />
            </div>
          </div>
          <Button
            size="sm"
            className="gap-1.5 rounded-full"
            disabled={!courseId}
            onClick={() => router.push(`/teach/courses/${courseId}/edit`)}
          >
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Full editor</span>
          </Button>
        </div>

        {/* Course details */}
        <Card className="glass-strong">
          <CardHeader>
            <CardTitle className="text-base">Course details</CardTitle>
            <CardDescription>Start typing — a draft saves itself automatically.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={courseData.title}
                  onChange={(e) => setCourseData({ ...courseData, title: e.target.value })}
                  placeholder="Introduction to Python Programming"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={courseData.category}
                  onChange={(e) => setCourseData({ ...courseData, category: e.target.value })}
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
                onChange={(e) => setCourseData({ ...courseData, description: e.target.value })}
                placeholder="Learn Python from scratch…"
                rows={3}
                className="mt-1 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="level">Level</Label>
                <select
                  id="level"
                  value={courseData.level}
                  onChange={(e) => setCourseData({ ...courseData, level: e.target.value })}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
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
                  onChange={(e) => setCourseData({ ...courseData, language: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="duration">Duration (min)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={courseData.duration_minutes || ''}
                  onChange={(e) =>
                    setCourseData({ ...courseData, duration_minutes: parseInt(e.target.value) || 0 })
                  }
                  placeholder="300"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-1">
              <div className="flex items-center gap-2">
                <Switch
                  id="published"
                  checked={courseData.is_published}
                  onCheckedChange={(checked) => setCourseData({ ...courseData, is_published: checked })}
                />
                <Label htmlFor="published" className="text-sm">Published</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="featured"
                  checked={courseData.is_featured}
                  onCheckedChange={(checked) => setCourseData({ ...courseData, is_featured: checked })}
                />
                <Label htmlFor="featured" className="text-sm">Featured</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Learning objectives */}
        <Card className="glass-strong">
          <CardHeader>
            <CardTitle className="text-base">Learning objectives</CardTitle>
            <CardDescription>What students will be able to do after this course.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={objectiveDraft}
                onChange={(e) => setObjectiveDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addObjective()
                  }
                }}
                placeholder="Add a learning objective and press Enter"
              />
              <Button type="button" size="icon" onClick={addObjective} aria-label="Add objective">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {courseData.learning_objectives.length > 0 && (
              <ul className="space-y-2">
                {courseData.learning_objectives.map((objective, index) => (
                  <li
                    key={index}
                    className="flex items-center justify-between gap-3 rounded-lg bg-background/50 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate">{objective}</span>
                    <button
                      type="button"
                      onClick={() => removeObjective(index)}
                      className="text-muted-foreground transition-colors hover:text-destructive"
                      aria-label="Remove objective"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Modules + lessons */}
        <Card className="glass-strong">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base">Course structure</CardTitle>
                <CardDescription>Add modules, then manage their lessons.</CardDescription>
              </div>
              <Button onClick={addModule} size="sm" className="shrink-0 gap-1.5">
                <Plus className="h-4 w-4" />
                Add module
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {modules.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                No modules yet. Add your first module — lesson management appears instantly.
              </div>
            ) : (
              modules.map((module, index) => (
                <div key={module.id} className="rounded-xl border border-border/60 bg-background/40 p-4">
                  <div className="flex items-start gap-3">
                    <Badge variant="secondary" className="mt-1 shrink-0">
                      {index + 1}
                    </Badge>
                    <div className="min-w-0 flex-1 space-y-2">
                      <Input
                        value={module.title}
                        onChange={(e) => updateModule(module.id, { title: e.target.value })}
                        placeholder="Module title"
                      />
                      <Textarea
                        value={module.description}
                        onChange={(e) => updateModule(module.id, { description: e.target.value })}
                        placeholder="Module description…"
                        rows={2}
                        className="resize-none"
                      />
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {/* Appears automatically once the module exists in the DB */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 rounded-full"
                          render={
                            <Link href={`/teach/courses/${courseId}/modules/${module.id}`} />
                          }
                        >
                          <BookOpen className="h-4 w-4" />
                          Manage lessons
                        </Button>
                        <button
                          type="button"
                          onClick={() => deleteModule(module.id)}
                          className="ml-auto text-muted-foreground transition-colors hover:text-destructive"
                          aria-label="Delete module"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 pb-4">
          <SaveIndicator />
          <Button
            className="gap-1.5 rounded-full"
            disabled={!courseId}
            onClick={() => {
              toast.success('Course saved')
              router.push('/teach/dashboard')
            }}
          >
            <Check className="h-4 w-4" />
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}
