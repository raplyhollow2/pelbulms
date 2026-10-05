// @ts-nocheck — existing Supabase and UI type drift; remove when database types are regenerated.
'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { DescriptionEditor } from '@/components/course/description-editor'
import { createClient } from '@/lib/supabase/client'
import { syncCourseDuration } from '@/lib/video-duration'
import { LessonBlocks } from '@/components/course/lesson-blocks'
import { BlockCatalog } from '@/components/teach/block-picker'
import { LessonResourcesEditor } from '@/components/teach/lesson-resources-editor'
import { AskRigbuRail } from '@/components/ai/ask-rigbu-rail'
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

const OUTLINE_KEY = 'rigbu:studio-outline-open'
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
  description?: string | null
  /** Omitted on the outline list. Present after the open lesson is loaded. */
  content?: unknown
  resources?: unknown
  order_index: number
  is_published?: boolean | null
  is_free?: boolean | null
}

const OUTLINE_PAGE = 200

/** Outline rows only. Lesson bodies load one at a time so a long course stays responsive. */
async function fetchOutlineLessons(supabase: any, moduleIds: string[]): Promise<LessonRow[]> {
  const rows: LessonRow[] = []
  for (let i = 0; i < moduleIds.length; i += 40) {
    const ids = moduleIds.slice(i, i + 40)
    for (let from = 0; ; from += OUTLINE_PAGE) {
      const { data, error } = await supabase
        .from('lessons')
        .select('id, module_id, title, order_index, is_published, is_free, is_preview')
        .in('module_id', ids)
        .order('order_index')
        .order('id')
        .range(from, from + OUTLINE_PAGE - 1)
      if (error) throw error
      const batch = (data || []) as LessonRow[]
      rows.push(...batch)
      if (batch.length < OUTLINE_PAGE) break
    }
  }
  return rows
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
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [publishing, setPublishing] = useState(false)
  const [publishWarn, setPublishWarn] = useState(false)
  const [unpublishConfirm, setUnpublishConfirm] = useState(false)
  const [moduleOptionsId, setModuleOptionsId] = useState<string | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [lessonQuery, setLessonQuery] = useState('')
  const [foldedSections, setFoldedSections] = useState<Set<string>>(() => new Set())
  const [denied, setDenied] = useState(false)
  const [outlineError, setOutlineError] = useState('')
  const detailToken = useRef(0)
  const outlineOpen = useSyncExternalStore(subscribeOutline, readOutlineOpen, getServerOutlineOpen)
  const titleRef = useRef<HTMLInputElement>(null)
  const focusTitle = useRef(false)
  const outlineScrollRef = useRef<HTMLDivElement>(null)
  const lessonRowRefs = useRef(new Map<string, HTMLDivElement>())

  const current = lessons.find((l) => l.id === lessonId)

  const hydrateLesson = async (id: string) => {
    const token = ++detailToken.current
    const { data, error } = await (supabase as any)
      .from('lessons')
      .select('description, content, resources')
      .eq('id', id)
      .maybeSingle()
    if (token !== detailToken.current) return
    if (error || !data) return
    setLessons((rows) => rows.map((row) => (row.id === id ? { ...row, ...data } : row)))
    setBlocks(parseLessonBlocks(data.content))
  }

  const load = async () => {
    setLoading(true)
    setDenied(false)
    const capsRes = await fetch('/api/admin/capabilities/me')
    const caps = await capsRes.json().catch(() => ({}))
    if (capsRes.ok && caps.role === 'admin' && caps.allInstitutions === false) {
      const orgIds = new Set<string>(Array.isArray(caps.institutionIds) ? caps.institutionIds : [])
      const { data: links } = await supabase
        .from('course_institutions')
        .select('institution_id')
        .eq('course_id', courseId)
      const linked = (links || []).some(
        (row: { institution_id?: string }) => row.institution_id && orgIds.has(row.institution_id)
      )
      if (!linked) {
        setDenied(true)
        setLoading(false)
        return
      }
    }
    const { data: courseRow } = await supabase.from('courses').select('*').eq('id', courseId).single()
    const { data: moduleRows } = await supabase
      .from('modules')
      .select('id, title, order_index')
      .eq('course_id', courseId)
      .order('order_index')
    const moduleIds = (moduleRows || []).map((m: any) => m.id)
    let lessonRows: LessonRow[] = []
    setOutlineError('')
    if (moduleIds.length) {
      try {
        lessonRows = await fetchOutlineLessons(supabase, moduleIds)
      } catch {
        setOutlineError('The lesson list could not be loaded. Refresh and try again.')
      }
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
    setBlocks([])
    setLoading(false)
    if (activeId) void hydrateLesson(activeId)
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
        setMobileTab('page')
        document.getElementById('lesson-activities')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
    const row = lessonRowRefs.current.get(lessonId)
    const scroller = outlineScrollRef.current
    if (!row || !scroller) return
    const rowRect = row.getBoundingClientRect()
    const scrollRect = scroller.getBoundingClientRect()
    if (rowRect.top < scrollRect.top) {
      scroller.scrollTop -= scrollRect.top - rowRect.top
    } else if (rowRect.bottom > scrollRect.bottom) {
      scroller.scrollTop += rowRect.bottom - scrollRect.bottom
    }
  }, [lessonId, outlineOpen, lessons.length])

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

  const blocksRef = useRef<LessonBlock[]>([])
  const lessonIdRef = useRef(lessonId)
  const saveQueue = useRef(Promise.resolve())
  blocksRef.current = blocks
  lessonIdRef.current = lessonId

  const saveBlocks = (nextOrUpdater: LessonBlock[] | ((current: LessonBlock[]) => LessonBlock[])) => {
    const id = lessonIdRef.current
    if (!id) return
    const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(blocksRef.current) : nextOrUpdater
    blocksRef.current = next
    setBlocks(next)
    setLessons((rows) => rows.map((row) => (row.id === id ? { ...row, content: next } : row)))
    const snapshot = next
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(async () => {
        setSaveState('saving')
        await (supabase as any)
          .from('lessons')
          .update({ content: snapshot, updated_at: new Date().toISOString() })
          .eq('id', id)
        setSaveState('saved')
      })
  }

  const saveResources = async (next: unknown) => {
    const id = lessonId
    if (!id) return
    setLessons((rows) => rows.map((row) => (row.id === id ? { ...row, resources: next } : row)))
    setSaveState('saving')
    await (supabase as any)
      .from('lessons')
      .update({ resources: next, updated_at: new Date().toISOString() })
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
    let hasContent = lessons.some((lesson) =>
      lesson.id === lessonId ? blocks.length > 0 : parseLessonBlocks(lesson.content).length > 0
    )
    if (next && !hasContent && modules.length > 0) {
      const moduleIds = modules.map((mod) => mod.id)
      for (let i = 0; i < moduleIds.length && !hasContent; i += 40) {
        const { data } = await supabase
          .from('lessons')
          .select('content')
          .in('module_id', moduleIds.slice(i, i + 40))
        hasContent = (data || []).some((row: { content?: unknown }) => parseLessonBlocks(row.content).length > 0)
      }
    }
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
        description: '',
        content: [],
        order_index: existing.length,
        is_published: false,
        is_free: false,
        is_preview: false,
        duration_minutes: 10,
        resources: [],
      })
        .select('id, module_id, title, description, content, resources, order_index, is_published, is_free, is_preview')
      .single()
    if (data) {
      setLessons((rows) => [...rows, data])
      setLessonId(data.id)
      setBlocks([])
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

  const commitLessonDescription = async (id: string, description: string) => {
    setLessons((rows) => rows.map((row) => (row.id === id ? { ...row, description } : row)))
    setSaveState('saving')
    await (supabase as any)
      .from('lessons')
      .update({ description, updated_at: new Date().toISOString() })
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
    setMobileTab('page')
    const row = source.find((item) => item.id === id)
    if (row && row.content !== undefined) {
      detailToken.current += 1
      setBlocks(parseLessonBlocks(row.content))
      return
    }
    setBlocks([])
    void hydrateLesson(id)
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

  const openAskRigbu = () => {
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
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (denied) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-sm text-muted-foreground">
        This course is outside the organizations you manage.
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
      {outlineError ? <p className="px-1 text-sm text-destructive">{outlineError}</p> : null}
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
              <Textarea
                value={mod.title}
                aria-label="Section title"
                rows={1}
                ref={(node) => {
                  if (!node) return
                  node.style.height = 'auto'
                  node.style.height = `${node.scrollHeight}px`
                }}
                className="min-h-8 min-w-0 flex-1 resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-1 py-1 text-xs font-semibold leading-snug tracking-wide shadow-none outline-none focus-visible:border-input"
                onChange={(e) => {
                  const node = e.target
                  node.style.height = 'auto'
                  node.style.height = `${node.scrollHeight}px`
                  setModules((rows) => rows.map((row) => (row.id === mod.id ? { ...row, title: node.value } : row)))
                }}
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
                    <Button
                      type="button"
                      onClick={() => selectLesson(les.id)}
                      className={`flex min-h-11 flex-1 items-start gap-2 rounded-lg px-2 py-2 text-left text-sm ${
                        les.id === lessonId ? 'bg-primary/20 font-medium' : 'hover:bg-muted'
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`mt-1.5 size-2 shrink-0 rounded-full ${
                          hasContent ? 'bg-primary' : 'border border-muted-foreground/50'
                        }`}
                      />
                      <span className="sr-only">{hasContent ? 'Has content' : 'Empty'}</span>
                      <span className="min-w-0 flex-1 whitespace-normal break-words">
                        {les.title}
                        {les.is_published !== true ? (
                          <span className="ml-1 text-xs font-normal text-muted-foreground">Draft</span>
                        ) : null}
                        {les.is_free === true || (les as { is_preview?: boolean }).is_preview === true ? (
                          <span className="ml-1 text-xs font-normal text-muted-foreground">Preview</span>
                        ) : null}
                      </span>
                    </Button>
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
          {saveState !== 'idle' && (
            <p className="text-xs text-muted-foreground">{saveState === 'saving' ? 'Saving…' : 'Saved'}</p>
          )}
        </div>
      </div>
      {current && current.content === undefined ? (
        <div className="flex min-h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : current ? (
        <div className="space-y-8">
          <div>
            <Label htmlFor={`studio-lesson-description-${current.id}`}>Lesson learning outcome</Label>
            <p className="mb-2 text-sm text-muted-foreground">
              Students read this as the lesson learning outcome on the Resources tab, under the module learning objectives.
            </p>
            <DescriptionEditor
              key={current.id}
              id={`studio-lesson-description-${current.id}`}
              value={current.description || ''}
              placeholder="What students should be able to do after this lesson"
              ariaLabel="Lesson learning outcome"
              onChange={(description) =>
                setLessons((rows) =>
                  rows.map((row) => (row.id === current.id ? { ...row, description } : row))
                )
              }
              onCommit={(description) => void commitLessonDescription(current.id, description)}
            />
          </div>
          <LessonBlocks
            content={blocks}
            lessonId={lessonId || undefined}
            courseId={courseId}
            editable
            onChange={(next) => saveBlocks(next)}
            onAskRigbu={openAskRigbu}
            onOpenLessonOptions={() =>
              document.getElementById('lesson-activities')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          />
          <div id="lesson-settings">
            <LessonOptionsPanel
              courseId={courseId}
              lessonId={current.id}
              hideIdentity
              pageItems={
                <div className="space-y-6 rounded-lg border p-4">
                  <BlockCatalog
                    onPick={(block) => {
                      const scroller = document.getElementById('studio-canvas')
                      const top = scroller?.scrollTop ?? 0
                      saveBlocks((current) => [...current, block])
                      const pin = () => {
                        if (scroller) scroller.scrollTop = top
                      }
                      queueMicrotask(pin)
                      requestAnimationFrame(() => {
                        pin()
                        requestAnimationFrame(pin)
                      })
                    }}
                  />
                  <div className="border-t pt-4">
                    <LessonResourcesEditor
                      courseId={courseId}
                      lessonId={current.id}
                      resources={Array.isArray(current.resources) ? current.resources : []}
                      onChange={(next) => void saveResources(next)}
                    />
                  </div>
                </div>
              }
              onTitleChange={(title) =>
                setLessons((rows) => rows.map((row) => (row.id === current.id ? { ...row, title } : row)))
              }
              onDescriptionChange={(description) =>
                setLessons((rows) => rows.map((row) => (row.id === current.id ? { ...row, description } : row)))
              }
              onVisibilityChange={(patch) =>
                setLessons((rows) =>
                  rows.map((row) => (row.id === current.id ? { ...row, ...patch } : row))
                )
              }
            />
          </div>
        </div>
      ) : null}
    </div>
  )

  const renderRail = () => (
    <AskRigbuRail
      courseId={courseId}
      lessonId={lessonId || undefined}
      onApplied={(next) => {
        if (Array.isArray(next)) void saveBlocks(next as LessonBlock[])
      }}
      onStructureApplied={() => void load()}
    />
  )

  return (
    <div className="fixed inset-0 z-20 flex flex-col overflow-hidden bg-background">
      <header className="flex flex-wrap items-center gap-2 border-b-2 border-foreground/25 px-4 py-3">
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
              className={course?.is_published ? 'border-primary bg-primary/20' : undefined}
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
          aria-label="Ask Rigbu"
          onClick={openAskRigbu}
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
          className="min-h-11 bg-primary text-primary-foreground hover:bg-primary"
          disabled={publishing}
          onClick={() => void togglePublish()}
        >
          {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {course?.is_published ? 'Unpublish' : 'Publish'}
        </Button>
      </header>

      <div className="flex gap-2 border-b-2 border-foreground/25 px-4 py-2 lg:hidden">
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

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          className={`min-h-0 shrink-0 flex-col overflow-hidden border-r-2 border-foreground/25 transition-[width] duration-200 ${
            mobileTab === 'outline' ? 'flex w-full' : 'hidden'
          } lg:flex ${outlineOpen ? 'lg:w-80' : 'lg:w-0 lg:border-transparent'}`}
        >
          <div ref={outlineScrollRef} className="min-h-0 w-full flex-1 overflow-y-auto overscroll-contain p-3">
            {outline}
          </div>
        </aside>
        <main
          id="studio-canvas"
          className={`min-h-0 min-w-0 flex-1 overflow-y-auto p-4 [overflow-anchor:none] ${mobileTab === 'page' ? 'block' : 'hidden'} lg:block`}
        >{canvas}</main>
        {mobileTab === 'ai' ? (
          <aside className="w-full overflow-y-auto border-l-2 border-foreground/25 p-3 lg:hidden">{renderRail()}</aside>
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
            <SheetTitle>Ask Rigbu</SheetTitle>
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
              className="bg-primary text-primary-foreground hover:bg-primary"
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
              className="bg-primary text-primary-foreground hover:bg-primary"
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
