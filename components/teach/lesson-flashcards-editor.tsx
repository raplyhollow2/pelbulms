'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, Trash2, Save, BrainCircuit } from 'lucide-react'

type CardRow = { front: string; back: string }

type Props = {
  courseId: string
  lessonId: string
  lessonTitle?: string
  compact?: boolean
}

export function LessonFlashcardsEditor({
  courseId,
  lessonId,
  lessonTitle,
  compact = false,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState(
    lessonTitle ? `${lessonTitle} flashcards` : 'Lesson flashcards'
  )
  const [cards, setCards] = useState<CardRow[]>([{ front: '', back: '' }])
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setMessage('')
      try {
        const res = await fetch(
          `/api/flashcards?courseId=${encodeURIComponent(courseId)}&lessonId=${encodeURIComponent(lessonId)}`
        )
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Failed to load')
        if (cancelled) return
        // Only show cards from this lesson deck (API may fall back to course-wide for students)
        const lessonDecks = (data.decks || []).filter((d: any) => d.lesson_id === lessonId)
        if (lessonDecks.length && data.cards?.length) {
          setTitle(lessonDecks[0].title || title)
          setCards(data.cards.map((c: any) => ({ front: c.front, back: c.back })))
        } else {
          setCards([{ front: '', back: '' }])
          if (lessonTitle) setTitle(`${lessonTitle} flashcards`)
        }
      } catch {
        if (!cancelled) setCards([{ front: '', back: '' }])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, lessonId])

  const save = async () => {
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          lessonId,
          title: title.trim() || 'Lesson flashcards',
          cards,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setMessage('Flashcards saved for this lesson.')
    } catch (e: any) {
      setMessage(e?.message || 'Failed to save flashcards')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading flashcards…
      </div>
    )
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {!compact && (
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <BrainCircuit className="w-3.5 h-3.5" />
          Flashcards for this lesson
        </Label>
      )}
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Deck title"
        className="h-9"
      />
      <div className="space-y-2">
        {cards.map((card, index) => (
          <div
            key={index}
            className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] rounded-md border p-2"
          >
            <Input
              value={card.front}
              onChange={(e) => {
                const next = [...cards]
                next[index] = { ...next[index], front: e.target.value }
                setCards(next)
              }}
              placeholder="Front"
              className="h-9"
            />
            <Input
              value={card.back}
              onChange={(e) => {
                const next = [...cards]
                next[index] = { ...next[index], back: e.target.value }
                setCards(next)
              }}
              placeholder="Back"
              className="h-9"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0"
              disabled={cards.length <= 1}
              onClick={() => setCards(cards.filter((_, i) => i !== index))}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCards([...cards, { front: '', back: '' }])}
        >
          <Plus className="w-4 h-4 mr-1" />
          Add card
        </Button>
        <Button
          type="button"
          size="sm"
          className="bg-bhutan-yellow hover:bg-bhutan-orange text-black"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-1" />
          )}
          Save flashcards
        </Button>
      </div>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  )
}
