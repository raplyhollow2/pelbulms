'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Sparkles, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export function GeminiTutor({
  courseId,
  lessonId,
  name = 'Course tutor',
  photoUrl,
  floating = false,
}: {
  courseId: string
  lessonId?: string
  name?: string
  photoUrl?: string
  floating?: boolean
}) {
  const [open, setOpen] = useState(!floating)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)

  const ask = async () => {
    if (!question.trim()) return
    setLoading(true)
    setAnswer('')
    try {
      const res = await fetch('/api/ai/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, lessonId, question }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Tutor failed')
      setAnswer(data.answer)
    } catch (e: any) {
      setAnswer(e?.message || 'Could not reach the tutor')
    } finally {
      setLoading(false)
    }
  }

  const body = (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Avatar className="h-8 w-8">
          {photoUrl ? <AvatarImage src={photoUrl} alt={name} /> : null}
          <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <p className="text-sm font-semibold">{name}</p>
        {floating && (
          <Button type="button" variant="ghost" size="icon" className="ml-auto" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <Textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask anything about this lesson…"
        rows={3}
      />
      <Button
        type="button"
        className="min-h-11 w-full bg-bhutan-yellow text-black hover:bg-bhutan-orange"
        disabled={loading}
        onClick={() => void ask()}
      >
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
        Ask tutor
      </Button>
      {answer && (
        <div className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-sm">{answer}</div>
      )}
    </div>
  )

  if (floating) {
    return (
      <>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="fixed bottom-24 right-4 z-40 flex min-h-11 items-center gap-2 rounded-full bg-bhutan-yellow px-4 text-sm font-semibold text-black shadow-lg lg:bottom-6"
          >
            <Sparkles className="h-4 w-4" />
            {name}
          </button>
        )}
        {open && (
          <div className="fixed bottom-24 right-4 z-40 w-[min(100%-2rem,22rem)] rounded-2xl border bg-background p-4 shadow-2xl lg:bottom-6">
            {body}
          </div>
        )}
      </>
    )
  }

  return <div className="rounded-xl border bg-card p-4">{body}</div>
}
