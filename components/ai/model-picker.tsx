'use client'

import { MODEL_FAMILIES, MODEL_FAMILY_IDS, type ModelFamily } from '@/lib/ai/models'
import { cn } from '@/lib/utils'

export function ModelPicker({
  value,
  onChange,
  disabled,
  className,
  tone = 'light',
}: {
  value: ModelFamily
  onChange: (family: ModelFamily) => void
  disabled?: boolean
  className?: string
  tone?: 'light' | 'dark'
}) {
  return (
    <div className={cn('flex flex-wrap gap-1', className)} role="group" aria-label="Model">
      {MODEL_FAMILY_IDS.map((id) => {
        const family = MODEL_FAMILIES[id]
        const active = value === id
        return (
          <button
            key={id}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            title={family.blurb}
            onClick={() => onChange(id)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50',
              tone === 'dark'
                ? active
                  ? 'border-bhutan-yellow bg-bhutan-yellow/20 text-white'
                  : 'border-white/20 text-zinc-300 hover:bg-white/10'
                : active
                  ? 'border-bhutan-orange/50 bg-bhutan-yellow/25 text-foreground'
                  : 'border-border/70 text-muted-foreground hover:bg-muted/60'
            )}
          >
            {family.label}
          </button>
        )
      })}
    </div>
  )
}
