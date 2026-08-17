'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Sparkles, Download, Video } from 'lucide-react'

export function GeminiCoursePanel({ courseId }: { courseId: string }) {
  const [prompt, setPrompt] = useState('')
  const [documentText, setDocumentText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [avatarScript, setAvatarScript] = useState('')

  const generate = async () => {
    setLoading(true)
    setResult('')
    try {
      const res = await fetch('/api/ai/generate-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, prompt, documentText }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setResult(
        `Created ${data.created.modules} modules, ${data.created.lessons} lessons, ${data.created.quizzes} quizzes.`
      )
    } catch (e: any) {
      setResult(e?.message || 'Failed')
    } finally {
      setLoading(false)
    }
  }

  const avatar = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/ai/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: avatarScript || prompt }),
      })
      const data = await res.json()
      setResult(data.message || data.error || JSON.stringify(data))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5" /> Gemini course builder
        </CardTitle>
        <CardDescription>
          Prompt or paste a document. Gemini writes modules, lessons, and multiple-choice quizzes into this course.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Create a 4-module course on AI for teaching in Bhutanese classrooms…"
          rows={4}
        />
        <Textarea
          value={documentText}
          onChange={(e) => setDocumentText(e.target.value)}
          placeholder="Optional: paste PDF/handbook text"
          rows={4}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="min-h-11 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
            disabled={loading}
            onClick={() => void generate()}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Generate with Gemini
          </Button>
          <a
            href={`/api/teach/scorm?courseId=${courseId}`}
            className="inline-flex min-h-11 items-center rounded-md border border-input px-4 text-sm font-medium hover:bg-accent"
          >
            <Download className="mr-2 h-4 w-4" />
            Export SCORM
          </a>
        </div>
        <Textarea
          value={avatarScript}
          onChange={(e) => setAvatarScript(e.target.value)}
          placeholder="Optional presenter script for an AI avatar video"
          rows={2}
        />
        <Button type="button" variant="outline" className="min-h-11" disabled={loading} onClick={() => void avatar()}>
          <Video className="mr-2 h-4 w-4" />
          Avatar video (HeyGen if configured)
        </Button>
        {result && <p className="text-sm text-muted-foreground">{result}</p>}
      </CardContent>
    </Card>
  )
}
