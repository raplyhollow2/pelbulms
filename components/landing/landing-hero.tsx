'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createYoutubeIframe, getYoutubeId } from '@/lib/video-url'
import {
  DEFAULT_HERO_CTA_PRIMARY,
  DEFAULT_HERO_ROTATING_WORDS,
  DEFAULT_HERO_VIDEO_URL,
  type LandingStat,
} from '@/lib/landing-content'
import { LandingNav } from '@/components/landing/landing-nav'
import type { LandingCourse } from '@/components/landing/landing-catalog'

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
    const finish = () => {
      if (w.YT?.Player) resolve(w.YT)
    }
    const prev = w.onYouTubeIframeAPIReady
    w.onYouTubeIframeAPIReady = () => {
      if (typeof prev === 'function') prev()
      finish()
    }
    if (!document.querySelector(`script[src="${YT_API_SRC}"]`)) {
      const tag = document.createElement('script')
      tag.src = YT_API_SRC
      document.head.appendChild(tag)
    }
    const started = Date.now()
    const timer = window.setInterval(() => {
      if (w.YT?.Player) {
        window.clearInterval(timer)
        finish()
      } else if (Date.now() - started > 10000) {
        window.clearInterval(timer)
      }
    }, 50)
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
    const panel = host.parentElement
    const fit = () => {
      if (!panel) return
      const cw = panel.clientWidth
      const ch = panel.clientHeight
      if (!cw || !ch) return
      let width = cw
      let height = (width * 9) / 16
      if (height < ch) {
        height = ch
        width = (height * 16) / 9
      }
      host.style.width = `${Math.ceil(width)}px`
      host.style.height = `${Math.ceil(height)}px`
      host.style.left = `${(cw - width) / 2}px`
      host.style.top = `${(ch - height) / 2}px`
      host.style.transform = 'none'
      const iframe = host.querySelector('iframe')
      if (iframe instanceof HTMLIFrameElement) {
        iframe.setAttribute('width', String(Math.ceil(width)))
        iframe.setAttribute('height', String(Math.ceil(height)))
        iframe.style.width = `${Math.ceil(width)}px`
        iframe.style.height = `${Math.ceil(height)}px`
      }
    }
    fit()
    const observer = typeof ResizeObserver !== 'undefined' && panel ? new ResizeObserver(fit) : null
    observer?.observe(panel)

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

      host.replaceChildren()
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

      const iframe = createYoutubeIframe(videoId, playerVars)
      host.appendChild(iframe)

      const player = new YT.Player(iframe, {
        events: {
          onReady: (event: any) => {
            try {
              const w = host.clientWidth
              const h = host.clientHeight
              if (w && h && typeof event.target.setSize === 'function') {
                event.target.setSize(w, h)
              }
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
      observer?.disconnect()
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
      <div
        ref={mountRef}
        className="absolute"
      />
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
  secondaryCtaLabel,
  showCatalog = false,
  glassOpacity = 70,
  requireIdentity = true,
  fallbackImage,
  courses = [],
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
  secondaryCtaLabel?: string | null
  showCatalog?: boolean
  glassOpacity?: number
  requireIdentity?: boolean
  fallbackImage?: string | null
  courses?: LandingCourse[]
}) {
  const words = rotatingWords?.length ? rotatingWords : DEFAULT_HERO_ROTATING_WORDS
  const typed = useTypewriter(words)
  const resolvedVideo = videoUrl?.trim() || ''
  const primaryCta = ctaLabel?.trim() || DEFAULT_HERO_CTA_PRIMARY
  const secondaryCta = secondaryCtaLabel?.trim() || 'Browse courses'
  const glass = Math.min(90, Math.max(20, Math.round(glassOpacity))) / 100

  const defaultHeadlinePrefix = 'Advanced learning for'
  const resolvedDescription =
    description ||
    (requireIdentity
      ? `${siteName} is Bhutan's private learning platform — identity-verified access, world-class courses, progress tracking, and recognised certificates.`
      : `${siteName} is Bhutan's learning platform — world-class courses, progress tracking, and recognised certificates.`)

  return (
    <div className="relative h-[100svh] bg-background text-foreground">
      <section className="absolute inset-0 overflow-hidden bg-neutral-100">
        <div className="absolute inset-0 overflow-hidden">
          {resolvedVideo ? (
            <HeroVideoBackground
              videoUrl={resolvedVideo}
              startSeconds={videoStartSeconds ?? 0}
              endSeconds={videoEndSeconds ?? null}
              preferredQuality={videoQuality}
            />
          ) : fallbackImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fallbackImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-bhutan-yellow/40 to-bhutan-orange/30" />
          )}
        </div>

        <div className="relative z-10 flex h-full items-end p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 lg:p-10">
            <div
              className="w-full max-w-sm rounded-lg border border-white/50 p-3.5 text-neutral-900 shadow-2xl backdrop-blur-xl sm:p-4"
              style={{ backgroundColor: `rgb(255 255 255 / ${glass})` }}
            >
              {(tagline || requireIdentity) && (
                <p className="text-xs font-semibold uppercase tracking-widest text-bhutan-orange">
                  {tagline ||
                    (requireIdentity
                      ? 'A verified learning network for Bhutan'
                      : 'A learning network for Bhutan')}
                </p>
              )}
              <h1 className="mt-2 text-xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-2xl">
                {headline ? (
                  headline
                ) : (
                  <>
                    <span className="block">{defaultHeadlinePrefix}</span>
                    <span className="mt-1 block text-bhutan-orange">{typed || '\u00A0'}</span>
                  </>
                )}
              </h1>
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-neutral-600">
                {resolvedDescription}
              </p>
              <div className="mt-3 flex flex-nowrap items-center gap-1.5">
                <Button
                  size="sm"
                  className="h-8 shrink gap-1 rounded-full bg-bhutan-yellow px-3 text-xs font-bold text-black hover:bg-bhutan-orange"
                  render={<Link href="/auth/login" />}
                >
                  {primaryCta}
                  <ArrowRight className="h-4 w-4" />
                </Button>
                {showCatalog ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 shrink rounded-full border-white/70 bg-white/60 px-3 text-xs font-bold text-neutral-900 hover:bg-white/80"
                    render={<Link href="#courses" />}
                  >
                    {secondaryCta}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
      </section>
      <LandingNav siteName={siteName} courses={courses} glassOpacity={glassOpacity} />
    </div>
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
