'use client'

import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { QuizCreator } from '@/components/quiz/quiz-creator'
import {
  uploadImageDirectToCloudinary,
  uploadVideoDirectToCloudinary,
} from '@/lib/cloudinary-direct-upload'
import {
  newBlockId,
  parseLessonBlocks,
  sanitizeHtml,
  youtubeEmbedId,
  type LessonBlock,
} from '@/lib/lesson-blocks'
import { ScenarioPlayer } from '@/components/learning/scenario-player'
import { BlockCatalog } from '@/components/teach/block-picker'
import { LessonResourcesEditor } from '@/components/teach/lesson-resources-editor'
import { resolveMediaUrl } from '@/lib/media'
import { cn } from '@/lib/utils'
import {
  Bold,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Italic,
  List,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'

type StarterType = 'text' | 'image' | 'youtube' | 'quiz'

export function LessonBlocks({
  content,
  lessonId,
  onTakeQuiz,
  editable,
  onChange,
  onInsert,
  onAddBlock,
  onAskPelbu,
  onOpenLessonOptions,
  highlightItemKey,
  courseId,
  resources,
  onResourcesChange,
}: {
  content: unknown
  lessonId?: string
  onTakeQuiz?: (quizId: string) => void
  editable?: boolean
  onChange?: (blocks: LessonBlock[]) => void
  onInsert?: (type: StarterType) => void
  onAddBlock?: (block: LessonBlock) => void
  onAskPelbu?: () => void
  onOpenLessonOptions?: () => void
  highlightItemKey?: string | null
  courseId?: string
  resources?: unknown
  onResourcesChange?: (next: unknown) => void
}) {
  const blocks = parseLessonBlocks(content)
  if (blocks.length === 0) {
    if (editable && (onAddBlock || onInsert)) {
      return (
        <EmptyLesson
          onInsert={onInsert}
          onAddBlock={onAddBlock}
          onAskPelbu={onAskPelbu}
          courseId={courseId}
          lessonId={lessonId}
          resources={resources}
          onResourcesChange={onResourcesChange}
        />
      )
    }
    return (
      <p className="text-sm text-muted-foreground">
        {editable ? 'No blocks yet. Use + to add content.' : 'This page has no content yet.'}
      </p>
    )
  }

  const update = (next: LessonBlock[]) => onChange?.(next)

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= blocks.length) return
    const next = [...blocks]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    update(next)
  }

  const duplicate = (index: number) => {
    const source = blocks[index]
    const copy = { ...structuredClone(source), id: newBlockId() }
    const next = [...blocks]
    next.splice(index + 1, 0, copy)
    update(next)
  }

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => (
        <div
          key={block.id || index}
          data-curriculum-item={editable ? undefined : `block:${block.id}`}
          className={cn(
            editable && 'rounded-xl border border-border/60 p-3',
            !editable &&
              highlightItemKey === `block:${block.id}` &&
              'rounded-xl ring-2 ring-bhutan-yellow'
          )}
        >
          {editable && (
            <div className="mb-2 flex items-center gap-1">
              <Badge variant="outline" className="capitalize">
                {block.type}
              </Badge>
              <div className="ml-auto flex items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Move up"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ChevronUp />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Move down"
                  disabled={index === blocks.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ChevronDown />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Duplicate"
                  onClick={() => duplicate(index)}
                >
                  <Copy />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove"
                  className="text-destructive"
                  onClick={() => update(blocks.filter((_, i) => i !== index))}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          )}
          <BlockView
            block={block}
            lessonId={lessonId}
            onTakeQuiz={onTakeQuiz}
            editable={editable}
            onOpenLessonOptions={onOpenLessonOptions}
            onBlockChange={(next) => {
              const copy = [...blocks]
              copy[index] = next
              update(copy)
            }}
          />
        </div>
      ))}
    </div>
  )
}

