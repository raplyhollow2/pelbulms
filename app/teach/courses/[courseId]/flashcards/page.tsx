'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Loader2, Plus, Trash2, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type CardRow = { front: string; back: string }

export default function CourseFlashcardsPage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.courseId as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('Course flashcards')
  const [cards, setCards] = useState<CardRow[]>([{ front: '', back: '' }])
  const [deckId, setDeckId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadDeck()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  const loadDeck = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }

      const { data: decks } = await (supabase as any)
        .from('flashcard_decks')
        .select('*')
        .eq('course_id', courseId)
        .is('lesson_id', null)
        .order('created_at', { ascending: false })
        .limit(1)

      const deck = decks?.[0]
      if (deck) {
        setDeckId(deck.id)
        setTitle(deck.title || 'Course flashcards')
        const { data: rows } = await (supabase as any)
          .from('flashcards')
          .select('*')
          .eq('deck_id', deck.id)
          .order('order_index', { ascending: true })
        if (rows?.length) {
          setCards(rows.map((r: any) => ({ front: r.front, back: r.back })))
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const save = async () => {
    setSaving(true)
    setMessage('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in')

      const valid = cards.filter((c) => c.front.trim() && c.back.trim())
      if (valid.length === 0) throw new Error('Add at least one card with front and back')

      let id = deckId
      if (!id) {
        const { data: deck, error } = await (supabase as any)
          .from('flashcard_decks')
          .insert({
            course_id: courseId,
            instructor_id: user.id,
            title: title.trim() || 'Course flashcards',
            is_published: true,
          })
          .select('*')
          .single()
        if (error) throw error
        id = deck.id
        setDeckId(id)
      } else {
        await (supabase as any)
          .from('flashcard_decks')
          .update({ title: title.trim() || 'Course flashcards', updated_at: new Date().toISOString() })
          .eq('id', id)
        await (supabase as any).from('flashcards').delete().eq('deck_id', id)
      }

      const rows = valid.map((c, i) => ({
        deck_id: id,
        front: c.front.trim(),
        back: c.back.trim(),
        order_index: i,
      }))
      const { error: insertError } = await (supabase as any).from('flashcards').insert(rows)
      if (insertError) throw insertError
      setMessage('Flashcards saved. Students will see them in Learning Tools.')
    } catch (e: any) {
      setMessage(e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-bhutan-yellow" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <Button variant="ghost" onClick={() => router.push(`/teach/courses/${courseId}/edit`)}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to course
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Flashcards</CardTitle>
          <CardDescription>
            Create cards for students to practice in the lesson Learning Tools tab.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Deck title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
          </div>

          {cards.map((card, index) => (
            <div key={index} className="rounded-lg border p-3 space-y-2">
              <div className="flex justify-between items-center">
                <Label>Card {index + 1}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCards(cards.filter((_, i) => i !== index))}
                  disabled={cards.length <= 1}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <Textarea
                placeholder="Front (question)"
                value={card.front}
                onChange={(e) => {
                  const next = [...cards]
                  next[index] = { ...next[index], front: e.target.value }
                  setCards(next)
                }}
                rows={2}
              />
              <Textarea
                placeholder="Back (answer)"
                value={card.back}
                onChange={(e) => {
                  const next = [...cards]
                  next[index] = { ...next[index], back: e.target.value }
                  setCards(next)
                }}
                rows={2}
              />
            </div>
          ))}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCards([...cards, { front: '', back: '' }])}
            >
              <Plus className="w-4 h-4 mr-1" /> Add card
            </Button>
            <Button
              onClick={save}
              disabled={saving}
              className="bg-bhutan-yellow text-black hover:bg-bhutan-orange"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save deck
            </Button>
          </div>
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
