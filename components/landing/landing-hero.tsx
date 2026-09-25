'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getYoutubeId } from '@/lib/video-url'
import {
  DEFAULT_HERO_CTA_PRIMARY,
  DEFAULT_HERO_ROTATING_WORDS,
  DEFAULT_HERO_VIDEO_URL,
  type LandingStat,
} from '@/lib/landing-content'

function useTypewriter(words: string[]) {
  const [index, setIndex] = useState(0)
  const [text, setText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const safeWords = words.length ? words : DEFAULT_HERO_ROTATING_WORDS

  useEffect(() => {
    const current = safeWords[index % safeWords.length]
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
        setIndex((i) => (i + 1) % safeWords.length)
        return
      }
      const next = deleting
        ? current.slice(0, text.length - 1)
        : current.slice(0, text.length + 1)
      setText(next)
    }, delay)

    return () => clearTimeout(timer)
  }, [text, deleting, index, safeWords])

  return text
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return reduced
}

const YT_API_SRC = 'https://www.youtube.com/iframe_api'

let ytApiPromise: Promise<any> | null = null
function loadYouTubeApi(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  const w = window as any
  if (w.YT?.Player) return Promise.resolve(w.YT)
  if (ytApiPromise) return ytApiPromise

  ytApiPromise = new Promise((resolve) => {
    const prev = w.onYouTubeIframeAPIReady
    w.onYouTubeIframeAPIReady = () => {
      if (typeof prev === 'function') prev()
      resolve(w.YT)
    }
    if (!document.querySelector(`script[src="${YT_API_SRC}"]`)) {
      const tag = document.createElement('script')
      tag.src = YT_API_SRC
      document.head.appendChild(tag)
    } else if (w.YT?.Player) {
      resolve(w.YT)
    }
  })
  return ytApiPromise
}

