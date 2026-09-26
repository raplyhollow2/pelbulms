'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Sparkles } from 'lucide-react'
import { ModelPicker } from '@/components/ai/model-picker'
import { StructureProposal } from '@/components/ai/structure-proposal'
import type { CourseStructureProposal } from '@/lib/ai/course-structure'
import type { ModelFamily } from '@/lib/ai/models'
import { cn } from '@/lib/utils'

const CHIPS = [
  'Rewrite this page more clearly',
  'Make the English simpler',
  'Add a short quiz',
  'Add flip cards',
  'Add an educational image',
  'Add AI avatar video',
]

const STRUCTURE_CHIPS = [
  'Quiz is too late in the course',
  'Split the longest module',
  'Add learning outcomes',
  'Balance practice across modules',
]

export function AskPelbuRail({
  courseId,
  lessonId,
  onApplied,
  onStructureApplied,
}: {
  courseId: string
  lessonId?: string
  onApplied?: (blocks?: unknown) => void
  onStructureApplied?: () => void
}) {
  const [mode, setMode] = useState<'page' | 'structure'>('page')
  const [instruction, setInstruction] = useState('')
  const [log, setLog] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [family, setFamily] = useState<ModelFamily>('chatgpt')
  const familyTouched = useRef(false)
  const [proposal, setProposal] = useState<CourseStructureProposal | null>(null)
  const [proposalModel, setProposalModel] = useState<string>()
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetch('/api/ai/models')
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && !familyTouched.current && json.defaults?.['course-structure']) {
          setFamily(json.defaults['course-structure'])
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

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

  const propose = async (preset?: string) => {
    const text = (preset || instruction).trim()
    if (!text) return
    setLoading(true)
    try {
      const res = await fetch('/api/ai/structure-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'propose',
          courseId,
          instruction: text,
          family,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not propose a structure')
      setProposal(data.proposal)
      setProposalModel(data.model)
      setInstruction('')
    } catch (e: any) {
      setLog((prev) => [...prev, `Error: ${e?.message || 'Failed'}`])
    } finally {
      setLoading(false)
    }
  }

  const apply = async (acceptedModuleIndexes: number[]) => {
    if (!proposal) return
    setApplying(true)
    try {
      const res = await fetch('/api/ai/structure-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply',
          courseId,
          proposal,
          acceptedModuleIndexes,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not apply the structure')
      setProposal(null)
      setLog((prev) => [...prev, 'Pelbu: Structure applied. Existing page content was left in place.'])
      onStructureApplied?.()
    } catch (e: any) {
      setLog((prev) => [...prev, `Error: ${e?.message || 'Failed'}`])
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-bhutan-orange" />
          Ask Pelbu
        </div>
        <div className="flex rounded-full border border-border/70 p-0.5 text-xs">
          {(['page', 'structure'] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={cn(
                'rounded-full px-2 py-1 capitalize',
                mode === item ? 'bg-bhutan-yellow/30' : 'text-muted-foreground'
              )}
              onClick={() => setMode(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      {mode === 'structure' ? (
        <ModelPicker
          value={family}
          onChange={(next) => {
            familyTouched.current = true
            setFamily(next)
          }}
          disabled={loading}
        />
      ) : null}
      <div className="min-h-32 flex-1 space-y-2 overflow-y-auto rounded-lg border bg-muted/20 p-3 text-xs">
        {log.length === 0 && !proposal && (
          <p className="text-muted-foreground">
            {mode === 'structure'
              ? 'Propose a new module order, outcomes, or quiz placement. Nothing is saved until you apply.'
              : 'Rewrite, simplify English, add a quiz, add an image, or add an AI video.'}
          </p>
        )}
        {log.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
        {mode === 'structure' && proposal ? (
          <StructureProposal
            proposal={proposal}
            model={proposalModel}
            applying={applying}
            onDismiss={() => setProposal(null)}
            onApply={(indexes) => void apply(indexes)}
          />
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(mode === 'structure' ? STRUCTURE_CHIPS : CHIPS).map((chip) => (
          <Button
            key={chip}
            type="button"
            size="sm"
            variant="outline"
            className="min-h-11"
            disabled={loading}
            onClick={() => void (mode === 'structure' ? propose(chip) : send(chip))}
          >
            {chip}
          </Button>
        ))}
      </div>
      <Textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder={mode === 'structure' ? 'Describe the learners and the structure you want…' : 'Tell Pelbu what to change…'}
        rows={3}
      />
      <Button
        type="button"
        className="min-h-11 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
        disabled={loading}
        onClick={() => void (mode === 'structure' ? propose() : send())}
      >
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
        {mode === 'structure' ? 'Propose structure' : 'Send'}
      </Button>
    </div>
  )
}
