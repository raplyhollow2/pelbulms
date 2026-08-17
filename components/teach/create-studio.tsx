'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Loader2, Paperclip, Send, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CourseOutline, CourseSize } from '@/lib/ai-course-builder'
import { OutlineCanvas } from '@/components/teach/outline-canvas'

const CHIPS = [
  'AI for teachers in Bhutanese classrooms',
  'Workplace safety induction',
  'CPR basics for school staff',
]

const LANGS = ['English', 'Dzongkha', 'English (AU)', 'Hindi']

export function CreateStudio() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [prompt, setPrompt] = useState('')
  const [language, setLanguage] = useState('English')
  const [size, setSize] = useState<CourseSize>('standard')
  const [documentText, setDocumentText] = useState('')
  const [sourceLabel, setSourceLabel] = useState('')
  const [keyReady, setKeyReady] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [phase, setPhase] = useState<'compose' | 'outline' | 'building'>('compose')
  const [outline, setOutline] = useState<CourseOutline | null>(null)
  const [totals, setTotals] = useState<any>(null)
  const [progress, setProgress] = useState<string[]>([])
  const [error, setError] = useState('')
  const [draftCourseId, setDraftCourseId] = useState<string | null>(null)
  const [draftModuleIds, setDraftModuleIds] = useState<string[]>([])
  const [failedModule, setFailedModule] = useState<number | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('pelbu:create-language')
    if (saved) setLanguage(saved)
    void fetch('/api/ai/keys')
      .then((r) => r.json())
      .then((d) => setKeyReady(Boolean(d.gemini?.configured)))
      .catch(() => setKeyReady(false))
  }, [])

  const extractFile = async (file: File) => {
    setSourceLabel(file.name)
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/ai/extract-source', { method: 'POST', body: form })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Could not read file')
    setDocumentText(data.text || '')
  }

  const attachUrl = async () => {
    const url = window.prompt('Paste a YouTube or web URL')
    if (!url) return
    setLoading(true)
    try {
      const res = await fetch('/api/ai/extract-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDocumentText(data.text || '')
      setSourceLabel(url)
    } catch (e: any) {
      setError(e?.message || 'Could not use that URL')
    } finally {
      setLoading(false)
    }
  }

  const design = async (extra?: string) => {
    if (!prompt.trim() && !documentText && !extra) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ai/generate-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'outline',
          prompt: extra
            ? `${prompt}\n\nCurrent outline JSON: ${JSON.stringify(outline)}\nTeacher change: ${extra}`
            : prompt,
          documentText,
          language,
          size,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Outline failed')
      setOutline(data.outline)
      setTotals(data.totals)
      setPhase('outline')
    } catch (e: any) {
      setError(e?.message || 'Could not design the course')
    } finally {
      setLoading(false)
    }
  }

  const fillFrom = async (courseId: string, moduleIds: string[], startIndex: number) => {
    setPhase('building')
    setLoading(true)
    setFailedModule(null)
    try {
      for (let i = startIndex; i < moduleIds.length; i++) {
        setProgress((p) => [...p, `Writing module ${i + 1} of ${moduleIds.length}…`])
        const fill = await fetch('/api/ai/generate-course', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'fill-module',
            courseId,
            moduleId: moduleIds[i],
            prompt,
            documentText,
            language,
          }),
        })
        const fillData = await fill.json()
        if (!fill.ok) {
          setFailedModule(i)
          throw new Error(fillData.error || `Module ${i + 1} failed`)
        }
      }
      router.push(`/teach/courses/${courseId}/studio`)
    } catch (e: any) {
      setError(e?.message || 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  const generate = async () => {
    if (!outline) return
    setPhase('building')
    setLoading(true)
    setProgress(['Creating course draft…'])
    setError('')
    try {
      const draftRes = await fetch('/api/ai/generate-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'draft', outline, language }),
      })
      const draft = await draftRes.json()
      if (!draftRes.ok) throw new Error(draft.error || 'Draft failed')
      const moduleIds: string[] = draft.moduleIds || []
      setDraftCourseId(draft.courseId)
      setDraftModuleIds(moduleIds)
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `/teach/create?courseId=${draft.courseId}`)
      }
      await fillFrom(draft.courseId, moduleIds, 0)
    } catch (e: any) {
      setError(e?.message || 'Generation failed')
      setPhase('outline')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-zinc-950 via-zinc-900 to-background text-white">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
        {phase === 'compose' && (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-bhutan-yellow">Pelbu Coursebox</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Create your course</h1>
            <p className="mt-2 text-sm text-zinc-300 sm:text-base">
              One prompt. Gemini drafts the structure, pages, quizzes, and scenarios.
            </p>

            {keyReady === false && (
              <div className="mt-6 rounded-xl border border-bhutan-yellow/40 bg-bhutan-yellow/10 p-4 text-sm">
                Add a Gemini API key before generating.{' '}
                <Link href="/settings#ai" className="font-semibold text-bhutan-yellow underline">
                  Settings → AI
                </Link>
              </div>
            )}

            <div
              className="mt-8 rounded-2xl border border-white/10 bg-zinc-900/80 p-3 shadow-2xl"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const file = e.dataTransfer.files?.[0]
                if (file) void extractFile(file).catch((err) => setError(err.message))
              }}
            >
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="What will you create?"
                rows={5}
                className="min-h-32 border-0 bg-transparent text-base text-white placeholder:text-zinc-500"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  value={language}
                  onChange={(e) => {
                    setLanguage(e.target.value)
                    localStorage.setItem('pelbu:create-language', e.target.value)
                  }}
                  className="min-h-11 rounded-full border border-white/15 bg-zinc-800 px-3 text-sm"
                >
                  {LANGS.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
                <div className="flex rounded-full border border-white/15 p-0.5">
                  {(['compact', 'standard', 'full'] as CourseSize[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSize(s)}
                      className={cn(
                        'min-h-11 rounded-full px-3 text-xs capitalize',
                        size === s ? 'bg-bhutan-yellow text-black' : 'text-zinc-300'
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/15">
                    <Paperclip className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => fileRef.current?.click()}>
                      Upload PDF, Word, PPT, or text
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void attachUrl()}>YouTube or web URL</DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        const text = window.prompt('Paste source text')
                        if (text) {
                          setDocumentText(text)
                          setSourceLabel('Pasted text')
                        }
                      }}
                    >
                      Paste text
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void extractFile(file).catch((err) => setError(err.message))
                  }}
                />
                <div className="ml-auto">
                  <Button
                    type="button"
                    className="min-h-11 rounded-full bg-bhutan-yellow text-black hover:bg-bhutan-orange"
                    disabled={loading || keyReady === false}
                    onClick={() => void design()}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              {sourceLabel && <p className="mt-2 px-2 text-xs text-zinc-400">Source: {sourceLabel}</p>}
              <p className="mt-1 px-2 text-xs text-zinc-500">{prompt.length} characters</p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className="min-h-11 rounded-full border border-white/15 px-3 text-xs text-zinc-200 hover:bg-white/10"
                  onClick={() => setPrompt(chip)}
                >
                  {chip}
                </button>
              ))}
            </div>
            <p className="mt-6 text-sm text-zinc-400">
              Prefer a blank form?{' '}
              <Link href="/teach/courses/new" className="text-bhutan-yellow underline">
                Create manually
              </Link>
            </p>
          </>
        )}

        {phase === 'outline' && outline && (
          <OutlineCanvas
            outline={outline}
            totals={totals}
            onChange={setOutline}
            onBack={() => setPhase('compose')}
            onGenerate={() => void generate()}
            onRefine={(instruction) => design(instruction)}
            loading={loading}
          />
        )}

        {phase === 'building' && (
          <div className="rounded-2xl border border-white/10 bg-zinc-900 p-6">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <Sparkles className="h-5 w-5 text-bhutan-yellow" /> Designing your course
            </h2>
            <ul className="mt-4 space-y-2 text-sm text-zinc-300">
              {progress.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {loading && <Loader2 className="mt-6 h-6 w-6 animate-spin text-bhutan-yellow" />}
            {failedModule !== null && draftCourseId && !loading && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="min-h-11 bg-bhutan-yellow text-black"
                  onClick={() => void fillFrom(draftCourseId, draftModuleIds, failedModule)}
                >
                  Retry module {(failedModule || 0) + 1}
                </Button>
                <Button type="button" variant="outline" className="min-h-11" onClick={() => setPhase('outline')}>
                  Back to outline
                </Button>
              </div>
            )}
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
      </div>
    </div>
  )
}
