'use client'

import { useState } from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  parseLessonBlocks,
  sanitizeHtml,
  youtubeEmbedId,
  type LessonBlock,
} from '@/lib/lesson-blocks'
import { ScenarioPlayer } from '@/components/learning/scenario-player'
import { resolveMediaUrl } from '@/lib/media'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function LessonBlocks({
  content,
  lessonId,
  onTakeQuiz,
  editable,
  onChange,
}: {
  content: unknown
  lessonId?: string
  onTakeQuiz?: (quizId: string) => void
  editable?: boolean
  onChange?: (blocks: LessonBlock[]) => void
}) {
  const blocks = parseLessonBlocks(content)
  if (blocks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {editable ? 'No blocks yet. Use + to add content.' : 'This page has no content yet.'}
      </p>
    )
  }

  const update = (next: LessonBlock[]) => onChange?.(next)

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => (
        <div
          key={block.id || index}
          className={editable ? 'rounded-xl border border-border/60 p-3' : undefined}
        >
          {editable && (
            <div className="mb-2 flex items-center justify-between gap-2">
              <Badge variant="outline" className="capitalize">
                {block.type}
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11 text-destructive"
                onClick={() => update(blocks.filter((_, i) => i !== index))}
              >
                Remove
              </Button>
            </div>
          )}
          <BlockView
            block={block}
            lessonId={lessonId}
            onTakeQuiz={onTakeQuiz}
            editable={editable}
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

function BlockView({
  block,
  lessonId,
  onTakeQuiz,
  editable,
  onBlockChange,
}: {
  block: LessonBlock
  lessonId?: string
  onTakeQuiz?: (quizId: string) => void
  editable?: boolean
  onBlockChange: (block: LessonBlock) => void
}) {
  if (block.type === 'text') {
    if (editable) {
      return (
        <textarea
          className="min-h-32 w-full rounded-md border bg-background p-3 text-sm"
          value={block.html}
          onChange={(e) => onBlockChange({ ...block, html: e.target.value })}
        />
      )
    }
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
    return (
      <div className="aspect-video overflow-hidden rounded-xl">
        <iframe
          title="YouTube"
          src={`https://www.youtube.com/embed/${id}`}
          className="h-full w-full"
          allowFullScreen
        />
      </div>
    )
  }

  if (block.type === 'video' && block.url) {
    const src = resolveMediaUrl(block.url) || block.url
    return (
      <video src={src} controls className="w-full rounded-xl">
        <track kind="captions" />
      </video>
    )
  }

  if (block.type === 'accordion') {
    return (
      <Accordion multiple defaultValue={block.items[0] ? ['a-0'] : []}>
        {block.items.map((item, i) => (
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

  if (block.type === 'flipcards') {
    return <FlipDeck cards={block.cards} />
  }

  if (block.type === 'carousel') {
    return <Carousel slides={block.slides} />
  }

  if (block.type === 'hotspot') {
    return <HotspotImage imageUrl={block.imageUrl} spots={block.spots} />
  }

  if (block.type === 'quiz' && block.quizId) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <p className="text-sm font-medium">Knowledge check</p>
          <Button
            type="button"
            className="min-h-11 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
            onClick={() => onTakeQuiz?.(block.quizId)}
          >
            Take quiz
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (block.type === 'assignment') {
    return (
      <Card>
        <CardContent className="p-4 text-sm">
          Assignment attached to this page. Open Learning tools or the assignment tab to submit.
        </CardContent>
      </Card>
    )
  }

  if (block.type === 'scenario' && lessonId) {
    return <ScenarioPlayer lessonId={lessonId} />
  }

  if (block.type === 'flashcards') {
    return <FlipDeck cards={block.cards || []} />
  }

  return null
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
            className="mt-1 prose prose-sm dark:prose-invert max-w-none"
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
  const card = cards[i]
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
          {i + 1} / {cards.length}
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
  const slide = slides[i]
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border">
        {slide.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slide.imageUrl} alt="" className="h-40 w-full object-cover" />
        )}
        <div
          className="p-4 text-sm"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(slide.html) }}
        />
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