function EmptyLesson({
  onInsert,
  onAddBlock,
  onAskPelbu,
  courseId,
  lessonId,
  resources,
  onResourcesChange,
}: {
  onInsert?: (type: StarterType) => void
  onAddBlock?: (block: LessonBlock) => void
  onAskPelbu?: () => void
  courseId?: string
  lessonId?: string
  resources?: unknown
  onResourcesChange?: (next: unknown) => void
}) {
  return (
    <div className="rounded-xl border border-dashed p-6">
      <p className="text-sm font-medium">Resources</p>
      <div className="mt-4">
        {onAddBlock ? (
          <BlockCatalog onPick={onAddBlock} />
        ) : onInsert ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ['text', 'Text'],
                ['image', 'Image'],
                ['youtube', 'YouTube'],
                ['quiz', 'Quiz'],
              ] as const
            ).map(([type, title]) => (
              <Button key={type} type="button" variant="outline" className="min-h-11 justify-start" onClick={() => onInsert(type)}>
                {title}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
      {courseId && lessonId && onResourcesChange ? (
        <div className="mt-6 border-t pt-4">
          <LessonResourcesEditor
            courseId={courseId}
            lessonId={lessonId}
            resources={Array.isArray(resources) ? resources : []}
            onChange={onResourcesChange}
          />
        </div>
      ) : null}
      {onAskPelbu && (
        <Button type="button" variant="ghost" className="mt-3 min-h-11" onClick={onAskPelbu}>
          <Sparkles className="mr-2 h-4 w-4" />
          Ask Pelbu
        </Button>
      )}
    </div>
  )
}

function BlockView({
  block,
  lessonId,
  onTakeQuiz,
  editable,
  onOpenLessonOptions,
  onBlockChange,
}: {
  block: LessonBlock
  lessonId?: string
  onTakeQuiz?: (quizId: string) => void
  editable?: boolean
  onOpenLessonOptions?: () => void
  onBlockChange: (block: LessonBlock) => void
}) {
  if (editable) {
    return (
      <EditableBlock
        block={block}
        lessonId={lessonId}
        onTakeQuiz={onTakeQuiz}
        onOpenLessonOptions={onOpenLessonOptions}
        onBlockChange={onBlockChange}
      />
    )
  }

  if (block.type === 'text') {
    return (
      <div
        className="prose prose-sm dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.html) }}
      />
    )
  }

  if (block.type === 'image' && block.url) {
    const src = resolveMediaUrl(block.url) || block.url
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={block.alt || ''} className="w-full rounded-xl object-cover" />
    )
  }

  if (block.type === 'youtube') {
    const id = youtubeEmbedId(block.url)
    if (!id) return <p className="text-sm text-muted-foreground">YouTube URL missing</p>
    return <YouTubeEmbed id={id} />
  }

  if (block.type === 'video' && block.url) {
    const src = resolveMediaUrl(block.url) || block.url
    return <VideoPlayer src={src} />
  }

  if (block.type === 'accordion') {
    return <AccordionPreview items={block.items} />
  }

  if (block.type === 'flipcards') {
    return <FlipDeck cards={block.cards} />
  }

  if (block.type === 'carousel') {
    return <Carousel slides={block.slides} />
  }

  if (block.type === 'hotspot') {
    return <HotspotImage imageUrl={block.imageUrl} spots={block.spots} />
  }

  if (block.type === 'quiz') {
    if (!block.quizId) {
      return <UnlinkedAssessment message="This quiz is not available yet." />
    }
    return <QuizCard quizId={block.quizId} onTakeQuiz={onTakeQuiz} />
  }

  if (block.type === 'assignment') {
    if (!block.assignmentId) {
      return <UnlinkedAssessment message="This assignment is not available yet." />
    }
    return <AssignmentSubmit assignmentId={block.assignmentId} />
  }

  if (block.type === 'scenario' && lessonId) {
    return <ScenarioPlayer lessonId={lessonId} />
  }

  if (block.type === 'flashcards') {
    return <FlipDeck cards={block.cards || []} />
  }

  return null
}

