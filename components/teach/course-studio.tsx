// @ts-nocheck — existing Supabase and UI type drift; remove when database types are regenerated.
'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
  Settings,
  MoreHorizontal,
  Trash2,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  PanelLeft,
  Search,
  Sparkles,
  CircleAlert,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Kbd } from '@/components/ui/kbd'
import { Spinner } from '@/components/ui/spinner'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Item, ItemContent, ItemMedia, ItemTitle } from '@/components/ui/item'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { toast } from 'sonner'
import { formatMailCount, type MailCount } from '@/lib/email/request-lesson-status-email'
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
  const [mobileTab, setMobileTab] = useState<'outline' | 'page' | 'add'>('page')
  const [pendingDelete, setPendingDelete] = useState<
    { kind: 'module'; id: string } | { kind: 'lesson'; moduleId: string; id: string } | null
  >(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [publishing, setPublishing] = useState(false)
  const [publishWarn, setPublishWarn] = useState(false)
  const [unpublishConfirm, setUnpublishConfirm] = useState(false)
  const [publishMailNote, setPublishMailNote] = useState('')
  const [moduleOptionsId, setModuleOptionsId] = useState<string | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [lessonQuery, setLessonQuery] = useState('')
  const [foldedSections, setFoldedSections] = useState<Set<string>>(() => new Set())
  const [denied, setDenied] = useState(false)
  const [wide, setWide] = useState<boolean | null>(null)
  const [outlineError, setOutlineError] = useState('')
  const detailToken = useRef(0)
  const blocksRef = useRef<LessonBlock[]>([])
  const lessonIdRef = useRef<string | null>(lessonId)
  const saveQueue = useRef(Promise.resolve())
  const contentRevision = useRef(0)
  const resourceRevision = useRef(0)
  lessonIdRef.current = lessonId
  const outlineOpen = useSyncExternalStore(subscribeOutline, readOutlineOpen, getServerOutlineOpen)
  const titleRef = useRef<HTMLInputElement>(null)
  const focusTitle = useRef(false)
  const outlineScrollRef = useRef<HTMLDivElement>(null)
  const lessonRowRefs = useRef(new Map<string, HTMLDivElement>())

  const current = lessons.find((l) => l.id === lessonId)

  const hydrateLesson = async (id: string) => {
    const token = ++detailToken.current
    await saveQueue.current.catch(() => undefined)
    if (token !== detailToken.current) return
    const { data, error } = await (supabase as any)
      .from('lessons')
      .select('description, content, resources')
      .eq('id', id)
      .maybeSingle()
    if (token !== detailToken.current) return
    if (error || !data) return
    const parsed = parseLessonBlocks(data.content)
    setLessons((rows) => rows.map((row) => (row.id === id ? { ...row, ...data } : row)))
    if (lessonIdRef.current === id) {
      blocksRef.current = parsed
      setBlocks(parsed)
    }
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
    blocksRef.current = []
    setBlocks([])
    setLoading(false)
    if (activeId) void hydrateLesson(activeId)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)')
    const apply = () => setWide(query.matches)
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if (e.key === '/') {
        e.preventDefault()
        if (window.matchMedia('(min-width: 1024px)').matches) {
          document.getElementById('studio-block-search')?.focus()
        } else {
          setMobileTab('add')
          queueMicrotask(() => document.getElementById('studio-block-search-mobile')?.focus())
        }
      }
      if (e.key === '[') {
        e.preventDefault()
        writeOutlineOpen(!readOutlineOpen())
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
    const scroller = outlineScrollRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement | null
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

  const saveBlocks = (nextOrUpdater: LessonBlock[] | ((current: LessonBlock[]) => LessonBlock[])) => {
    const id = lessonIdRef.current
    if (!id) return
    const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(blocksRef.current) : nextOrUpdater
    if (JSON.stringify(next) === JSON.stringify(blocksRef.current)) return
    const revision = ++contentRevision.current
    detailToken.current += 1
    blocksRef.current = next
    setBlocks(next)
    setLessons((rows) => rows.map((row) => (row.id === id ? { ...row, content: next } : row)))
    const snapshot = next
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(async () => {
        if (revision !== contentRevision.current) return
        setSaveState('saving')
        const { data, error } = await (supabase as any)
          .from('lessons')
          .update({ content: snapshot, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select('id')
        if (revision !== contentRevision.current) return
        if (error || !data?.length) {
          setSaveState('error')
          return
        }
        setSaveState('saved')
      })
  }

  const saveResources = async (next: unknown) => {
    const id = lessonIdRef.current
    if (!id) return
    const revision = ++resourceRevision.current
    detailToken.current += 1
    setLessons((rows) => rows.map((row) => (row.id === id ? { ...row, resources: next } : row)))
    setSaveState('saving')
    const { data, error } = await (supabase as any)
      .from('lessons')
      .update({ resources: next, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
    if (revision !== resourceRevision.current) return
    if (error || !data?.length) {
      setSaveState('error')
      return
    }
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
    const { error } = await (supabase as any)
      .from('courses')
      .update({ is_published: next, updated_at: new Date().toISOString() })
      .eq('id', courseId)
    setPublishing(false)
    if (error || !next) return
    setPublishMailNote('Sending email to enrolled students…')
    try {
      const res = await fetch(`/api/courses/${courseId}/publish-email`, { method: 'POST' })
      const payload = await res.json().catch(() => ({}))
      const note = res.ok ? formatMailCount(payload.mail as MailCount) : payload.error || 'No email was sent.'
      setPublishMailNote(note || 'No email was sent.')
      if (payload.mail?.sent > 0) toast.success(note)
      else toast.message(note || 'No email was sent.')
    } catch {
      setPublishMailNote('No email was sent.')
    }
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
      blocksRef.current = []
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
        blocksRef.current = []
        setBlocks([])
      }
    }
  }

  const selectLesson = (id: string, source: LessonRow[] = lessons) => {
    setLessonId(id)
    setMobileTab('page')
    const row = source.find((item) => item.id === id)
    if (row) {
      setFoldedSections((current) => {
        if (!current.has(row.module_id)) return current
        const next = new Set(current)
        next.delete(row.module_id)
        return next
      })
    }
    if (row && row.content !== undefined) {
      detailToken.current += 1
      const parsed = parseLessonBlocks(row.content)
      blocksRef.current = parsed
      setBlocks(parsed)
      return
    }
    blocksRef.current = []
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
    setAiOpen(true)
  }

  const appendBlock = (block: LessonBlock) => {
    const scroller = document.getElementById('studio-canvas')
    const top = scroller?.scrollTop ?? 0
    saveBlocks((currentBlocks) => [...currentBlocks, block])
    const pin = () => {
      if (scroller) scroller.scrollTop = top
    }
    queueMicrotask(pin)
    requestAnimationFrame(() => {
      pin()
      requestAnimationFrame(pin)
    })
    setMobileTab('page')
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
      <div className="flex h-dvh flex-col bg-background">
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Skeleton className="size-9 rounded-md" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="ml-auto h-9 w-64" />
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="hidden w-80 space-y-3 border-r bg-sidebar p-4 lg:block">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
          <div className="flex-1 space-y-4 bg-muted/40 p-6 md:p-8">
            <Skeleton className="mx-auto h-12 w-full max-w-3xl" />
            <Skeleton className="mx-auto h-28 w-full max-w-3xl" />
            <Skeleton className="mx-auto h-64 w-full max-w-3xl" />
          </div>
          <div className="hidden w-80 border-l bg-sidebar p-4 lg:block">
            <Skeleton className="mb-3 h-4 w-24" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="mt-3 h-11 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (denied) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background p-6">
        <Empty className="max-w-md">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CircleAlert />
            </EmptyMedia>
            <EmptyTitle>Course unavailable</EmptyTitle>
            <EmptyDescription>This course is outside the organizations you manage.</EmptyDescription>
          </EmptyHeader>
          <Alert>
            <CircleAlert />
            <AlertTitle>No organization access</AlertTitle>
            <AlertDescription>Ask an administrator to link this course to your organization.</AlertDescription>
          </Alert>
        </Empty>
      </div>
    )
  }

  const lessonQueryText = lessonQuery.trim().toLowerCase()
  const allFolded = modules.length > 0 && modules.every((mod) => foldedSections.has(mod.id))

  const openPreview = () => {
    if (!previewLessonId) return
    window.location.assign(`/learn/${courseId}/lesson/${previewLessonId}?preview=1`)
  }

  const renderOutline = () => (
    <nav className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Curriculum
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={modules.length === 0 || Boolean(lessonQueryText)}
          onClick={() =>
            setFoldedSections(allFolded ? new Set() : new Set(modules.map((mod) => mod.id)))
          }
        >
          {allFolded ? 'Expand all' : 'Collapse all'}
        </Button>
      </div>
      <InputGroup>
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          value={lessonQuery}
          onChange={(e) => setLessonQuery(e.target.value)}
          placeholder="Find a lesson"
          aria-label="Find a lesson"
        />
      </InputGroup>
      {outlineError ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Outline unavailable</AlertTitle>
          <AlertDescription>{outlineError}</AlertDescription>
        </Alert>
      ) : null}
      {modules.length === 0 ? (
        <Empty className="border-0 px-2 py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Plus />
            </EmptyMedia>
            <EmptyTitle>No sections yet</EmptyTitle>
            <EmptyDescription>Add a section to start the outline.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}
      {modules.map((mod, index) => {
        const sectionLessons = lessonsByModule.get(mod.id) || []
        const visibleLessons = lessonQueryText
          ? sectionLessons.filter((les) => les.title.toLowerCase().includes(lessonQueryText))
          : sectionLessons
        if (lessonQueryText && visibleLessons.length === 0) return null
        const sectionOpen = Boolean(lessonQueryText) || !foldedSections.has(mod.id)
        return (
          <Collapsible
            key={mod.id}
            open={sectionOpen}
            onOpenChange={(open) => {
              if (lessonQueryText) return
              setFoldedSections((current) => {
                const next = new Set(current)
                if (open) next.delete(mod.id)
                else next.add(mod.id)
                return next
              })
            }}
          >
            <div className="flex items-start gap-1">
              <CollapsibleTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="mt-0.5 shrink-0"
                    aria-label={sectionOpen ? 'Fold section' : 'Unfold section'}
                  >
                    {sectionOpen ? <ChevronDown /> : <ChevronRight />}
                  </Button>
                }
              />
              <Textarea
                value={mod.title}
                aria-label="Section title"
                rows={1}
                className="min-h-8 min-w-0 flex-1 resize-none border-transparent bg-transparent px-1 py-1 text-xs font-semibold leading-snug shadow-none focus-visible:border-input focus-visible:ring-0"
                onChange={(e) => {
                  const value = e.target.value
                  setModules((rows) => rows.map((row) => (row.id === mod.id ? { ...row, title: value } : row)))
                }}
                onBlur={() => void commitModuleTitle(mod.id, mod.title)}
              />
              <Badge variant="secondary">{sectionLessons.length}</Badge>
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-muted">
                  <MoreHorizontal />
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
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setPendingDelete({ kind: 'module', id: mod.id })}>
                    <Trash2 /> Delete section
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <CollapsibleContent>
              <div className="mt-1 space-y-1 pl-1">
                {visibleLessons.map((les) => {
                  const lessonIndex = sectionLessons.findIndex((row) => row.id === les.id)
                  const hasContent = parseLessonBlocks(les.content).length > 0
                  const isPreview = les.is_free === true || (les as { is_preview?: boolean }).is_preview === true
                  return (
                    <div
                      key={les.id}
                      ref={(node) => {
                        if (node) lessonRowRefs.current.set(les.id, node)
                        else lessonRowRefs.current.delete(les.id)
                      }}
                      className="flex items-start gap-1"
                    >
                      <Item
                        render={<button type="button" />}
                        variant={les.id === lessonId ? 'muted' : 'default'}
                        size="sm"
                        className="min-h-11 min-w-0 flex-1 text-left"
                        onClick={() => selectLesson(les.id)}
                      >
                        <ItemMedia>
                          <span
                            aria-hidden
                            className={`size-2 rounded-full ${
                              hasContent ? 'bg-primary' : 'border border-muted-foreground/50'
                            }`}
                          />
                          <span className="sr-only">{hasContent ? 'Has content' : 'Empty'}</span>
                        </ItemMedia>
                        <ItemContent>
                          <ItemTitle className="line-clamp-none whitespace-normal">{les.title}</ItemTitle>
                        </ItemContent>
                        {les.is_published !== true ? <Badge variant="outline">Draft</Badge> : null}
                        {isPreview ? <Badge variant="secondary">Preview</Badge> : null}
                      </Item>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-muted">
                          <MoreHorizontal />
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
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setPendingDelete({ kind: 'lesson', moduleId: mod.id, id: les.id })}
                          >
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
                  <Plus />
                  Add lesson
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )
      })}
      {lessonQueryText &&
      modules.every((mod) => {
        const sectionLessons = lessonsByModule.get(mod.id) || []
        return !sectionLessons.some((les) => les.title.toLowerCase().includes(lessonQueryText))
      }) ? (
        <Empty className="border-0 px-2 py-8">
          <EmptyHeader>
            <EmptyTitle>No lessons match</EmptyTitle>
            <EmptyDescription>Try a different title.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}
      <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => void addModule()}>
        <Plus />
        Add section
      </Button>
    </nav>
  )

  const renderCanvas = () => (
    <div id="studio-canvas" className="h-full overflow-y-auto bg-muted/40 p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        {!current ? (
          <Empty className="bg-card">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Plus />
              </EmptyMedia>
              <EmptyTitle>{modules.length ? 'Select a lesson' : 'Add a section to start'}</EmptyTitle>
              <EmptyDescription>
                {modules.length
                  ? 'Choose a lesson from the outline, or add one to the first section.'
                  : 'Sections hold the lessons learners move through.'}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {modules.length ? (
                <Button type="button" onClick={() => void addPage(modules[0].id)}>
                  <Plus />
                  Add lesson
                </Button>
              ) : (
                <Button type="button" onClick={() => void addModule()}>
                  <Plus />
                  Add section
                </Button>
              )}
            </EmptyContent>
          </Empty>
        ) : current.content === undefined ? (
          <div className="space-y-4 rounded-xl bg-card p-6 shadow-xs ring-1 ring-foreground/10 md:p-8">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-8 rounded-xl bg-card p-6 shadow-xs ring-1 ring-foreground/10 md:p-8">
            <div className="flex items-start justify-between gap-3">
              <Input
                ref={titleRef}
                value={current.title}
                aria-label="Lesson title"
                className="h-auto min-h-11 flex-1 border-transparent bg-transparent px-0 text-2xl font-semibold shadow-none focus-visible:border-input"
                onChange={(e) =>
                  setLessons((rows) =>
                    rows.map((row) => (row.id === current.id ? { ...row, title: e.target.value } : row))
                  )
                }
                onBlur={() => void commitLessonTitle(current.id, current.title)}
              />
            </div>
            <Field>
              <FieldLabel htmlFor={`studio-lesson-description-${current.id}`}>Lesson learning outcome</FieldLabel>
              <FieldDescription>
                Students read this as the lesson learning outcome on the Resources tab, under the module learning
                objectives.
              </FieldDescription>
              <DescriptionEditor
                key={current.id}
                id={`studio-lesson-description-${current.id}`}
                value={current.description || ''}
                placeholder="What students should be able to do after this lesson"
                ariaLabel="Lesson learning outcome"
                onChange={(description) =>
                  setLessons((rows) => rows.map((row) => (row.id === current.id ? { ...row, description } : row)))
                }
                onCommit={(description) => void commitLessonDescription(current.id, description)}
              />
            </Field>
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
                  <Card>
                    <CardHeader>
                      <CardTitle>Resources</CardTitle>
                      <CardDescription>Files learners can open from this lesson.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <LessonResourcesEditor
                        courseId={courseId}
                        lessonId={current.id}
                        resources={Array.isArray(current.resources) ? current.resources : []}
                        onChange={(next) => void saveResources(next)}
                      />
                    </CardContent>
                  </Card>
                }
                onTitleChange={(title) =>
                  setLessons((rows) => rows.map((row) => (row.id === current.id ? { ...row, title } : row)))
                }
                onDescriptionChange={(description) =>
                  setLessons((rows) => rows.map((row) => (row.id === current.id ? { ...row, description } : row)))
                }
                onVisibilityChange={(patch) =>
                  setLessons((rows) => rows.map((row) => (row.id === current.id ? { ...row, ...patch } : row)))
                }
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )

  const renderCatalog = (searchInputId: string) => (
    <div className="flex h-full min-h-0 flex-col bg-sidebar">
      <div className="flex items-center gap-2 px-4 py-3">
        <p className="text-sm font-medium">Add content</p>
        <Kbd>/</Kbd>
      </div>
      <Separator />
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-3">
          {current ? (
            <BlockCatalog searchInputId={searchInputId} onPick={appendBlock} />
          ) : (
            <Empty className="border-0 px-2 py-8">
              <EmptyHeader>
                <EmptyTitle>Select a lesson</EmptyTitle>
                <EmptyDescription>Add content after you open a lesson.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </ScrollArea>
    </div>
  )

  return (
    <TooltipProvider delay={300}>
      <div className="fixed inset-0 z-20 flex flex-col overflow-hidden bg-background">
        <header className="flex flex-wrap items-center gap-2 bg-background/85 px-3 py-2 backdrop-blur-xl">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Back to teacher dashboard"
                    render={<Link href="/teach/dashboard" />}
                  >
                    <ArrowLeft />
                  </Button>
                }
              />
              <TooltipContent>Teacher dashboard</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="hidden lg:inline-flex"
                    aria-label={outlineOpen ? 'Hide curriculum' : 'Show curriculum'}
                    aria-expanded={outlineOpen}
                    onClick={() => toggleOutline()}
                  >
                    <PanelLeft />
                  </Button>
                }
              />
              <TooltipContent>
                Curriculum <Kbd>[</Kbd>
              </TooltipContent>
            </Tooltip>
            <Breadcrumb className="min-w-0">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink render={<Link href="/teach/dashboard" />}>Teach</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="max-w-[10rem] truncate font-medium sm:max-w-xs">
                    {course?.title || 'Course'}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <Badge variant={course?.is_published ? 'default' : 'outline'}>
              {course?.is_published ? 'Published' : 'Draft'}
            </Badge>
            {saveState === 'saving' ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Spinner /> Saving
              </span>
            ) : null}
            {saveState === 'saved' ? <span className="text-xs text-muted-foreground">Saved</span> : null}
            {saveState === 'error' ? <span className="text-xs text-destructive">Could not save</span> : null}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button type="button" variant="outline" size="icon" aria-label="Ask Rigbu" onClick={openAskRigbu}>
                    <Sparkles />
                  </Button>
                }
              />
              <TooltipContent>Ask Rigbu</TooltipContent>
            </Tooltip>
            <ButtonGroup>
              <Button type="button" variant="outline" render={<Link href={`/teach/courses/${courseId}/edit`} />}>
                <Settings />
                <span className="hidden sm:inline">Settings</span>
              </Button>
              <Button type="button" variant="outline" disabled={!previewLessonId} onClick={openPreview}>
                <Eye />
                <span className="hidden sm:inline">Preview</span>
              </Button>
              <Button type="button" disabled={publishing} onClick={() => void togglePublish()}>
                {publishing ? <Spinner /> : null}
                {course?.is_published ? 'Unpublish' : 'Publish'}
              </Button>
            </ButtonGroup>
          </div>
        </header>
        <Separator />

        <div className="px-3 py-2 lg:hidden">
          <Tabs
            value={mobileTab}
            onValueChange={(value) => setMobileTab(value as 'outline' | 'page' | 'add')}
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="outline">Outline</TabsTrigger>
              <TabsTrigger value="page">Lesson</TabsTrigger>
              <TabsTrigger value="add">Add</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="min-h-0 flex-1">
          {wide === false ? (
            <div className="h-full">
              {mobileTab === 'outline' ? (
                <ScrollArea ref={outlineScrollRef} className="h-full bg-sidebar">
                  <div className="p-3">{renderOutline()}</div>
                </ScrollArea>
              ) : mobileTab === 'add' ? (
                renderCatalog('studio-block-search')
              ) : (
                renderCanvas()
              )}
            </div>
          ) : (
            <ResizablePanelGroup orientation="horizontal" className="h-full">
              {outlineOpen ? (
                <>
                  <ResizablePanel defaultSize={320} minSize={240} maxSize={480} className="bg-sidebar">
                    <ScrollArea ref={outlineScrollRef} className="h-full">
                      <div className="p-3">{renderOutline()}</div>
                    </ScrollArea>
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                </>
              ) : null}
              <ResizablePanel minSize="30%" className="bg-muted/40">
                {renderCanvas()}
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={320} minSize={260} maxSize={420} className="bg-sidebar">
                {renderCatalog('studio-block-search')}
              </ResizablePanel>
            </ResizablePanelGroup>
          )}
        </div>

        <Sheet open={!!moduleOptionsId} onOpenChange={(next) => !next && setModuleOptionsId(null)}>
          <SheetContent className="w-full overflow-y-auto data-[side=right]:sm:max-w-xl">
            <SheetHeader>
              <SheetTitle>Section options</SheetTitle>
              <SheetDescription>Resources and progression gates.</SheetDescription>
            </SheetHeader>
            <Separator />
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
            <Separator />
            <div className="px-4 pb-6">
              {aiOpen ? (
                <AskRigbuRail
                  courseId={courseId}
                  lessonId={lessonId || undefined}
                  onApplied={(next) => {
                    if (Array.isArray(next)) void saveBlocks(next as LessonBlock[])
                  }}
                  onStructureApplied={() => void load()}
                />
              ) : null}
            </div>
          </SheetContent>
        </Sheet>

        <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pendingDelete?.kind === 'module' ? 'Delete this section?' : 'Delete this lesson?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pendingDelete?.kind === 'module'
                  ? 'This removes the section and every lesson inside it.'
                  : 'This lesson and its content will be removed.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={(event) => {
                  event.preventDefault()
                  const pending = pendingDelete
                  setPendingDelete(null)
                  if (!pending) return
                  if (pending.kind === 'module') void deleteModule(pending.id)
                  else void deleteLesson(pending.moduleId, pending.id)
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
    </TooltipProvider>
  )
}
