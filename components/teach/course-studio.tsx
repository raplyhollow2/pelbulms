'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { LessonBlocks } from '@/components/course/lesson-blocks'
import { BlockPicker } from '@/components/teach/block-picker'
import { AskPelbuRail } from '@/components/ai/ask-pelbu-rail'
import { parseLessonBlocks, readCourseAiMetadata, type LessonBlock } from '@/lib/lesson-blocks'
import { Plus, Share2, Palette, Bot, Eye, Loader2, Settings, MoreHorizontal, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { CourseSettingsSheet } from '@/components/teach/course-settings-form'
import { LessonOptionsPanel } from '@/components/teach/lesson-options-panel'
import { ModuleOptionsPanel } from '@/components/teach/module-options-panel'

type ModuleRow = { id: string; title: string; order_index: number }
type LessonRow = {
  id: string
  module_id: string
  title: string
  content: unknown
  order_index: number
}

export function CourseStudio({ courseId }: { courseId: string }) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [course, setCourse] = useState<any>(null)
  const [modules, setModules] = useState<ModuleRow[]>([])
  const [lessons, setLessons] = useState<LessonRow[]>([])
  const [lessonId, setLessonId] = useState<string | null>(null)
  const [blocks, setBlocks] = useState<LessonBlock[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [mobileTab, setMobileTab] = useState<'outline' | 'page' | 'ai'>('page')
  const [themeOpen, setThemeOpen] = useState(false)
  const [tutorOpen, setTutorOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pageOptionsId, setPageOptionsId] = useState<string | null>(null)
  const [moduleOptionsId, setModuleOptionsId] = useState<string | null>(null)

  const current = lessons.find((l) => l.id === lessonId)

  const load = async () => {
    setLoading(true)
    const { data: courseRow } = await supabase.from('courses').select('*').eq('id', courseId).single()
    const { data: moduleRows } = await supabase
      .from('modules')
      .select('id, title, order_index')
      .eq('course_id', courseId)
      .order('order_index')
    const moduleIds = (moduleRows || []).map((m: any) => m.id)
    let lessonRows: LessonRow[] = []
    if (moduleIds.length) {
      const { data } = await supabase
        .from('lessons')
        .select('id, module_id, title, content, order_index')
        .in('module_id', moduleIds)
        .order('order_index')
      lessonRows = (data || []) as any
    }
    setCourse(courseRow)
    setModules((moduleRows || []) as any)
    setLessons(lessonRows)
    const first = lessonRows[0]?.id
    setLessonId((prev) => prev || first || null)
    if (first) setBlocks(parseLessonBlocks(lessonRows.find((l) => l.id === first)?.content))
    setLoading(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if (e.key === '/') {
        e.preventDefault()
        setPickerOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const row = lessons.find((l) => l.id === lessonId)
    if (row) setBlocks(parseLessonBlocks(row.content))
  }, [lessonId, lessons])

  const saveBlocks = async (next: LessonBlock[]) => {
    if (!lessonId) return
    setBlocks(next)
    setSaving(true)
    await (supabase as any)
      .from('lessons')
      .update({ content: next, updated_at: new Date().toISOString() })
      .eq('id', lessonId)
    setLessons((rows) => rows.map((r) => (r.id === lessonId ? { ...r, content: next } : r)))
    setSaving(false)
  }

  const addModule = async () => {
    const { data } = await (supabase as any)
      .from('modules')
      .insert({
        course_id: courseId,
        title: 'New module',
        description: '',
        order_index: modules.length,
        is_published: false,
      })
      .select('id, title, order_index')
      .single()
    if (data) setModules((rows) => [...rows, data])
  }

  const commitModuleTitle = async (moduleId: string, title: string) => {
    const next = title.trim() || 'Untitled module'
    setModules((rows) => rows.map((row) => (row.id === moduleId ? { ...row, title: next } : row)))
    await (supabase as any)
      .from('modules')
      .update({ title: next, updated_at: new Date().toISOString() })
      .eq('id', moduleId)
  }

  const moveModule = async (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= modules.length) return
    const next = [...modules]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    const ordered = next.map((row, order_index) => ({ ...row, order_index }))
    setModules(ordered)
    await Promise.all(
      ordered.map((row) =>
        (supabase as any)
          .from('modules')
          .update({ order_index: row.order_index, updated_at: new Date().toISOString() })
          .eq('id', row.id)
      )
    )
  }

  const deleteModule = async (moduleId: string) => {
    if (!window.confirm('Delete this module and its pages?')) return
    const { error: lessonError } = await (supabase as any).from('lessons').delete().eq('module_id', moduleId)
    if (lessonError) return
    const { error: moduleError } = await (supabase as any).from('modules').delete().eq('id', moduleId)
    if (moduleError) return
    const remainingLessons = lessons.filter((row) => row.module_id !== moduleId)
    setLessons(remainingLessons)
    const ordered = modules
      .filter((row) => row.id !== moduleId)
      .map((row, order_index) => ({ ...row, order_index }))
    setModules(ordered)
    await Promise.all(
      ordered.map((row) =>
        (supabase as any)
          .from('modules')
          .update({ order_index: row.order_index, updated_at: new Date().toISOString() })
          .eq('id', row.id)
      )
    )
    if (moduleOptionsId === moduleId) setModuleOptionsId(null)
    if (pageOptionsId && remainingLessons.every((row) => row.id !== pageOptionsId)) setPageOptionsId(null)
    if (lessonId && remainingLessons.every((row) => row.id !== lessonId)) {
      setLessonId(remainingLessons[0]?.id || null)
    }
  }

  const togglePublish = async () => {
    const next = !course?.is_published
    setPublishing(true)
    setCourse((current: any) => (current ? { ...current, is_published: next } : current))
    await (supabase as any)
      .from('courses')
      .update({ is_published: next, updated_at: new Date().toISOString() })
      .eq('id', courseId)
    setPublishing(false)
  }

  const addPage = async (moduleId: string) => {
    const existing = lessonsByModule.get(moduleId) || []
    const { data } = await (supabase as any)
      .from('lessons')
      .insert({
        module_id: moduleId,
        title: 'New page',
        content: [],
        order_index: existing.length,
        is_published: false,
        duration_minutes: 10,
        resources: [],
      })
      .select('id, module_id, title, content, order_index')
      .single()
    if (data) {
      setLessons((rows) => [...rows, data])
      setLessonId(data.id)
      setBlocks([])
      setMobileTab('page')
    }
  }

  const lessonsByModule = useMemo(() => {
    const map = new Map<string, LessonRow[]>()
    for (const les of lessons) {
      const list = map.get(les.module_id) || []
      list.push(les)
      map.set(les.module_id, list)
    }
    return map
  }, [lessons])

  const meta = readCourseAiMetadata(course?.metadata)
  const shareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/courses/${courseId}` : `/courses/${courseId}`

  const saveMeta = async (patch: any) => {
    const next = { ...(course?.metadata || {}), ...patch }
    await (supabase as any)
      .from('courses')
      .update({ metadata: next, updated_at: new Date().toISOString() })
      .eq('id', courseId)
    setCourse((c: any) => ({ ...c, metadata: next }))
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-bhutan-yellow" />
      </div>
    )
  }

  const outline = (
    <nav className="space-y-4">
      {modules.length === 0 && (
        <p className="px-2 text-sm text-muted-foreground">Add a module to start the outline.</p>
      )}
      {modules.map((mod, index) => (
        <div key={mod.id}>
          <div className="flex items-center gap-1">
            <Input
              value={mod.title}
              aria-label="Module title"
              className="h-9 min-w-0 flex-1 text-xs"
              onChange={(e) =>
                setModules((rows) => rows.map((row) => (row.id === mod.id ? { ...row, title: e.target.value } : row)))
              }
              onBlur={() => void commitModuleTitle(mod.id, mod.title)}
            />
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md hover:bg-muted">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Module actions</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem disabled={index === 0} onClick={() => void moveModule(index, -1)}>
                  Move up
                </DropdownMenuItem>
                <DropdownMenuItem disabled={index === modules.length - 1} onClick={() => void moveModule(index, 1)}>
                  Move down
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setModuleOptionsId(mod.id)}>Resources and gates</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void deleteModule(mod.id)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete module
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="mt-1 space-y-1">
            {(lessonsByModule.get(mod.id) || []).map((les) => (
              <div key={les.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setLessonId(les.id)
                    setMobileTab('page')
                  }}
                  className={`min-h-11 flex-1 rounded-lg px-2 text-left text-sm ${
                    les.id === lessonId ? 'bg-bhutan-yellow/20 font-medium' : 'hover:bg-muted'
                  }`}
                >
                  {les.title}
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="min-h-11 min-w-11 shrink-0"
                  aria-label="Page options"
                  onClick={() => setPageOptionsId(les.id)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11 w-full justify-start"
              onClick={() => void addPage(mod.id)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add page
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => void addModule()}>
        <Plus className="mr-2 h-4 w-4" />
        Add module
      </Button>
    </nav>
  )

  const canvas = (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {current?.title || (modules.length ? 'Select a page' : 'Add a module to start')}
        </h2>
        <Button type="button" variant="outline" className="min-h-11" onClick={() => setPickerOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add
        </Button>
      </div>
      <LessonBlocks
        content={blocks}
        lessonId={lessonId || undefined}
        editable
        onChange={(next) => void saveBlocks(next)}
      />
      {saving && <p className="text-xs text-muted-foreground">Saving…</p>}
    </div>
  )

  const rail = (
      <AskPelbuRail
      courseId={courseId}
      lessonId={lessonId || undefined}
      onApplied={(next) => {
        if (Array.isArray(next)) void saveBlocks(next as LessonBlock[])
      }}
      onStructureApplied={() => void load()}
    />
  )

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{course?.title}</p>
          <p className="text-xs text-muted-foreground">
            Course studio · {course?.is_published ? 'Published' : 'Draft'}
          </p>
        </div>
        <Button type="button" variant="outline" className="min-h-11" onClick={() => setSettingsOpen(true)}>
          <Settings className="mr-2 h-4 w-4" /> Settings
        </Button>
        <Button type="button" variant="outline" className="min-h-11" onClick={() => setThemeOpen(true)}>
          <Palette className="mr-2 h-4 w-4" /> Theme
        </Button>
        <Button type="button" variant="outline" className="min-h-11" onClick={() => setTutorOpen(true)}>
          <Bot className="mr-2 h-4 w-4" /> Tutor
        </Button>
        <Button type="button" variant="outline" className="min-h-11" onClick={() => setShareOpen(true)}>
          <Share2 className="mr-2 h-4 w-4" /> Share
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          render={<Link href={lessonId ? `/learn/${courseId}/lesson/${lessonId}` : `/courses/${courseId}`} />}
        >
          <Eye className="mr-2 h-4 w-4" /> Preview
        </Button>
        <Button
          type="button"
          className="min-h-11 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
          disabled={publishing}
          onClick={() => void togglePublish()}
        >
          {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {course?.is_published ? 'Unpublish' : 'Publish'}
        </Button>
      </header>

      <div className="flex gap-2 border-b px-4 py-2 lg:hidden">
        {(['outline', 'page', 'ai'] as const).map((tab) => (
          <Button
            key={tab}
            type="button"
            variant={mobileTab === tab ? 'default' : 'outline'}
            className="min-h-11 capitalize"
            onClick={() => setMobileTab(tab)}
          >
            {tab}
          </Button>
        ))}
      </div>

      <div className="grid flex-1 lg:grid-cols-[280px_1fr_320px]">
        <aside className={`overflow-y-auto border-r p-3 ${mobileTab === 'outline' ? 'block' : 'hidden'} lg:block`}>
          {outline}
        </aside>
        <main className={`p-4 ${mobileTab === 'page' ? 'block' : 'hidden'} lg:block`}>{canvas}</main>
        <aside className={`border-l p-3 ${mobileTab === 'ai' ? 'block' : 'hidden'} lg:block`}>{rail}</aside>
      </div>

      <BlockPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        lessonId={lessonId || undefined}
        onPick={(block) => void saveBlocks([...blocks, block])}
      />

      <CourseSettingsSheet
        courseId={courseId}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onUpdated={(patch) => setCourse((current: any) => (current ? { ...current, ...patch } : current))}
      />

      <Sheet open={!!pageOptionsId} onOpenChange={(next) => !next && setPageOptionsId(null)}>
        <SheetContent className="w-full overflow-y-auto data-[side=right]:sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Page options</SheetTitle>
            <SheetDescription>Video, activities, and gates for this page.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {pageOptionsId && (
              <LessonOptionsPanel
                courseId={courseId}
                lessonId={pageOptionsId}
                onTitleChange={(title) =>
                  setLessons((rows) => rows.map((row) => (row.id === pageOptionsId ? { ...row, title } : row)))
                }
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={!!moduleOptionsId} onOpenChange={(next) => !next && setModuleOptionsId(null)}>
        <SheetContent className="w-full overflow-y-auto data-[side=right]:sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Module options</SheetTitle>
            <SheetDescription>Resources and progression gates.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {moduleOptionsId && (
              <ModuleOptionsPanel
                courseId={courseId}
                moduleId={moduleOptionsId}
                onTitleChange={(title) =>
                  setModules((rows) => rows.map((row) => (row.id === moduleOptionsId ? { ...row, title } : row)))
                }
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={themeOpen} onOpenChange={setThemeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Course theme</DialogTitle>
            <DialogDescription>Colors apply on the learner player.</DialogDescription>
          </DialogHeader>
          <ThemeForm
            value={meta.theme || {}}
            onSave={(theme) => {
              void saveMeta({ theme })
              setThemeOpen(false)
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={tutorOpen} onOpenChange={setTutorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI tutor</DialogTitle>
          </DialogHeader>
          <TutorForm
            value={meta.tutor || {}}
            onSave={(tutor) => {
              void saveMeta({ tutor })
              setTutorOpen(false)
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="break-all rounded-md border p-2">{shareUrl}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="min-h-11" onClick={() => void navigator.clipboard.writeText(shareUrl)}>
                Copy link
              </Button>
              <a className="inline-flex min-h-11 items-center rounded-md border px-3" href={`https://wa.me/?text=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
              <a className="inline-flex min-h-11 items-center rounded-md border px-3" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noreferrer">
                Facebook
              </a>
              <a className="inline-flex min-h-11 items-center rounded-md border px-3" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noreferrer">
                LinkedIn
              </a>
            </div>
            {course?.enrollment_mode === 'paid' && (
              <a className="inline-flex min-h-11 items-center rounded-md border px-3" href={`/courses/${courseId}`}>
                Sell (Stripe checkout)
              </a>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ThemeForm({
  value,
  onSave,
}: {
  value: any
  onSave: (theme: any) => void
}) {
  const [theme, setTheme] = useState({
    primary: value.primary || '#FFC72C',
    heading: value.heading || '#111111',
    background: value.background || '#ffffff',
    body: value.body || '#3f3f46',
    link: value.link || '#c2410c',
    logoUrl: value.logoUrl || '',
  })
  return (
    <div className="space-y-3">
      {(['primary', 'heading', 'background', 'body', 'link'] as const).map((key) => (
        <div key={key} className="flex items-center justify-between gap-3">
          <Label className="capitalize">{key}</Label>
          <Input
            type="color"
            className="h-11 w-16"
            value={theme[key]}
            onChange={(e) => setTheme({ ...theme, [key]: e.target.value })}
          />
        </div>
      ))}
      <Input
        className="min-h-11"
        placeholder="Logo URL"
        value={theme.logoUrl}
        onChange={(e) => setTheme({ ...theme, logoUrl: e.target.value })}
      />
      <Button type="button" className="min-h-11 w-full bg-bhutan-yellow text-black" onClick={() => onSave(theme)}>
        Save theme
      </Button>
    </div>
  )
}

function TutorForm({
  value,
  onSave,
}: {
  value: any
  onSave: (tutor: any) => void
}) {
  const [tutor, setTutor] = useState({
    name: value.name || 'Course tutor',
    photoUrl: value.photoUrl || '',
    instructions: value.instructions || 'Answer only from this course.',
    enabled: value.enabled !== false,
  })
  return (
    <div className="space-y-3">
      <Input className="min-h-11" value={tutor.name} onChange={(e) => setTutor({ ...tutor, name: e.target.value })} />
      <Input
        className="min-h-11"
        placeholder="Photo URL"
        value={tutor.photoUrl}
        onChange={(e) => setTutor({ ...tutor, photoUrl: e.target.value })}
      />
      <Textarea
        rows={4}
        value={tutor.instructions}
        onChange={(e) => setTutor({ ...tutor, instructions: e.target.value })}
      />
      <Button type="button" className="min-h-11 w-full bg-bhutan-yellow text-black" onClick={() => onSave(tutor)}>
        Save tutor
      </Button>
    </div>
  )
}
