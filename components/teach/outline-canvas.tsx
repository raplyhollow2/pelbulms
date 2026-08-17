'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { CourseOutline } from '@/lib/ai-course-builder'
import { outlineTotals } from '@/lib/ai-course-builder'
import { ArrowLeft, ArrowDown, ArrowUp, Loader2, Sparkles, Undo2 } from 'lucide-react'

export function OutlineCanvas({
  outline,
  totals,
  onChange,
  onBack,
  onGenerate,
  onRefine,
  loading,
}: {
  outline: CourseOutline
  totals?: ReturnType<typeof outlineTotals>
  onChange: (next: CourseOutline) => void
  onBack: () => void
  onGenerate: () => void
  onRefine?: (instruction: string) => Promise<void>
  loading?: boolean
}) {
  const stats = totals || outlineTotals(outline)
  const [history, setHistory] = useState<CourseOutline[]>([])
  const [refine, setRefine] = useState('')
  const [open, setOpen] = useState<number | null>(0)

  const push = (next: CourseOutline) => {
    setHistory((h) => [...h, outline].slice(-20))
    onChange(next)
  }

  const undo = () => {
    const prev = history[history.length - 1]
    if (!prev) return
    setHistory((h) => h.slice(0, -1))
    onChange(prev)
  }

  const updateModule = (index: number, title: string) => {
    const modules = outline.modules.map((m, i) => (i === index ? { ...m, title } : m))
    push({ ...outline, modules })
  }

  const removeModule = (index: number) => {
    push({ ...outline, modules: outline.modules.filter((_, i) => i !== index) })
  }

  const moveModule = (index: number, dir: -1 | 1) => {
    const next = index + dir
    if (next < 0 || next >= outline.modules.length) return
    const modules = [...outline.modules]
    const [row] = modules.splice(index, 1)
    modules.splice(next, 0, row)
    push({ ...outline, modules })
  }

  return (
    <div className="space-y-5 text-zinc-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="ghost" className="min-h-11 text-zinc-200" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <p className="text-sm text-zinc-300">
          {stats.sections} sections · {stats.pages} pages · {stats.quizzes} quizzes · {stats.assignments}{' '}
          assignments · ~{Math.round((stats.durationMinutes || 0) / 60)}h
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="min-h-11" disabled={!history.length} onClick={undo}>
            <Undo2 className="mr-2 h-4 w-4" />
            Undo
          </Button>
          <Button
            type="button"
            className="min-h-11 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
            disabled={loading}
            onClick={onGenerate}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Generate course
          </Button>
        </div>
      </div>

      <div>
        <Input
          value={outline.title}
          onChange={(e) => push({ ...outline, title: e.target.value })}
          className="h-12 border-white/15 bg-zinc-900 text-xl font-semibold"
        />
        <p className="mt-2 text-sm text-zinc-400">{outline.description}</p>
      </div>

      {onRefine && (
        <div className="rounded-xl border border-white/10 bg-zinc-900 p-3">
          <p className="mb-2 text-xs font-semibold uppercase text-zinc-400">Ask Pelbu</p>
          <Textarea
            value={refine}
            onChange={(e) => setRefine(e.target.value)}
            placeholder="Make it smaller / fewer quizzes / more scenarios…"
            rows={2}
            className="border-white/10 bg-zinc-800"
          />
          <Button
            type="button"
            variant="outline"
            className="mt-2 min-h-11"
            disabled={loading || !refine.trim()}
            onClick={() => {
              void onRefine(refine).then(() => setRefine(''))
            }}
          >
            Update outline
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {outline.modules.map((mod, i) => (
          <div key={`${mod.title}-${i}`} className="rounded-xl border border-white/10 bg-zinc-900 p-4">
            <div className="flex items-center gap-2">
              <Input
                value={mod.title}
                onChange={(e) => updateModule(i, e.target.value)}
                className="min-h-11 border-white/10 bg-zinc-800"
              />
              <Button type="button" variant="ghost" className="min-h-11" onClick={() => moveModule(i, -1)}>
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" className="min-h-11" onClick={() => moveModule(i, 1)}>
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" className="min-h-11" onClick={() => removeModule(i)}>
                Remove
              </Button>
            </div>
            <button
              type="button"
              className="mt-2 text-xs text-bhutan-yellow"
              onClick={() => setOpen(open === i ? null : i)}
            >
              {open === i ? 'Hide pages' : 'Show pages'}
            </button>
            {open === i && (
              <div className="mt-3 space-y-2">
                {mod.lessons.map((les, j) => (
                  <div key={`${les.title}-${j}`} className="rounded-lg bg-zinc-800/80 p-3">
                    <p className="text-sm font-medium">{les.title}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(les.blocks || []).map((b) => (
                        <Badge key={b} variant="secondary" className="capitalize">
                          {b}
                        </Badge>
                      ))}
                      {les.hasQuiz && <Badge>Quiz</Badge>}
                      {les.hasAssignment && <Badge>Assignment</Badge>}
                      {les.hasScenario && <Badge>Scenario</Badge>}
                      {les.hasFlashcards && <Badge>Flashcards</Badge>}
                      <span className="text-xs text-zinc-400">
                        {(les.blocks?.length || 0) +
                          Number(!!les.hasQuiz) +
                          Number(!!les.hasAssignment) +
                          Number(!!les.hasScenario)}{' '}
                        blocks
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