function HeroVideoBackground({
  videoUrl,
  startSeconds = 0,
  endSeconds = null,
  preferredQuality = 'high',
}: {
  videoUrl: string
  startSeconds?: number
  endSeconds?: number | null
  preferredQuality?: 'auto' | 'high' | 'max'
}) {
  const reducedMotion = usePrefersReducedMotion()
  const mountRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<any>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const start = Math.max(0, Math.floor(startSeconds || 0))
  const end =
    endSeconds != null && Number.isFinite(endSeconds) && endSeconds > start
      ? Math.floor(endSeconds)
      : null

  const videoId = useMemo(
    () => getYoutubeId(videoUrl) || getYoutubeId(DEFAULT_HERO_VIDEO_URL),
    [videoUrl]
  )
  const poster = videoId
    ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
    : undefined

  // Always paint a visible base (poster or dark gradient) — never rely on iframe alone.
  const baseStyle = poster
    ? { backgroundImage: `url(${poster})` }
    : {
        backgroundImage:
          'linear-gradient(135deg, #1a1208 0%, #3d2314 45%, #0a0a0a 100%)',
      }

  const ytQuality =
    preferredQuality === 'max'
      ? 'hd1080'
      : preferredQuality === 'auto'
        ? 'medium'
        : 'hd720'

  useEffect(() => {
    if (!videoId || reducedMotion || !mountRef.current) return

    let cancelled = false
    const host = mountRef.current

    const restartClip = (player: any) => {
      try {
        player.seekTo(start, true)
        player.playVideo()
      } catch {
        /* ignore */
      }
    }

    const applyQuality = (player: any) => {
      try {
        if (typeof player.setPlaybackQuality === 'function') {
          player.setPlaybackQuality(ytQuality)
        }
        if (typeof player.setPlaybackQualityRange === 'function') {
          player.setPlaybackQualityRange(ytQuality, preferredQuality === 'max' ? 'highres' : ytQuality)
        }
      } catch {
        /* ignore — YouTube may ignore quality hints */
      }
    }

    loadYouTubeApi().then((YT) => {
      if (cancelled || !host) return

      if (playerRef.current) {
        try {
          playerRef.current.destroy()
        } catch {
          /* ignore */
        }
        playerRef.current = null
      }

      // YT.Player replaces the target node; always inject a fresh child.
      host.replaceChildren()
      const target = document.createElement('div')
      target.className = 'h-full w-full'
      host.appendChild(target)

      const playerVars: Record<string, number | string> = {
        autoplay: 1,
        mute: 1,
        controls: 0,
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
        showinfo: 0,
        iv_load_policy: 3,
        disablekb: 1,
        fs: 0,
        start,
      }
      // Native loop only works for the full video; clip loops are handled below.
      if (end == null && start === 0) {
        playerVars.loop = 1
        playerVars.playlist = videoId
      }

      const player = new YT.Player(target, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars,
        events: {
          onReady: (event: any) => {
            try {
              event.target.mute()
              applyQuality(event.target)
              event.target.seekTo(start, true)
              event.target.playVideo()
            } catch {
              /* ignore */
            }
          },
          onStateChange: (event: any) => {
            // 0 = ENDED — restart clip (needed when end is set or start > 0)
            if (event.data === 0) restartClip(event.target)
            if (event.data === 1) applyQuality(event.target)
          },
        },
      })
      playerRef.current = player

      // Poll so we restart at `end` before YouTube fires ENDED (end param can be flaky).
      if (end != null) {
        pollRef.current = setInterval(() => {
          const p = playerRef.current
          if (!p?.getCurrentTime) return
          try {
            const t = p.getCurrentTime()
            if (typeof t === 'number' && t >= end - 0.15) restartClip(p)
          } catch {
            /* ignore */
          }
        }, 250)
      }
    })

    return () => {
      cancelled = true
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
      if (playerRef.current) {
        try {
          playerRef.current.destroy()
        } catch {
          /* ignore */
        }
        playerRef.current = null
      }
    }
  }, [videoId, reducedMotion, start, end, ytQuality, preferredQuality])

  if (!videoId || reducedMotion) {
    return (
      <div
        aria-hidden
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={baseStyle}
      />
    )
  }

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center" style={baseStyle} />
      <div className="absolute left-1/2 top-1/2 aspect-video h-[max(100%,56.25vw)] w-[max(100%,177.78vh)] -translate-x-1/2 -translate-y-1/2 scale-[1.2] overflow-hidden">
        <div ref={mountRef} className="h-full w-full [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:border-0" />
      </div>
    </div>
  )
}

