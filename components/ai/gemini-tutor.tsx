'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Sparkles } from 'lucide-react'

export function GeminiTutor({
  courseId,
  lessonId,
}: {
  courseId: string
  lessonId?: string
}) {
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

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-bhutan-orange" />
          Course tutor (Gemini)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything about this lesson…"
          rows={3}
        />
        <Button
          type="button"
          className="min-h-11 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
          disabled={loading}
          onClick={() => void ask()}
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Ask tutor
        </Button>
        {answer && (
          <div className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-sm">{answer}</div>
        )}
      </CardContent>
    </Card>
  )
}
