'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, LogIn, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'

const ROTATING = ['Modern Bhutan', 'Every Learner', 'Future Leaders', 'Gelephu', 'Our Nation']

function useTypewriter(words: string[]) {
  const [index, setIndex] = useState(0)
  const [text, setText] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const current = words[index % words.length]
    // Typing: 70ms/char, deleting: 40ms/char, pause at full word.
    const atFull = !deleting && text === current
    const atEmpty = deleting && text === ''

    let delay = deleting ? 45 : 80
    if (atFull) delay = 1600
    if (atEmpty) delay = 300

    const timer = setTimeout(() => {
      if (atFull) {
        setDeleting(true)
        return
      }
      if (atEmpty) {
        setDeleting(false)
        setIndex((i) => (i + 1) % words.length)
        return
      }
      const next = deleting
        ? current.slice(0, text.length - 1)
        : current.slice(0, text.length + 1)
      setText(next)
    }, delay)

    return () => clearTimeout(timer)
  }, [text, deleting, index, words])

  return text
}

export function LandingHero() {
  const typed = useTypewriter(ROTATING)

  return (
    <section className="relative overflow-hidden">
      {/* Ambient luxury backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_36rem_at_80%_-10%,rgba(255,199,44,0.16),transparent_60%),radial-gradient(50rem_32rem_at_-5%_20%,rgba(255,107,53,0.12),transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.04] [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:44px_44px]"
      />

      {/* Top nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-bhutan-yellow to-bhutan-orange shadow-brand">
            <BookGlyph className="h-5 w-5 text-black" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Pelbu LMS</span>
        </Link>
        <nav className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 rounded-full"
            render={<Link href="/auth/login" />}
          >
            <LogIn className="h-4 w-4" />
            Sign in
          </Button>
          <Button
            size="sm"
            className="gap-1.5 rounded-full bg-foreground text-background hover:bg-foreground/90"
            render={<Link href="/auth/login" />}
          >
            Get started
            <ArrowRight className="h-4 w-4" />
          </Button>
        </nav>
      </header>

      {/* Hero body */}
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-8 md:pb-24 md:pt-14 lg:grid-cols-2">
        <div className="max-w-xl">
          <span className="reveal reveal-1 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <ShieldCheck className="h-3.5 w-3.5 text-bhutan-orange" />
            A verified, closed learning network for Bhutan
          </span>

          <h1 className="reveal reveal-2 mt-5 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
            Advanced learning for
            <span className="mt-1 block">
              <span className="bg-gradient-to-r from-bhutan-yellow via-bhutan-orange to-bhutan-red bg-clip-text text-transparent">
                {typed || '\u00A0'}
              </span>
              <span className="caret-blink ml-0.5 inline-block h-[0.9em] w-[3px] translate-y-[2px] rounded-full bg-bhutan-orange align-middle" />
            </span>
          </h1>

          <p className="reveal reveal-3 mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
            Pelbu LMS is Bhutan&apos;s private learning platform — identity-verified access,
            world-class courses, progress tracking, and recognised certificates. Built for
            students, teachers and institutions shaping the nation&apos;s future.
          </p>

          <div className="reveal reveal-4 mt-8 flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              className="group h-12 gap-2 rounded-full bg-gradient-to-r from-bhutan-yellow to-bhutan-orange px-6 text-sm font-semibold text-black shadow-brand hover:opacity-95"
              render={<Link href="/auth/login" />}
            >
              Create your account
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 gap-2 rounded-full border-border/70 px-6 text-sm font-semibold"
              render={<Link href="/auth/login" />}
            >
              <LogIn className="h-4 w-4" />
              Sign in
            </Button>
          </div>

          <dl className="reveal reveal-5 mt-10 grid max-w-md grid-cols-3 gap-6">
            {[
              { v: '500+', l: 'Learners' },
              { v: '100+', l: 'Courses' },
              { v: '20', l: 'Dzongkhags' },
            ].map((s) => (
              <div key={s.l}>
                <dt className="text-2xl font-semibold tracking-tight sm:text-3xl">{s.v}</dt>
                <dd className="mt-0.5 text-xs text-muted-foreground">{s.l}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Animated SVG visual */}
        <div className="reveal reveal-3 relative mx-auto w-full max-w-md lg:max-w-none">
          <HeroVisual />
        </div>
      </div>
    </section>
  )
}

function BookGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11a2 2 0 0 1 2 2v13a1.5 1.5 0 0 0-1.5-1.5H5.5A1.5 1.5 0 0 1 4 16V5.5Z"
        fill="currentColor"
        opacity="0.9"
      />
      <path
        d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13a2 2 0 0 0-2 2v13a1.5 1.5 0 0 1 1.5-1.5h6A1.5 1.5 0 0 0 20 16V5.5Z"
        fill="currentColor"
      />
    </svg>
  )
}

