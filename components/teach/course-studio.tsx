'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { syncCourseDuration } from '@/lib/video-duration'
import { LessonBlocks } from '@/components/course/lesson-blocks'
import { BlockCatalog } from '@/components/teach/block-picker'
import { AskPelbuRail } from '@/components/ai/ask-pelbu-rail'
import { parseLessonBlocks, type LessonBlock } from '@/lib/lesson-blocks'
import {
  Plus,
  Eye,
  Loader2,
  Settings,
  MoreHorizontal,
  Trash2,
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  PanelLeft,
  Search,
  Sparkles,
} from 'lucide-react'
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
import { LessonOptionsPanel } from '@/components/teach/lesson-options-panel'
import { ModuleOptionsPanel } from '@/components/teach/module-options-panel'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const OUTLINE_KEY = 'pelbu:studio-outline-open'
const outlineListeners = new Set<() => void>()

function subscribeOutline(onStoreChange: () => void) {
  outlineListeners.add(onStoreChange)
  return () => outlineListeners.delete(onStoreChange)
}

function readOutlineOpen() {
  try {
    return localStorage.getItem(OUTLINE_KEY) !== 'false'
  } catch {
    return true
  }
}

function getServerOutlineOpen() {
  return true
}

function writeOutlineOpen(open: boolean) {
  localStorage.setItem(OUTLINE_KEY, open ? 'true' : 'false')
  outlineListeners.forEach((listener) => listener())
}

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
  const [mobileTab, setMobileTab] = useState<'outline' | 'page' | 'ai'>('page')
  const [lessonPane, setLessonPane] = useState<'content' | 'resources'>('content')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [publishing, setPublishing] = useState(false)
  const [publishWarn, setPublishWarn] = useState(false)
  const [unpublishConfirm, setUnpublishConfirm] = useState(false)
  const [moduleOptionsId, setModuleOptionsId] = useState<string | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [lessonQuery, setLessonQuery] = useState('')
  const [foldedSections, setFoldedSections] = useState<Set<string>>(() => new Set())
  const outlineOpen = useSyncExternalStore(subscribeOutline, readOutlineOpen, getServerOutlineOpen)
  const titleRef = useRef<HTMLInputElement>(null)
  const focusTitle = useRef(false)
  const outlineScrollRef = useRef<HTMLDivElement>(null)
  const lessonRowRefs = useRef(new Map<string, HTMLDivElement>())

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
    let activeId = first || null
    setLessonId((prev) => {
      activeId = prev && lessonRows.some((row) => row.id === prev) ? prev : first || null
      return activeId
    })
    setBlocks(parseLessonBlocks(lessonRows.find((row) => row.id === activeId)?.content))
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
        setLessonPane('resources')
        setMobileTab('page')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!focusTitle.current) return
    focusTitle.current = false
    titleRef.current?.focus()
    titleRef.current?.select()
  }, [lessonId])

  useEffect(() => {
    if (!lessonId) return
    lessonRowRefs.current.get(lessonId)?.scrollIntoView({ block: 'nearest' })
  }, [lessonId, outlineOpen])

  const toggleOutline = (next?: boolean) => {
    writeOutlineOpen(typeof next === 'boolean' ? next : !readOutlineOpen())
  }

  const toggleSection = (moduleId: string) => {
    setFoldedSections((current) => {
      const next = new Set(current)
      if (next.has(moduleId)) next.delete(moduleId)
      else next.add(moduleId)
      return next
    })
  }

  const saveBlocks = async (next: LessonBlock[]) => {
    const id = lessonId
    if (!id) return
    setBlocks(next)
    setLessons((rows) => rows.map((row) => (row.id === id ? { ...row, content: next } : row)))
    setSaveState('saving')
    await (supabase as any)
      .from('lessons')
      .update({ content: next, updated_at: new Date().toISOString() })
      .eq('id', id)
    setSaveState('saved')
  }

  const addModule = async () => {
    const { data } = await (supabase as any)
      .from('modules')
      .insert({
        course_id: courseId,
        title: 'New section',
        description: '',
        order_index: modules.length,
        is_published: false,
      })
      .select('id, title, order_index')
      .single()
    if (data) setModules((rows) => [...rows, data])
  }

  const commitModuleTitle = async (moduleId: string, title: string) => {
    const next = title.trim() || 'Untitled section'
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
    if (!window.confirm('Delete this section and its lessons?')) return
    const { error: lessonError } = await (supabase as any).from('lessons').delete().eq('module_id', moduleId)
    if (lessonError) return
    void syncCourseDuration(courseId)
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
    if (lessonId && remainingLessons.every((row) => row.id !== lessonId)) {
      setLessonId(remainingLessons[0]?.id || null)
    }
  }

  const commitPublish = async (next: boolean) => {
    setPublishWarn(false)
    setUnpublishConfirm(false)
    setPublishing(true)
    setCourse((row: any) => (row ? { ...row, is_published: next } : row))
    await (supabase as any)
      .from('courses')
      .update({ is_published: next, updated_at: new Date().toISOString() })
      .eq('id', courseId)
    setPublishing(false)
  }

  const togglePublish = async () => {
    const next = !course?.is_published
    if (!next) {
      setUnpublishConfirm(true)
      return
    }
    const hasContent = lessons.some((lesson) =>
      lesson.id === lessonId ? blocks.length > 0 : parseLessonBlocks(lesson.content).length > 0
    )
    if (next && !hasContent) {
      setPublishWarn(true)
      return
    }
    await commitPublish(next)
  }

  const addPage = async (moduleId: string) => {
    const existing = lessonsByModule.get(moduleId) || []
    const { data } = await (supabase as any)
      .from('lessons')
      .insert({
        module_id: moduleId,
        title: 'New lesson',
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
      setLessonPane('resources')
      setMobileTab('page')
    }
  }

  const commitLessonTitle = async (id: string, title: string) => {
    const next = title.trim() || 'Untitled lesson'
    setLessons((rows) => rows.map((row) => (row.id === id ? { ...row, title: next } : row)))
    setSaveState('saving')
    await (supabase as any)
      .from('lessons')
      .update({ title: next, updated_at: new Date().toISOString() })
      .eq('id', id)
    setSaveState('saved')
  }

  const moveLesson = async (moduleId: string, index: number, direction: -1 | 1) => {
    const list = [...(lessonsByModule.get(moduleId) || [])]
    const target = index + direction
    if (target < 0 || target >= list.length) return
    const next = [...list]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    const ordered = next.map((row, order_index) => ({ ...row, order_index }))
    setLessons((rows) => rows.map((row) => ordered.find((item) => item.id === row.id) || row))
    await Promise.all(
      ordered.map((row) =>
        (supabase as any)
          .from('lessons')
          .update({ order_index: row.order_index, updated_at: new Date().toISOString() })
          .eq('id', row.id)
      )
    )
  }

  const deleteLesson = async (moduleId: string, id: string) => {
    if (!window.confirm('Delete this lesson?')) return
    const { error } = await (supabase as any).from('lessons').delete().eq('id', id)
    if (error) return
    const remaining = lessons.filter((row) => row.id !== id)
    const ordered = remaining
      .filter((row) => row.module_id === moduleId)
      .map((row, order_index) => ({ ...row, order_index }))
    setLessons(remaining.map((row) => ordered.find((item) => item.id === row.id) || row))
    await Promise.all(
      ordered.map((row) =>
        (supabase as any)
          .from('lessons')
          .update({ order_index: row.order_index, updated_at: new Date().toISOString() })
          .eq('id', row.id)
      )
    )
    void syncCourseDuration(courseId)
    if (lessonId === id) {
      const nextRows = remaining.map((row) => ordered.find((item) => item.id === row.id) || row)
      const fallback = ordered[0]?.id || nextRows[0]?.id || null
      if (fallback) selectLesson(fallback, nextRows)
      else {
        setLessonId(null)
        setBlocks([])
      }
    }
  }

  const selectLesson = (id: string, source: LessonRow[] = lessons) => {
    setLessonId(id)
    setLessonPane('content')
    setMobileTab('page')
    const row = source.find((item) => item.id === id)
    setBlocks(row ? parseLessonBlocks(row.content) : [])
  }

  const renameLesson = (id: string) => {
    setMobileTab('page')
    if (id !== lessonId) {
      focusTitle.current = true
      selectLesson(id)
      return
    }
    titleRef.current?.focus()
    titleRef.current?.select()
  }

  const openAskPelbu = () => {
    if (window.matchMedia('(min-width: 1024px)').matches) setAiOpen(true)
    else setMobileTab('ai')
  }

  const lessonsByModule = new Map<string, LessonRow[]>()
  for (const les of lessons) {
    const list = lessonsByModule.get(les.module_id) || []
    list.push(les)
    lessonsByModule.set(les.module_id, list)
  }
  for (const list of lessonsByModule.values()) list.sort((a, b) => a.order_index - b.order_index)
  const previewLessonId =
    lessonId || modules.flatMap((mod) => lessonsByModule.get(mod.id) || [])[0]?.id || null

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-bhutan-yellow" />
      </div>
    )
  }

  const lessonQueryText = lessonQuery.trim().toLowerCase()

  const outline = (
    <nav className="space-y-4">
      <div className="flex items-center gap-1">
        <p className="min-w-0 flex-1 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Curriculum
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="hidden lg:inline-flex"
          aria-label="Hide curriculum"
          onClick={() => toggleOutline(false)}
        >
          <ChevronLeft />
        </Button>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={lessonQuery}
          onChange={(e) => setLessonQuery(e.target.value)}
          placeholder="Find a lesson"
          aria-label="Find a lesson"
          className="min-h-11 pl-8"
        />
      </div>
      {modules.length === 0 && (
        <p className="px-1 text-sm text-muted-foreground">Add a section to start the outline.</p>
      )}
      {modules.map((mod, index) => {
        const sectionLessons = lessonsByModule.get(mod.id) || []
        const visibleLessons = lessonQueryText
          ? sectionLessons.filter((les) => les.title.toLowerCase().includes(lessonQueryText))
          : sectionLessons
        if (lessonQueryText && visibleLessons.length === 0) return null
        const containsSelection = sectionLessons.some((les) => les.id === lessonId)
        const sectionOpen = Boolean(lessonQueryText) || containsSelection || !foldedSections.has(mod.id)
        return (
          <div key={mod.id}>
            <div className="flex items-start gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="mt-0.5 shrink-0"
                aria-expanded={sectionOpen}
                aria-label={sectionOpen ? 'Fold section' : 'Unfold section'}
                onClick={() => {
                  if (containsSelection || lessonQueryText) return
                  toggleSection(mod.id)
                }}
              >
                {sectionOpen ? <ChevronDown /> : <ChevronRight />}
              </Button>
              <textarea
                value={mod.title}
                aria-label="Section title"
                rows={1}
                className="field-sizing-content max-h-12 min-h-8 min-w-0 flex-1 resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-1 py-1 text-xs font-semibold leading-snug tracking-wide shadow-none outline-none focus-visible:border-input"
                onChange={(e) =>
                  setModules((rows) => rows.map((row) => (row.id === mod.id ? { ...row, title: e.target.value } : row)))
                }
                onBlur={() => void commitModuleTitle(mod.id, mod.title)}
              />
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md hover:bg-muted">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Section actions</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem disabled={index === 0} onClick={() => void moveModule(index, -1)}>
                    Move up
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={index === modules.length - 1} onClick={() => void moveModule(index, 1)}>
                    Move down
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setModuleOptionsId(mod.id)}>Section options</DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => void deleteModule(mod.id)}>
                    <Trash2 /> Delete section
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {sectionOpen ? (
            <div className="mt-1 space-y-1 pl-1">
              {visibleLessons.map((les) => {
                const lessonIndex = sectionLessons.findIndex((row) => row.id === les.id)
                const hasContent = parseLessonBlocks(les.content).length > 0
                return (
                  <div
                    key={les.id}
                    ref={(node) => {
                      if (node) lessonRowRefs.current.set(les.id, node)
                      else lessonRowRefs.current.delete(les.id)
                    }}
                    className="flex items-start gap-1"
                  >
                    <button
                      type="button"
                      onClick={() => selectLesson(les.id)}
                      className={`flex min-h-11 flex-1 items-start gap-2 rounded-lg px-2 py-2 text-left text-sm ${
                        les.id === lessonId ? 'bg-bhutan-yellow/20 font-medium' : 'hover:bg-muted'
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`mt-1.5 size-2 shrink-0 rounded-full ${
                          hasContent ? 'bg-bhutan-yellow' : 'border border-muted-foreground/50'
                        }`}
                      />
                      <span className="sr-only">{hasContent ? 'Has content' : 'Empty'}</span>
                      <span className="line-clamp-2 min-w-0 flex-1 whitespace-normal break-words">{les.title}</span>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md hover:bg-muted">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Lesson actions</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => renameLesson(les.id)}>Rename</DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={lessonIndex === 0}
                          onClick={() => void moveLesson(mod.id, lessonIndex, -1)}
                        >
                          Move up
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={lessonIndex === sectionLessons.length - 1}
                          onClick={() => void moveLesson(mod.id, lessonIndex, 1)}
                        >
                          Move down
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => void deleteLesson(mod.id, les.id)}>
                          <Trash2 /> Delete lesson
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )
              })}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11 w-full justify-start"
                onClick={() => void addPage(mod.id)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add lesson
              </Button>
            </div>
            ) : null}
          </div>
        )
      })}
      {lessonQueryText &&
      modules.every((mod) => {
        const sectionLessons = lessonsByModule.get(mod.id) || []
        return !sectionLessons.some((les) => les.title.toLowerCase().includes(lessonQueryText))
      }) ? (
        <p className="px-1 text-sm text-muted-foreground">No lessons match.</p>
      ) : null}
      <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => void addModule()}>
        <Plus className="mr-2 h-4 w-4" />
        Add section
      </Button>
    </nav>
  )

  const canvas = (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        {current ? (
          <Input
            ref={titleRef}
            value={current.title}
            aria-label="Lesson title"
            className="h-auto min-h-11 flex-1 border-transparent bg-transparent px-0 text-2xl font-semibold shadow-none focus-visible:border-input"
            onChange={(e) =>
              setLessons((rows) => rows.map((row) => (row.id === current.id ? { ...row, title: e.target.value } : row)))
            }
            onBlur={() => void commitLessonTitle(current.id, current.title)}
          />
        ) : (
          <h2 className="text-lg font-semibold">
            {modules.length ? 'Select a lesson' : 'Add a section to start'}
          </h2>
        )}
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 pt-1">
          {current && (
            <div className="flex rounded-md border p-0.5" role="tablist" aria-label="Lesson">
              {(
                [
                  ['content', 'Content'],
                  ['resources', 'Resources'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={lessonPane === id}
                  className={`min-h-11 rounded-md px-3 text-sm ${
                    lessonPane === id ? 'bg-bhutan-yellow font-medium text-black' : 'text-muted-foreground'
                  }`}
                  onClick={() => setLessonPane(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {saveState !== 'idle' && (
            <p className="text-xs text-muted-foreground">{saveState === 'saving' ? 'Saving…' : 'Saved'}</p>
          )}
        </div>
      </div>
      {current && lessonPane === 'resources' ? (
        <div className="space-y-8">
          <BlockCatalog
            onPick={(block) => {
              void saveBlocks([...blocks, block])
              setLessonPane('content')
            }}
          />
          <LessonOptionsPanel
            courseId={courseId}
            lessonId={current.id}
            onTitleChange={(title) =>
              setLessons((rows) => rows.map((row) => (row.id === current.id ? { ...row, title } : row)))
            }
          />
        </div>
      ) : current ? (
        <LessonBlocks
          content={blocks}
          lessonId={lessonId || undefined}
          editable
          onChange={(next) => void saveBlocks(next)}
          onAddBlock={(block) => void saveBlocks([...blocks, block])}
          onAskPelbu={openAskPelbu}
          onOpenLessonOptions={() => setLessonPane('resources')}
        />
      ) : null}
    </div>
  )

  const renderRail = () => (
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
    <div className="flex h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 shrink-0"
            aria-label="Back to teacher dashboard"
            render={<Link href="/teach/dashboard" />}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden min-h-11 min-w-11 shrink-0 lg:inline-flex"
            aria-label={outlineOpen ? 'Hide curriculum' : 'Show curriculum'}
            aria-expanded={outlineOpen}
            onClick={() => toggleOutline()}
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-semibold">{course?.title}</p>
            <Badge
              variant="outline"
              className={course?.is_published ? 'border-bhutan-yellow bg-bhutan-yellow/20' : undefined}
            >
              {course?.is_published ? 'Published' : 'Draft'}
            </Badge>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          render={<Link href={`/teach/courses/${courseId}/edit`} />}
        >
          <Settings className="mr-2 h-4 w-4" /> Settings
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="min-h-11 min-w-11"
          aria-label="Ask Pelbu"
          onClick={openAskPelbu}
        >
          <Sparkles className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={!previewLessonId}
          onClick={() => {
            if (!previewLessonId) return
            window.location.assign(
              `/learn/${courseId}/lesson/${previewLessonId}?preview=1`
            )
          }}
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
        {(
          [
            { id: 'outline', label: 'Outline' },
            { id: 'page', label: 'Lesson' },
            { id: 'ai', label: 'AI' },
          ] as const
        ).map((tab) => (
          <Button
            key={tab.id}
            type="button"
            variant={mobileTab === tab.id ? 'default' : 'outline'}
            className="min-h-11"
            onClick={() => setMobileTab(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        <aside
          className={`min-h-0 shrink-0 overflow-hidden border-r transition-[width] duration-200 ${
            mobileTab === 'outline' ? 'block w-full' : 'hidden'
          } lg:block ${outlineOpen ? 'lg:w-80' : 'lg:w-0 lg:border-transparent'}`}
        >
          <div ref={outlineScrollRef} className="h-full overflow-y-auto p-3 lg:w-80">
            {outline}
          </div>
        </aside>
        <main className={`min-w-0 flex-1 overflow-y-auto p-4 ${mobileTab === 'page' ? 'block' : 'hidden'} lg:block`}>{canvas}</main>
        {mobileTab === 'ai' ? (
          <aside className="w-full overflow-y-auto border-l p-3 lg:hidden">{renderRail()}</aside>
        ) : null}
      </div>

      <Sheet open={!!moduleOptionsId} onOpenChange={(next) => !next && setModuleOptionsId(null)}>
        <SheetContent className="w-full overflow-y-auto data-[side=right]:sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Section options</SheetTitle>
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

      <Sheet open={aiOpen} onOpenChange={setAiOpen}>
        <SheetContent className="w-full overflow-y-auto data-[side=right]:sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Ask Pelbu</SheetTitle>
            <SheetDescription>Rewrite this lesson or adjust the course structure.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">{aiOpen ? renderRail() : null}</div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={unpublishConfirm} onOpenChange={setUnpublishConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unpublish this course?</AlertDialogTitle>
            <AlertDialogDescription>
              Enrolled learners will lose access until you publish it again. Their enrollment is kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-bhutan-yellow text-black hover:bg-bhutan-orange"
              onClick={(event) => {
                event.preventDefault()
                void commitPublish(false)
              }}
            >
              Unpublish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={publishWarn} onOpenChange={setPublishWarn}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish without lesson content?</AlertDialogTitle>
            <AlertDialogDescription>
              This course has no lesson content yet. Learners will see an empty course until you add blocks to a lesson.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-bhutan-yellow text-black hover:bg-bhutan-orange"
              onClick={(event) => {
                event.preventDefault()
                void commitPublish(true)
              }}
            >
              Publish anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}
