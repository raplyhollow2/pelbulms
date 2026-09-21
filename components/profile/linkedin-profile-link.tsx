'use client'

import { cn } from '@/lib/utils'
import { normalizeLinkedInUrl } from '@/lib/social-links'

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn('h-4 w-4 shrink-0 fill-current', className)}
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 11-.001-4.124 2.062 2.062 0 01.001 4.124zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

export function LinkedInProfileLink({
  url,
  className,
  label = 'LinkedIn profile',
  compact = false,
}: {
  url?: string | null
  className?: string
  label?: string
  compact?: boolean
}) {
  const href = normalizeLinkedInUrl(url)
  if (!href) return null

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      className={cn(
        'inline-flex items-center gap-1.5 text-sm font-medium text-[#0A66C2] hover:underline',
        compact && 'rounded-md p-1.5 hover:bg-[#0A66C2]/10 hover:no-underline',
        className
      )}
      aria-label={label}
    >
      <LinkedInIcon />
      {compact ? <span className="sr-only">{label}</span> : <span>{label}</span>}
    </a>
  )
}
