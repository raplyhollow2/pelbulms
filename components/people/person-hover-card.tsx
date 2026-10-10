'use client'

import type { ReactNode } from 'react'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'

export function PersonHoverCard({
  name,
  email,
  lines = [],
  onOpen,
  children,
}: {
  name: string
  email?: string | null
  lines?: Array<string | null | undefined | false>
  onOpen?: () => void
  children?: ReactNode
}) {
  return (
    <HoverCard>
      <HoverCardTrigger
        render={
          <button
            type="button"
            className="max-w-full truncate text-left text-sm font-medium hover:underline"
            onClick={onOpen}
          />
        }
      >
        {children ?? name}
      </HoverCardTrigger>
      <HoverCardContent className="w-64 space-y-1 p-3 text-left">
        <p className="text-sm font-medium">{name}</p>
        {email ? <p className="truncate text-xs text-muted-foreground">{email}</p> : null}
        {lines.filter(Boolean).map((line) => (
          <p key={String(line)} className="text-xs text-muted-foreground">
            {line}
          </p>
        ))}
      </HoverCardContent>
    </HoverCard>
  )
}
