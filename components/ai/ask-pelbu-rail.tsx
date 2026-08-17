'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Sparkles } from 'lucide-react'

const CHIPS = [
  'Rewrite this page more clearly',
  'Make the English simpler',
  'Add a short quiz',
  'Add flip cards',
  'Add an educational image',
  'Add AI avatar video',
]

export function AskPelbuRail({
  courseId,
  lessonId,
  onApplied,
}: {
  courseId: string
  lessonId?: string
  onApplied?: (blocks?: unknown) => void
}) {
  const [instruction, setInstruction] = useState('')
  const [log, setLog] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const send = async (preset?: string) => {
    const text = (preset || instruction).trim()
    if (!text) return
    setLoading(true)
    try {
      const lower = text.toLowerCase()
      if (lower.includes('image')) {
        const prompt = window.prompt('Describe the image', text.replace(/add an educational image/i, '').trim() || 'Educational diagram for this lesson')
        if (!prompt) return
        const res = await fetch('/api/ai/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, lessonId }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Image failed')
        setLog((prev) => [...prev, `You: ${text}`, 'Pelbu: Added an image to this page.'])
        setInstruction('')
        onApplied?.(data.blocks)
        return
      }
      if (lower.includes('avatar') || lower.includes('ai video')) {
        const res = await fetch('/api/ai/avatar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lessonId, script: '' }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Avatar failed')
        setLog((prev) => [
          ...prev,
          `You: ${text}`,
          `Pelbu: ${data.message || (data.url ? 'Avatar video attached.' : 'Avatar job started.')}`,
        ])
        if (data.settingsUrl && !data.configured) {
          setLog((prev) => [...prev, 'Add a HeyGen, D-ID, or Tavus key in Settings → AI.'])
        }
        setInstruction('')
        onApplied?.(data.blocks)
        return
      }
      const res = await fetch('/api/ai/edit-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, lessonId, instruction: text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Edit failed')
      setLog((prev) => [...prev, `You: ${text}`, `Pelbu: ${data.reply || 'Updated.'}`])
      setInstruction('')
      onApplied?.(data.blocks)
    } catch (e: any) {
      setLog((prev) => [...prev, `Error: ${e?.message || 'Failed'}`])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="h-4 w-4 text-bhutan-orange" />
        Ask Pelbu
      </div>
      <div className="min-h-32 flex-1 space-y-2 overflow-y-auto rounded-lg border bg-muted/20 p-3 text-xs">
        {log.length === 0 && (
          <p className="text-muted-foreground">Rewrite, simplify English, add a quiz, add an image, or add an AI video.</p>
        )}
        {log.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {CHIPS.map((chip) => (
          <Button
            key={chip}
            type="button"
            size="sm"
            variant="outline"
            className="min-h-11"
            disabled={loading}
            onClick={() => void send(chip)}
          >
            {chip}
          </Button>
        ))}
      </div>
      <Textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder="Tell Pelbu what to change…"
        rows={3}
      />
      <Button
        type="button"
        className="min-h-11 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
        disabled={loading}
        onClick={() => void send()}
      >
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
        Send
      </Button>
    </div>
  )
}