export function LandingHero({
  siteName = 'Pelbu LMS',
  tagline,
  headline,
  description,
  videoUrl,
  videoStartSeconds,
  videoEndSeconds,
  videoQuality = 'high',
  rotatingWords,
  ctaLabel,
  requireIdentity = true,
}: {
  siteName?: string
  tagline?: string | null
  headline?: string | null
  description?: string | null
  videoUrl?: string | null
  videoStartSeconds?: number | null
  videoEndSeconds?: number | null
  videoQuality?: 'auto' | 'high' | 'max'
  rotatingWords?: string[]
  ctaLabel?: string | null
  requireIdentity?: boolean
}) {
  const words = rotatingWords?.length ? rotatingWords : DEFAULT_HERO_ROTATING_WORDS
  const typed = useTypewriter(words)
  const resolvedVideo = videoUrl?.trim() || DEFAULT_HERO_VIDEO_URL
  const primaryCta = ctaLabel?.trim() || DEFAULT_HERO_CTA_PRIMARY

  const defaultHeadlinePrefix = 'Advanced learning for'
  const resolvedDescription =
    description ||
    (requireIdentity
      ? `${siteName} is Bhutan's private learning platform — identity-verified access, world-class courses, progress tracking, and recognised certificates. Built for students, teachers and institutions shaping the nation's future.`
      : `${siteName} is Bhutan's learning platform — world-class courses, progress tracking, and recognised certificates. Built for students, teachers and institutions shaping the nation's future.`)

  return (
    <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-[#0a0a0a] text-white">
      <HeroVideoBackground
        videoUrl={resolvedVideo}
        startSeconds={videoStartSeconds ?? 0}
        endSeconds={videoEndSeconds ?? null}
        preferredQuality={videoQuality}
      />

      {/* Soft cinematic scrim — above video, below content */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(180deg,rgba(10,10,10,0.75)_0%,rgba(10,10,10,0.5)_42%,rgba(10,10,10,0.82)_100%),radial-gradient(60rem_36rem_at_80%_-10%,rgba(255,199,44,0.2),transparent_60%),radial-gradient(50rem_32rem_at_-5%_80%,rgba(255,107,53,0.18),transparent_55%)]"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-5 sm:py-5">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-bhutan-yellow to-bhutan-orange shadow-brand">
            <BookGlyph className="h-5 w-5 text-white" />
          </span>
          <span className="truncate text-base font-semibold tracking-tight text-white sm:text-lg">{siteName}</span>
        </Link>
        <nav className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 rounded-full text-white/90 hover:bg-white/10 hover:text-white"
            render={<Link href="/auth/login" />}
          >
            <LogIn className="h-4 w-4" />
            Sign in
          </Button>
        </nav>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 pb-16 pt-8 sm:px-5 sm:pb-20 sm:pt-10 md:pb-28 md:pt-16">
        <div className="max-w-2xl">
          {(tagline || requireIdentity) && (
            <p className="reveal reveal-1 text-sm font-medium tracking-wide text-white/70">
              {tagline ||
                (requireIdentity
                  ? 'A verified, closed learning network for Bhutan'
                  : 'A learning network for Bhutan')}
            </p>
          )}

          <h1 className="reveal reveal-2 mt-4 text-[2.125rem] font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
            {headline ? (
              headline
            ) : (
              <>
                {defaultHeadlinePrefix}
                <span className="mt-1 block">
                  <span className="bg-gradient-to-r from-bhutan-yellow via-bhutan-orange to-[#ff8f6b] bg-clip-text text-transparent">
                    {typed || '\u00A0'}
                  </span>
                  <span className="caret-blink ml-0.5 inline-block h-[0.9em] w-[3px] translate-y-[2px] rounded-full bg-bhutan-orange align-middle" />
                </span>
              </>
            )}
          </h1>

          {headline && words.length > 0 ? (
            <p className="reveal reveal-2 mt-3 text-xl font-medium tracking-tight text-bhutan-yellow sm:text-2xl md:text-3xl">
              <span>{typed || '\u00A0'}</span>
              <span className="caret-blink ml-0.5 inline-block h-[0.85em] w-[3px] translate-y-[2px] rounded-full bg-bhutan-orange align-middle" />
            </p>
          ) : null}

          <p className="reveal reveal-3 mt-5 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
            {resolvedDescription}
          </p>

          <div className="reveal reveal-4 mt-8">
            <Button
              size="lg"
              className="group h-12 w-full gap-2 rounded-full bg-gradient-to-r from-bhutan-yellow to-bhutan-orange px-7 text-sm font-semibold text-black shadow-brand hover:opacity-95 sm:w-auto"
              render={<Link href="/auth/login" />}
            >
              {primaryCta}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

export function LandingStatsStrip({
  stats,
  eyebrow,
}: {
  stats: LandingStat[]
  eyebrow?: string
}) {
  if (!stats.length) return null
  return (
    <section className="border-b border-border/50 bg-muted/20">
      <div className="mx-auto max-w-6xl px-5 py-12 md:py-16">
        {eyebrow ? (
          <p className="mb-6 text-sm font-semibold uppercase tracking-widest text-bhutan-orange">
            {eyebrow}
          </p>
        ) : null}
        <dl className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-8 md:gap-10">
          {stats.map((s) => (
            <div key={s.label} className="text-center sm:text-left">
              <dt className="text-3xl font-semibold tracking-tight md:text-4xl">{s.value}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{s.label}</dd>
            </div>
          ))}
        </dl>
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