function EditableBlock({
  block,
  lessonId,
  onBlockChange,
}: {
  block: LessonBlock
  lessonId?: string
  onTakeQuiz?: (quizId: string) => void
  onOpenLessonOptions?: () => void
  onBlockChange: (block: LessonBlock) => void
}) {
  if (block.type === 'text') {
    return <RichTextEditor html={block.html} onChange={(html) => onBlockChange({ ...block, html })} />
  }

  if (block.type === 'image') {
    return (
      <ImageBlockEditor block={block} lessonId={lessonId} onBlockChange={onBlockChange} />
    )
  }

  if (block.type === 'youtube') {
    const id = youtubeEmbedId(block.url)
    return (
      <div className="space-y-3">
        <Input
          className="min-h-11"
          placeholder="YouTube URL"
          value={block.url}
          onChange={(e) => onBlockChange({ ...block, url: e.target.value })}
        />
        {id ? <YouTubeEmbed id={id} /> : null}
      </div>
    )
  }

  if (block.type === 'video') {
    return (
      <VideoBlockEditor block={block} lessonId={lessonId} onBlockChange={onBlockChange} />
    )
  }

  if (block.type === 'accordion') {
    return (
      <div className="space-y-3">
        {block.items.map((item, index) => (
          <div key={index} className="space-y-2 rounded-lg border p-3">
            <Input
              className="min-h-11"
              aria-label="Section title"
              placeholder="Section title"
              value={item.title}
              onChange={(e) => {
                const items = block.items.map((row, i) => (i === index ? { ...row, title: e.target.value } : row))
                onBlockChange({ ...block, items })
              }}
            />
            <RichTextEditor
              html={item.html}
              onChange={(html) => {
                const items = block.items.map((row, i) => (i === index ? { ...row, html } : row))
                onBlockChange({ ...block, items })
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => onBlockChange({ ...block, items: block.items.filter((_, i) => i !== index) })}
            >
              Remove section
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() =>
            onBlockChange({ ...block, items: [...block.items, { title: 'Section', html: '<p>Details</p>' }] })
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          Add section
        </Button>
        {block.items.length > 0 && <AccordionPreview items={block.items} />}
      </div>
    )
  }

  if (block.type === 'flipcards' || block.type === 'flashcards') {
    const cards = block.cards || []
    const setCards = (next: { front: string; back: string }[]) => {
      if (block.type === 'flipcards') onBlockChange({ ...block, cards: next })
      else onBlockChange({ ...block, cards: next })
    }
    return (
      <div className="space-y-3">
        {cards.map((card, index) => (
          <div key={index} className="space-y-2 rounded-lg border p-3">
            <Input
              className="min-h-11"
              aria-label="Front"
              placeholder="Front"
              value={card.front}
              onChange={(e) => setCards(cards.map((row, i) => (i === index ? { ...row, front: e.target.value } : row)))}
            />
            <Textarea
              rows={2}
              aria-label="Back"
              placeholder="Back"
              value={card.back}
              onChange={(e) => setCards(cards.map((row, i) => (i === index ? { ...row, back: e.target.value } : row)))}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => setCards(cards.filter((_, i) => i !== index))}
            >
              Remove card
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => setCards([...cards, { front: 'Front', back: 'Back' }])}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add card
        </Button>
        {cards.length > 0 && <FlipDeck cards={cards} />}
      </div>
    )
  }

  if (block.type === 'carousel') {
    return (
      <div className="space-y-3">
        {block.slides.map((slide, index) => (
          <div key={index} className="space-y-2 rounded-lg border p-3">
            <RichTextEditor
              html={slide.html}
              onChange={(html) => {
                const slides = block.slides.map((row, i) => (i === index ? { ...row, html } : row))
                onBlockChange({ ...block, slides })
              }}
            />
            <Input
              className="min-h-11"
              placeholder="Slide image URL (optional)"
              value={slide.imageUrl || ''}
              onChange={(e) => {
                const slides = block.slides.map((row, i) =>
                  i === index ? { ...row, imageUrl: e.target.value } : row
                )
                onBlockChange({ ...block, slides })
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => onBlockChange({ ...block, slides: block.slides.filter((_, i) => i !== index) })}
            >
              Remove slide
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => onBlockChange({ ...block, slides: [...block.slides, { html: '<p>Slide</p>' }] })}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add slide
        </Button>
        {block.slides.length > 0 && <Carousel slides={block.slides} />}
      </div>
    )
  }

  if (block.type === 'hotspot') {
    return (
      <HotspotBlockEditor block={block} lessonId={lessonId} onBlockChange={onBlockChange} />
    )
  }

  if (block.type === 'quiz') {
    if (!lessonId) {
      return <UnlinkedAssessment message="Open this lesson in the studio to write the quiz." />
    }
    return (
      <QuizCreator
        lessonId={lessonId}
        quizId={block.quizId || null}
        compact
        onSave={(quiz) => onBlockChange({ ...block, quizId: quiz.id })}
      />
    )
  }

  if (block.type === 'assignment') {
    if (!lessonId) {
      return <UnlinkedAssessment message="Open this lesson in the studio to write the assignment." />
    }
    return (
      <AssignmentBlockEditor block={block} lessonId={lessonId} onBlockChange={onBlockChange} />
    )
  }

  if (block.type === 'scenario' && lessonId) {
    return <ScenarioPlayer lessonId={lessonId} />
  }

  return null
}

function MediaPicker({
  accept,
  label,
  busy,
  onFile,
}: {
  accept: string
  label: string
  busy: boolean
  onFile: (file: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ''
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
        {busy ? 'Uploading…' : label}
      </Button>
    </>
  )
}

function ImageBlockEditor({
  block,
  lessonId,
  onBlockChange,
}: {
  block: Extract<LessonBlock, { type: 'image' }>
  lessonId?: string
  onBlockChange: (block: LessonBlock) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const src = block.url ? resolveMediaUrl(block.url) || block.url : ''

  const upload = async (file: File) => {
    setBusy(true)
    setError('')
    try {
      const uploaded = await uploadImageDirectToCloudinary(file, {
        folder: `lesson-blocks/${lessonId || 'images'}`,
      })
      onBlockChange({ ...block, url: uploaded.url, alt: block.alt || file.name.replace(/\.[^.]+$/, '') })
    } catch (err: any) {
      setError(err?.message || 'Could not upload image')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <MediaPicker accept="image/jpeg,image/png,image/webp,image/gif,image/avif" label="Upload image" busy={busy} onFile={(file) => void upload(file)} />
      </div>
      <Input
        className="min-h-11"
        placeholder="Or paste an image URL"
        value={block.url}
        onChange={(e) => onBlockChange({ ...block, url: e.target.value })}
      />
      <Input
        className="min-h-11"
        placeholder="Alt text"
        value={block.alt || ''}
        onChange={(e) => onBlockChange({ ...block, alt: e.target.value })}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={block.alt || ''} className="w-full rounded-xl object-cover" />
      ) : null}
    </div>
  )
}

function VideoBlockEditor({
  block,
  lessonId,
  onBlockChange,
}: {
  block: Extract<LessonBlock, { type: 'video' }>
  lessonId?: string
  onBlockChange: (block: LessonBlock) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const src = block.url ? resolveMediaUrl(block.url) || block.url : ''

  const upload = async (file: File) => {
    setBusy(true)
    setError('')
    try {
      const uploaded = await uploadVideoDirectToCloudinary(file, {
        folder: `course-media/videos/${lessonId || 'blocks'}`,
      })
      onBlockChange({ ...block, url: uploaded.url })
    } catch (err: any) {
      setError(err?.message || 'Could not upload video')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <MediaPicker accept="video/mp4,video/webm,video/ogg,video/quicktime" label="Upload video" busy={busy} onFile={(file) => void upload(file)} />
      <Input
        className="min-h-11"
        placeholder="Or paste a video URL"
        value={block.url}
        onChange={(e) => onBlockChange({ ...block, url: e.target.value })}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {src ? <VideoPlayer src={src} /> : null}
    </div>
  )
}

function HotspotBlockEditor({
  block,
  lessonId,
  onBlockChange,
}: {
  block: Extract<LessonBlock, { type: 'hotspot' }>
  lessonId?: string
  onBlockChange: (block: LessonBlock) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const src = block.imageUrl ? resolveMediaUrl(block.imageUrl) || block.imageUrl : ''

  const upload = async (file: File) => {
    setBusy(true)
    setError('')
    try {
      const uploaded = await uploadImageDirectToCloudinary(file, {
        folder: `lesson-blocks/${lessonId || 'hotspots'}`,
      })
      onBlockChange({ ...block, imageUrl: uploaded.url })
    } catch (err: any) {
      setError(err?.message || 'Could not upload image')
    } finally {
      setBusy(false)
    }
  }

  const placeSpot = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('[data-hotspot-marker]')) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const x = Math.min(100, Math.max(0, Math.round(((event.clientX - rect.left) / rect.width) * 100)))
    const y = Math.min(100, Math.max(0, Math.round(((event.clientY - rect.top) / rect.height) * 100)))
    onBlockChange({
      ...block,
      spots: [...block.spots, { x, y, label: `Spot ${block.spots.length + 1}`, html: '' }],
    })
  }

  return (
    <div className="space-y-3">
      <MediaPicker accept="image/jpeg,image/png,image/webp,image/gif,image/avif" label="Upload image" busy={busy} onFile={(file) => void upload(file)} />
      <Input
        className="min-h-11"
        placeholder="Or paste an image URL"
        value={block.imageUrl}
        onChange={(e) => onBlockChange({ ...block, imageUrl: e.target.value })}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {src ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Click the picture to mark a point. Learners open each point to read the note.</p>
          <div className="relative cursor-crosshair overflow-hidden rounded-xl" onClick={placeSpot}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="w-full" />
            {block.spots.map((spot, index) => (
              <span
                key={`${spot.x}-${spot.y}-${index}`}
                data-hotspot-marker
                className="absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-bhutan-yellow text-xs font-bold text-black shadow"
                style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
              >
                {index + 1}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Add a picture, then click it to mark the points you want to explain.</p>
      )}
      {block.spots.map((spot, index) => (
        <div key={`${spot.label}-${index}`} className="space-y-2 rounded-lg border p-3">
          <p className="text-xs font-medium text-muted-foreground">Point {index + 1}</p>
          <Input
            className="min-h-11"
            aria-label={`Point ${index + 1} label`}
            placeholder="Label"
            value={spot.label}
            onChange={(e) => {
              const spots = block.spots.map((row, i) => (i === index ? { ...row, label: e.target.value } : row))
              onBlockChange({ ...block, spots })
            }}
          />
          <Textarea
            rows={3}
            aria-label={`Point ${index + 1} explanation`}
            placeholder="What learners should know about this point"
            value={spot.html.replace(/<[^>]+>/g, '')}
            onChange={(e) => {
              const spots = block.spots.map((row, i) =>
                i === index ? { ...row, html: `<p>${e.target.value}</p>` } : row
              )
              onBlockChange({ ...block, spots })
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => onBlockChange({ ...block, spots: block.spots.filter((_, i) => i !== index) })}
          >
            Remove point
          </Button>
        </div>
      ))}
    </div>
  )
}

function AssignmentBlockEditor({
  block,
  lessonId,
  onBlockChange,
}: {
  block: Extract<LessonBlock, { type: 'assignment' }>
  lessonId: string
  onBlockChange: (block: LessonBlock) => void
}) {
  const [title, setTitle] = useState('Assignment')
  const [instructions, setInstructions] = useState('')
  const [maxPoints, setMaxPoints] = useState('100')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(Boolean(block.assignmentId))

  useEffect(() => {
    if (!block.assignmentId) return
    let cancelled = false
    void (async () => {
      const res = await fetch(`/api/assignments?id=${encodeURIComponent(block.assignmentId)}`)
      const data = await res.json().catch(() => ({}))
      if (cancelled || !res.ok || !data.assignment) return
      setTitle(data.assignment.title || 'Assignment')
      setInstructions(data.assignment.instructions || data.assignment.description || '')
      setMaxPoints(String(data.assignment.max_points || 100))
      setDueDate(data.assignment.due_date ? String(data.assignment.due_date).slice(0, 16) : '')
    })()
    return () => {
      cancelled = true
    }
  }, [block.assignmentId])

  const save = async () => {
    if (!title.trim()) {
      setError('Give the assignment a title.')
      return
    }
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId,
          assignmentId: block.assignmentId || undefined,
          title,
          instructions,
          maxPoints: Number(maxPoints) || 100,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save assignment')
      onBlockChange({ ...block, assignmentId: data.assignment.id })
      setSaved(true)
    } catch (err: any) {
      setError(err?.message || 'Could not save assignment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`assignment-title-${block.id}`}>Title</Label>
        <Input id={`assignment-title-${block.id}`} className="min-h-11" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`assignment-instructions-${block.id}`}>What learners should submit</Label>
        <Textarea
          id={`assignment-instructions-${block.id}`}
          rows={4}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Describe the work you want collected for review"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`assignment-points-${block.id}`}>Max points</Label>
          <Input
            id={`assignment-points-${block.id}`}
            type="number"
            min={1}
            className="min-h-11"
            value={maxPoints}
            onChange={(e) => setMaxPoints(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`assignment-due-${block.id}`}>Due date</Label>
          <Input
            id={`assignment-due-${block.id}`}
            type="datetime-local"
            className="min-h-11"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex items-center gap-3">
        <Button type="button" className="min-h-11" disabled={saving} onClick={() => void save()}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {block.assignmentId ? 'Update assignment' : 'Save assignment'}
        </Button>
        {saved ? <p className="text-sm text-muted-foreground">Learners can submit this from the Resources tab.</p> : null}
      </div>
    </div>
  )
}

function AssignmentSubmit({ assignmentId }: { assignmentId: string }) {
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [content, setContent] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await fetch(`/api/assignments?id=${encodeURIComponent(assignmentId)}`)
      const data = await res.json().catch(() => ({}))
      if (cancelled || !res.ok || !data.assignment) return
      setTitle(data.assignment.title || 'Assignment')
      setInstructions(data.assignment.instructions || data.assignment.description || '')
      if (data.submission?.content) {
        setContent(data.submission.content)
        setStatus(data.submission.status || 'submitted')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [assignmentId])

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not submit')
      setStatus(data.submission?.status || 'submitted')
    } catch (err: any) {
      setError(err?.message || 'Could not submit')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <p className="text-sm font-medium">{title || 'Assignment'}</p>
        {instructions ? <p className="whitespace-pre-wrap text-sm text-muted-foreground">{instructions}</p> : null}
        <Textarea
          rows={4}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your response"
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {status ? <p className="text-xs text-muted-foreground">Status: {status}</p> : null}
        <Button type="button" className="min-h-11" disabled={busy || !content.trim()} onClick={() => void submit()}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {status ? 'Submit again' : 'Submit assignment'}
        </Button>
      </CardContent>
    </Card>
  )
}

function UnlinkedAssessment({
  message,
  onOpenLessonOptions,
}: {
  message: string
  onOpenLessonOptions?: () => void
}) {
  return (
    <div className="space-y-3 rounded-lg border border-dashed p-4">
      <p className="text-sm text-muted-foreground">{message}</p>
      {onOpenLessonOptions && (
        <Button type="button" variant="outline" className="min-h-11" onClick={onOpenLessonOptions}>
          Lesson settings
        </Button>
      )}
    </div>
  )
}

function RichTextEditor({ html, onChange }: { html: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const focused = useRef(false)
  const [source, setSource] = useState(html)
  const [prevHtml, setPrevHtml] = useState(html)

  if (html !== prevHtml) {
    setPrevHtml(html)
    if (!focused.current) setSource(html)
  }

  const apply = (command: string) => {
    ref.current?.focus()
    focused.current = true
    document.execCommand(command)
    onChange(sanitizeHtml(ref.current?.innerHTML || ''))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <Button type="button" variant="outline" size="icon-sm" aria-label="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => apply('bold')}>
          <Bold />
        </Button>
        <Button type="button" variant="outline" size="icon-sm" aria-label="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => apply('italic')}>
          <Italic />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Bulleted list"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => apply('insertUnorderedList')}
        >
          <List />
        </Button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Lesson text"
        className="prose prose-sm dark:prose-invert min-h-32 w-full max-w-none rounded-md border bg-background p-3 text-sm focus:outline-none"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(source || '<p></p>') }}
        onFocus={() => {
          focused.current = true
        }}
        onInput={() => {
          onChange(sanitizeHtml(ref.current?.innerHTML || ''))
        }}
        onBlur={() => {
          focused.current = false
          const next = sanitizeHtml(ref.current?.innerHTML || '')
          setSource(next)
          onChange(next)
        }}
      />
    </div>
  )
}

function YouTubeEmbed({ id }: { id: string }) {
  return (
    <div className="aspect-video overflow-hidden rounded-xl">
      <iframe title="YouTube" src={`https://www.youtube.com/embed/${id}`} className="h-full w-full" allowFullScreen />
    </div>
  )
}

function VideoPlayer({ src }: { src: string }) {
  return (
    <video src={src} controls className="w-full rounded-xl">
      <track kind="captions" />
    </video>
  )
}

function QuizCard({ quizId, onTakeQuiz }: { quizId: string; onTakeQuiz?: (quizId: string) => void }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <p className="text-sm font-medium">Knowledge check</p>
        <Button
          type="button"
          className="min-h-11 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
          onClick={() => onTakeQuiz?.(quizId)}
        >
          Take quiz
        </Button>
      </CardContent>
    </Card>
  )
}

function AccordionPreview({ items }: { items: { title: string; html: string }[] }) {
  return (
    <Accordion multiple defaultValue={items[0] ? ['a-0'] : []}>
      {items.map((item, i) => (
        <AccordionItem key={`${item.title}-${i}`} value={`a-${i}`}>
          <AccordionTrigger>{item.title}</AccordionTrigger>
          <AccordionContent>
            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.html) }} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

function HotspotImage({
  imageUrl,
  spots,
}: {
  imageUrl: string
  spots: { x: number; y: number; label: string; html: string }[]
}) {
  const [open, setOpen] = useState<number | null>(null)
  const active = open !== null ? spots[open] : null
  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={resolveMediaUrl(imageUrl) || imageUrl} alt="" className="w-full" />
        {spots.map((spot, i) => (
          <button
            key={i}
            type="button"
            title={spot.label}
            className="absolute size-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-bhutan-yellow text-xs font-bold text-black shadow"
            style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
            onClick={() => setOpen(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>
      {active && (
        <div className="rounded-xl border p-3 text-sm">
          <p className="font-medium">{active.label}</p>
          <div
            className="prose prose-sm dark:prose-invert mt-1 max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(active.html) }}
          />
        </div>
      )}
    </div>
  )
}

function FlipDeck({ cards }: { cards: { front: string; back: string }[] }) {
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  if (!cards.length) return null
  const card = cards[Math.min(i, cards.length - 1)]
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setFlipped((v) => !v)}
        className="min-h-40 w-full rounded-xl border bg-card p-6 text-left shadow-sm"
      >
        <p className="text-xs uppercase text-muted-foreground">{flipped ? 'Back' : 'Front'}</p>
        <p className="mt-2 text-base font-medium">{flipped ? card.back : card.front}</p>
      </button>
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" className="min-h-11" disabled={i === 0} onClick={() => { setI(i - 1); setFlipped(false) }}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground">
          {Math.min(i, cards.length - 1) + 1} / {cards.length}
        </span>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={i >= cards.length - 1}
          onClick={() => {
            setI(i + 1)
            setFlipped(false)
          }}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function Carousel({ slides }: { slides: { html: string; imageUrl?: string }[] }) {
  const [i, setI] = useState(0)
  if (!slides.length) return null
  const slide = slides[Math.min(i, slides.length - 1)]
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border">
        {slide.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resolveMediaUrl(slide.imageUrl) || slide.imageUrl} alt="" className="h-40 w-full object-cover" />
        )}
        <div className="p-4 text-sm" dangerouslySetInnerHTML={{ __html: sanitizeHtml(slide.html) }} />
      </div>
      <div className="flex justify-between">
        <Button type="button" variant="outline" className="min-h-11" disabled={i === 0} onClick={() => setI(i - 1)}>
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={i >= slides.length - 1}
          onClick={() => setI(i + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
