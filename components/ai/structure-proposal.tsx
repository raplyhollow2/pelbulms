'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { CourseStructureProposal } from '@/lib/ai/course-structure'
import { cn } from '@/lib/utils'

export function StructureProposal({
  proposal,
  model,
  applying,
  tone = 'light',
  onDismiss,
  onApply,
}: {
  proposal: CourseStructureProposal
  model?: string
  applying?: boolean
  tone?: 'light' | 'dark'
  onDismiss: () => void
  onApply: (acceptedModuleIndexes: number[]) => void
}) {
  const [accepted, setAccepted] = useState<number[]>(proposal.modules.map((_, index) => index))
  const dark = tone === 'dark'

  const toggle = (index: number) => {
    setAccepted((current) =>
      current.includes(index) ? current.filter((item) => item !== index) : [...current, index]
    )
  }

  return (
    <div
      className={cn(
        'space-y-3 rounded-xl border p-3',
        dark ? 'border-white/15 bg-zinc-900 text-zinc-100' : 'border-border bg-card'
      )}
    >
      <div>
        <p className={cn('text-sm font-semibold', dark && 'text-white')}>Proposed structure</p>
        <p className={cn('mt-1 text-xs', dark ? 'text-zinc-400' : 'text-muted-foreground')}>
          {proposal.summary}
          {model ? ` · ${model}` : ''}
        </p>
      </div>
      {proposal.learningObjectives.length ? (
        <ul className={cn('list-disc space-y-1 pl-4 text-xs', dark ? 'text-zinc-300' : 'text-muted-foreground')}>
          {proposal.learningObjectives.map((objective) => (
            <li key={objective}>{objective}</li>
          ))}
        </ul>
      ) : null}
      <div className="space-y-2">
        {proposal.modules.map((mod, index) => {
          const on = accepted.includes(index)
          return (
            <label
              key={`${mod.title}-${index}`}
              className={cn(
                'block rounded-lg border p-2 text-xs',
                dark ? 'border-white/10' : 'border-border/70',
                !on && 'opacity-50'
              )}
            >
              <span className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={on}
                  onChange={() => toggle(index)}
                />
                <span>
                  <span className="font-medium">{mod.title}</span>
                  {mod.description ? (
                    <span className={cn('mt-0.5 block', dark ? 'text-zinc-400' : 'text-muted-foreground')}>
                      {mod.description}
                    </span>
                  ) : null}
                  <span className={cn('mt-1 block', dark ? 'text-zinc-400' : 'text-muted-foreground')}>
                    {mod.lessons
                      .map((lesson) => `${lesson.action}: ${lesson.title}`)
                      .join(' · ')}
                  </span>
                </span>
              </span>
            </label>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={applying || !accepted.length}
          onClick={() => onApply(accepted)}
        >
          {applying ? 'Applying…' : 'Apply selected'}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={applying} onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  )
}
