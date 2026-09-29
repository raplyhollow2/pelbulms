'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { LessonBlock } from '@/lib/lesson-blocks'
import { newBlockId } from '@/lib/lesson-blocks'
import {
  Type,
  Image as ImageIcon,
  Play,
  Video,
  ListTree,
  Layers,
  Images,
  Scan,
  ListChecks,
  ClipboardList,
  CreditCard,
  Sparkles,
  Search,
} from 'lucide-react'

const LAST_USED_KEY = 'pelbu:block-picker-last'

const GROUPS: { label: string; items: { type: LessonBlock['type'] | 'ai-image'; title: string; icon: any }[] }[] = [
  {
    label: 'Text',
    items: [
      { type: 'text', title: 'Text', icon: Type },
      { type: 'accordion', title: 'Accordion', icon: ListTree },
    ],
  },
  {
    label: 'Interactions',
    items: [
      { type: 'flipcards', title: 'Flip cards', icon: CreditCard },
      { type: 'carousel', title: 'Carousel', icon: Images },
      { type: 'hotspot', title: 'Hotspot', icon: Scan },
    ],
  },
  {
    label: 'Assessments',
    items: [
      { type: 'quiz', title: 'Quiz', icon: ListChecks },
      { type: 'assignment', title: 'Assignment', icon: ClipboardList },
      { type: 'flashcards', title: 'Flashcards', icon: Layers },
    ],
  },
  {
    label: 'Multimedia',
    items: [
      { type: 'image', title: 'Image', icon: ImageIcon },
      { type: 'ai-image', title: 'Generate image', icon: Sparkles },
      { type: 'youtube', title: 'YouTube', icon: Play },
      { type: 'video', title: 'Upload video', icon: Video },
    ],
  },
]

export function emptyBlock(type: LessonBlock['type']): LessonBlock {
  const id = newBlockId()
  switch (type) {
    case 'text':
      return { id, type, html: '<p>New text block</p>' }
    case 'image':
      return { id, type, url: '', alt: '' }
    case 'youtube':
      return { id, type, url: '' }
    case 'video':
      return { id, type, url: '' }
    case 'accordion':
      return { id, type, items: [{ title: 'Section', html: '<p>Details</p>' }] }
    case 'flipcards':
      return { id, type, cards: [{ front: 'Term', back: 'Meaning' }] }
    case 'carousel':
      return { id, type, slides: [{ html: '<p>Slide</p>' }] }
    case 'hotspot':
      return { id, type, imageUrl: '', spots: [{ x: 50, y: 50, label: 'Spot', html: '' }] }
    case 'quiz':
      return { id, type, quizId: '' }
    case 'assignment':
      return { id, type, assignmentId: '' }
    case 'scenario':
      return { id, type, scenarioId: '' }
    case 'flashcards':
      return { id, type, cards: [{ front: 'Front', back: 'Back' }] }
  }
}

export function BlockCatalog({
  onPick,
  autoFocusSearch = false,
}: {
  onPick: (block: LessonBlock) => void
  autoFocusSearch?: boolean
}) {
  const [query, setQuery] = useState('')
  const [lastUsed, setLastUsed] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [imagePrompt, setImagePrompt] = useState('')
  const [imageError, setImageError] = useState('')
  const [imageOpen, setImageOpen] = useState(false)

  useEffect(() => {
    try {
      setLastUsed(JSON.parse(localStorage.getItem(LAST_USED_KEY) || '[]'))
    } catch {
      setLastUsed([])
    }
  }, [])

  const remember = (title: string) => {
    const next = [title, ...lastUsed.filter((t) => t !== title)].slice(0, 4)
    setLastUsed(next)
    localStorage.setItem(LAST_USED_KEY, JSON.stringify(next))
  }

  const pickType = (type: LessonBlock['type'], title: string) => {
    remember(title)
    onPick(emptyBlock(type))
  }

  const generateImage = async () => {
    const prompt = imagePrompt.trim()
    if (!prompt) {
      setImageError('Describe the picture first.')
      return
    }
    setBusy(true)
    setImageError('')
    try {
      const res = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Image failed')
      remember('Generate image')
      if (data.blocks) {
        const last = (data.blocks as LessonBlock[]).at(-1)
        if (last) onPick(last)
      } else if (data.url) {
        onPick({ id: newBlockId(), type: 'image', url: data.url, alt: prompt })
      }
      setImagePrompt('')
      setImageOpen(false)
    } catch (e: any) {
      setImageError(e?.message || 'Could not generate image')
    } finally {
      setBusy(false)
    }
  }

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return GROUPS
    const filtered = GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((item) => item.title.toLowerCase().includes(q)),
    })).filter((g) => g.items.length)
    return filtered
  }, [query])

  const lastItems = GROUPS.flatMap((g) => g.items).filter((item) => lastUsed.includes(item.title))

  return (
    <div className="space-y-4">
        {imageOpen ? (
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-sm font-medium">Describe the picture</p>
            <Textarea
              autoFocus
              rows={3}
              placeholder="A diagram of the value proposition canvas"
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
            />
            {imageError ? <p className="text-sm text-destructive">{imageError}</p> : null}
            <div className="flex gap-2">
              <Button type="button" className="min-h-11" disabled={busy} onClick={() => void generateImage()}>
                {busy ? 'Generating…' : 'Generate'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11"
                disabled={busy}
                onClick={() => {
                  setImageOpen(false)
                  setImageError('')
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus={autoFocusSearch}
            className="min-h-11 pl-9"
            placeholder="Search blocks…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {lastItems.length > 0 && !query && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last used</p>
            <div className="grid grid-cols-2 gap-2">
              {lastItems.map((item) => {
                const Icon = item.icon
                return (
                  <Button
                    key={`last-${item.type}`}
                    type="button"
                    variant="outline"
                    className="min-h-11 justify-start gap-2"
                    disabled={busy}
                    onClick={() => {
                      if (item.type === 'ai-image') {
                        setImageError('')
                        setImageOpen(true)
                      } else pickType(item.type, item.title)
                    }}
                  >
                    <Icon className="h-4 w-4" />
                    {item.title}
                  </Button>
                )
              })}
            </div>
          </div>
        )}
        <div className="space-y-4">
          {items.map((group) => (
            <div key={group.label}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <Button
                      key={item.type}
                      type="button"
                      variant="outline"
                      className="min-h-11 justify-start gap-2"
                      disabled={busy}
                      onClick={() => {
                        if (item.type === 'ai-image') {
                          setImageError('')
                          setImageOpen(true)
                        } else pickType(item.type, item.title)
                      }}
                    >
                      <Icon className="h-4 w-4" />
                      {item.title}
                    </Button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
    </div>
  )
}

export function BlockPicker({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (block: LessonBlock) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add content</DialogTitle>
          <DialogDescription>Search, or press / from the studio. Last used stays on top.</DialogDescription>
        </DialogHeader>
        {open ? (
          <BlockCatalog
            autoFocusSearch
            onPick={(block) => {
              onPick(block)
              onOpenChange(false)
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
