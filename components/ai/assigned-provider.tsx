'use client'

import { useEffect, useState } from 'react'
import type { AiFeature, LlmProvider } from '@/lib/ai/models'
import { cn } from '@/lib/utils'

export function AssignedProviderNote({
  feature,
  tone = 'light',
  className,
}: {
  feature: AiFeature
  tone?: 'light' | 'dark'
  className?: string
}) {
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch('/api/ai/models')
      .then((res) => res.json())
      .then((json) => {
        const provider = json.routes?.[feature] as LlmProvider | undefined
        const next = provider ? json.labels?.[provider] : null
        if (!cancelled) setLabel(next || null)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [feature])

  if (!label) return null
  return (
    <p className={cn('text-xs', tone === 'dark' ? 'text-zinc-400' : 'text-muted-foreground', className)}>
      School AI: {label}
    </p>
  )
}
