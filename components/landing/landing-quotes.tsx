'use client'
import { Button } from '@/components/ui/button'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronLeft, ChevronRight, Star } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LandingSection } from '@/components/landing/landing-section'
import type { LandingQuote } from '@/lib/landing-content'

function reviewerInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')
}

function QuoteCard({ quote }: { quote: LandingQuote }) {
  return (
    <figure className="flex h-full min-w-0 flex-col rounded-lg border border-border bg-background p-5">
      <span className="font-serif text-5xl leading-none text-foreground" aria-hidden>
        “
      </span>
      <blockquote className="mt-3 flex-1 text-sm leading-relaxed">{quote.quote}</blockquote>
      <figcaption className="mt-6 flex items-center gap-3">
        <Avatar className="size-10">
          {quote.avatar_url ? <AvatarImage src={quote.avatar_url} alt="" /> : null}
          <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
            {reviewerInitials(quote.name) || 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{quote.name}</p>
          {quote.role ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{quote.role}</p> : null}
        </div>
      </figcaption>
      {quote.course_id ? (
        <Link
          href={`/courses/${quote.course_id}`}
          className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary"
        >
          View this course
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}
    </figure>
  )
}

export function LandingQuotes({
  title,
  quotes,
}: {
  title: string
  quotes: LandingQuote[]
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  if (!quotes.length) return null

  function go(next: number) {
    const row = scroller.current
    if (!row) return
    const wrapped = (next + quotes.length) % quotes.length
    setIndex(wrapped)
    row.scrollTo({ left: wrapped * row.clientWidth, behavior: 'smooth' })
  }

  return (
    <LandingSection>
      <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      <div className="mt-8 hidden min-w-0 gap-4 lg:grid lg:grid-cols-4">
        {quotes.map((quote) => (
          <QuoteCard key={`${quote.name}-${quote.role}-${quote.quote.slice(0, 24)}`} quote={quote} />
        ))}
      </div>
      <div className="relative mx-auto mt-6 min-w-0 max-w-lg lg:hidden">
        <div
          ref={scroller}
          className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={(event) => {
            const row = event.currentTarget
            if (!row.clientWidth) return
            const next = Math.round(row.scrollLeft / row.clientWidth)
            setIndex(Math.min(quotes.length - 1, Math.max(0, next)))
          }}
        >
          {quotes.map((quote) => (
            <figure
              key={`${quote.name}-${quote.role}-${quote.quote.slice(0, 24)}`}
              className="w-full shrink-0 snap-center px-8"
            >
              <div className="rounded-2xl border border-border/70 bg-card px-5 py-6 shadow-sm">
                <div className="flex gap-0.5 text-primary" aria-label={`${quote.stars} out of 5 stars`}>
                  {Array.from({ length: 5 }).map((_, star) => (
                    <Star
                      key={star}
                      className={`h-4 w-4 ${star < quote.stars ? 'fill-current' : 'text-border'}`}
                    />
                  ))}
                </div>
                <blockquote className="mt-4 text-base leading-relaxed text-foreground">“{quote.quote}”</blockquote>
                <figcaption className="mt-5 flex items-center gap-3 border-t border-border/60 pt-4">
                  <Avatar className="size-10 bg-primary">
                    {quote.avatar_url ? <AvatarImage src={quote.avatar_url} alt="" /> : null}
                    <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                      {reviewerInitials(quote.name) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{quote.name}</p>
                    {quote.role ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{quote.role}</p> : null}
                  </div>
                </figcaption>
              </div>
            </figure>
          ))}
        </div>
        {quotes.length > 1 ? (
          <>
            <Button
              type="button"
              aria-label="Previous review"
              className="absolute left-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background shadow-sm"
              onClick={() => go(index - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              aria-label="Next review"
              className="absolute right-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background shadow-sm"
              onClick={() => go(index + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="mt-4 flex justify-center gap-1.5">
              {quotes.map((quote, dot) => (
                <Button
                  key={`${quote.name}-${dot}`}
                  type="button"
                  aria-label={`Show review ${dot + 1}`}
                  className={`h-1.5 rounded-full ${dot === index ? 'w-5 bg-primary' : 'w-1.5 bg-border'}`}
                  onClick={() => go(dot)}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </LandingSection>
  )
}
