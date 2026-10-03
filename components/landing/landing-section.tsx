import type { ReactNode } from 'react'
import { SegmentRule } from '@/components/landing/segment-rule'
import { cn } from '@/lib/utils'

/**
 * Locked homepage section. New landing blocks should use this so they keep
 * the same width, spacing, and divider as the rest of the page. Extra items
 * belong in a wrapping grid or a horizontal scroller inside the section.
 */
export function LandingSection({
  id,
  children,
  className,
}: {
  id?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section id={id} className={cn('mx-auto w-full min-w-0 max-w-6xl px-4 pt-8 sm:px-5', className)}>
      {children}
      <SegmentRule />
    </section>
  )
}