/** Pure-CSS/SMIL animated hero graphic — no runtime JS, GPU friendly. */
function HeroVisual() {
  return (
    <div className="relative aspect-square w-full">
      <svg
        viewBox="0 0 400 400"
        className="h-full w-full"
        role="img"
        aria-label="Animated illustration of a connected learning network"
      >
        <defs>
          <linearGradient id="g-brand" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFC72C" />
            <stop offset="1" stopColor="#FF6B35" />
          </linearGradient>
          <radialGradient id="g-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#FF6B35" stopOpacity="0.25" />
            <stop offset="1" stopColor="#FF6B35" stopOpacity="0" />
          </radialGradient>
          <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* Halo */}
        <circle cx="200" cy="200" r="180" fill="url(#g-halo)" className="animate-pulse-glow" />

        {/* Orbit rings */}
        <g className="animate-orbit" style={{ transformOrigin: '200px 200px' }}>
          <circle
            cx="200"
            cy="200"
            r="140"
            fill="none"
            stroke="url(#g-brand)"
            strokeOpacity="0.35"
            strokeWidth="1.5"
            strokeDasharray="6 10"
          />
          <circle cx="60" cy="200" r="7" fill="#FFC72C" />
          <circle cx="340" cy="200" r="5" fill="#FF6B35" />
        </g>
        <g className="animate-orbit-reverse" style={{ transformOrigin: '200px 200px' }}>
          <circle
            cx="200"
            cy="200"
            r="100"
            fill="none"
            stroke="url(#g-brand)"
            strokeOpacity="0.5"
            strokeWidth="1.5"
          />
          <circle cx="200" cy="100" r="6" fill="#FF6B35" />
          <circle cx="200" cy="300" r="4" fill="#FFC72C" />
        </g>

        {/* Central card */}
        <g className="animate-float" style={{ transformOrigin: '200px 200px' }}>
          <rect
            x="140"
            y="150"
            width="120"
            height="100"
            rx="18"
            fill="url(#g-brand)"
            filter="url(#soft)"
            opacity="0.35"
          />
          <rect x="140" y="150" width="120" height="100" rx="18" fill="url(#g-brand)" />
          <g stroke="#1A1A1A" strokeOpacity="0.55" strokeWidth="4" strokeLinecap="round">
            <line x1="162" y1="182" x2="238" y2="182" />
            <line x1="162" y1="200" x2="222" y2="200" />
            <line x1="162" y1="218" x2="210" y2="218" />
          </g>
        </g>

        {/* Floating chips */}
        <g className="animate-float-slow">
          <g transform="translate(70 96)">
            <rect width="66" height="30" rx="15" fill="#fff" opacity="0.9" />
            <circle cx="18" cy="15" r="7" fill="#FFC72C" />
            <rect x="30" y="11" width="28" height="8" rx="4" fill="#1A1A1A" opacity="0.25" />
          </g>
        </g>
        <g className="animate-float">
          <g transform="translate(258 268)">
            <rect width="72" height="30" rx="15" fill="#fff" opacity="0.9" />
            <circle cx="18" cy="15" r="7" fill="#FF6B35" />
            <rect x="30" y="11" width="34" height="8" rx="4" fill="#1A1A1A" opacity="0.25" />
          </g>
        </g>
      </svg>
    </div>
  )
}
