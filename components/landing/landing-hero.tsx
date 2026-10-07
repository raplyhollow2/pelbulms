'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createYoutubeIframe, getYoutubeId, isDirectVideoFile, youtubePosterUrl } from '@/lib/video-url'
import {
  DEFAULT_HERO_CTA_PRIMARY,
  DEFAULT_HERO_ROTATING_WORDS,
  DEFAULT_HERO_VIDEO_URL,
  type HeroSlide,
  type LandingStat,
} from '@/lib/landing-content'
import { HeroStory } from '@/components/landing/hero-story'
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
  const poster =
    youtubePosterUrl(videoUrl) || youtubePosterUrl(DEFAULT_HERO_VIDEO_URL) || undefined

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

    // Poster is the LCP image. Start the player after the first paint so the
    // iframe API does not compete with it.
    const startPlayer = () => {
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

      const iframe = createYoutubeIframe(videoId, playerVars, { privacyEnhanced: true })
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
    }

    let idleId = 0
    let timerId = 0
    let started = false
    const begin = () => {
      if (started || cancelled) return
      started = true
      window.removeEventListener('pointerdown', begin)
      window.removeEventListener('keydown', begin)
      window.removeEventListener('scroll', begin)
      window.clearTimeout(fallbackId)
      if (typeof window.requestIdleCallback === 'function') {
        idleId = window.requestIdleCallback(startPlayer, { timeout: 1200 })
      } else {
        timerId = window.setTimeout(startPlayer, 400)
      }
    }
    // Keep the poster as the first paint. The player starts on the first
    // gesture, or shortly after, so it does not compete with that image.
    const fallbackId = window.setTimeout(begin, 12000)
    window.addEventListener('pointerdown', begin, { passive: true })
    window.addEventListener('keydown', begin)
    window.addEventListener('scroll', begin, { passive: true })

    return () => {
      cancelled = true
      window.removeEventListener('pointerdown', begin)
      window.removeEventListener('keydown', begin)
      window.removeEventListener('scroll', begin)
      window.clearTimeout(fallbackId)
      if (idleId) window.cancelIdleCallback(idleId)
      if (timerId) window.clearTimeout(timerId)
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

  const posterFrame = poster ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={poster}
      alt=""
      fetchPriority="high"
      decoding="async"
      className="absolute inset-0 h-full w-full object-cover object-center"
    />
  ) : (
    <div
      className="absolute inset-0"
      style={{ backgroundImage: 'linear-gradient(135deg, #1a1208 0%, #3d2314 45%, #0a0a0a 100%)' }}
    />
  )

  if (!videoId || reducedMotion) {
    return (
      <div aria-hidden className="absolute inset-0 z-0">
        {posterFrame}
      </div>
    )
  }

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {posterFrame}
      <div ref={mountRef} className="absolute" />
    </div>
  )
}

function DirectHeroVideo({
  src,
  startSeconds = 0,
  endSeconds = null,
}: {
  src: string
  startSeconds?: number
  endSeconds?: number | null
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const start = Math.max(0, Math.floor(startSeconds || 0))
  const end =
    endSeconds != null && Number.isFinite(endSeconds) && endSeconds > start
      ? Math.floor(endSeconds)
      : null
  const clipped = start > 0 || end != null

  useEffect(() => {
    const video = ref.current
    if (!video || !clipped) return

    const seekStart = () => {
      if (Math.abs(video.currentTime - start) > 0.25) {
        video.currentTime = start
      }
    }
    if (video.readyState >= 1) seekStart()
    const onTime = () => {
      if (end != null && video.currentTime >= end) {
        video.currentTime = start
        void video.play().catch(() => {})
      }
    }
    const onEnded = () => {
      video.currentTime = start
      void video.play().catch(() => {})
    }
    video.addEventListener('loadedmetadata', seekStart)
    video.addEventListener('timeupdate', onTime)
    video.addEventListener('ended', onEnded)
    return () => {
      video.removeEventListener('loadedmetadata', seekStart)
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('ended', onEnded)
    }
  }, [src, start, end, clipped])

  return (
    <video
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 h-full w-full object-contain object-top md:object-cover md:object-center"
      autoPlay
      muted
      loop={!clipped}
      playsInline
      preload="auto"
      src={src}
    />
  )
}

export function LandingHero({
  siteName = 'Rigbu LMS',
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
  requireIdentity = true,
  fallbackImage,
  courseTopics = [],
  heroSlides,
  siteNameForScene,
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
  requireIdentity?: boolean
  fallbackImage?: string | null
  courseTopics?: string[]
  heroSlides?: HeroSlide[]
  siteNameForScene?: string
}) {
  const words = rotatingWords?.length ? rotatingWords : DEFAULT_HERO_ROTATING_WORDS
  const typed = useTypewriter(words)
  const resolvedVideo = videoUrl?.trim() || ''
  const directVideo = isDirectVideoFile(resolvedVideo)
  const youtubeVideo = !directVideo && Boolean(getYoutubeId(resolvedVideo))
  const primaryCta = ctaLabel?.trim() || DEFAULT_HERO_CTA_PRIMARY
  const secondaryCta = secondaryCtaLabel?.trim() || 'Browse courses'
  const defaultHeadlinePrefix = 'Advanced learning for'
  const resolvedDescription =
    description ||
    (requireIdentity
      ? `${siteName} is Bhutan's private learning platform — identity-verified access, world-class courses, progress tracking, and recognised certificates.`
      : `${siteName} is Bhutan's learning platform — world-class courses, progress tracking, and recognised certificates.`)

  return (
    <div className="relative flex min-h-[calc(100svh-4.75rem)] flex-col bg-background text-foreground">
      <section className="relative flex flex-1 flex-col bg-[#2a1608]">
        <div className="relative aspect-[9/16] w-full overflow-hidden bg-[linear-gradient(165deg,#3a220c_0%,#1a1208_42%,#4a2a10_100%)] md:absolute md:inset-0 md:aspect-auto">
          {directVideo ? (
            <DirectHeroVideo
              src={resolvedVideo}
              startSeconds={videoStartSeconds ?? 0}
              endSeconds={videoEndSeconds ?? null}
            />
          ) : youtubeVideo ? (
            <HeroVideoBackground
              videoUrl={resolvedVideo}
              startSeconds={videoStartSeconds ?? 0}
              endSeconds={videoEndSeconds ?? null}
              preferredQuality={videoQuality}
            />
          ) : fallbackImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fallbackImage} alt="" className="absolute inset-0 h-full w-full object-contain object-top md:object-cover md:object-center" />
          ) : (
            <HeroStory
              topics={courseTopics}
              slides={heroSlides}
              siteName={siteNameForScene || siteName || 'Rigbu'}
            />
          )}
          <div aria-hidden className="pointer-events-none absolute inset-0 z-[1] bg-[#EDB81C]/25 mix-blend-soft-light" />
        </div>

        <div className="relative z-10 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 md:absolute md:inset-x-0 md:bottom-0 md:p-6">
            <div
              className="w-full max-w-sm overflow-hidden rounded-2xl border border-[#C99612] p-3.5 text-card-foreground shadow-lg shadow-orange-950/15 sm:p-4"
              style={{ backgroundColor: '#EDB81C' }}
            >
              <div
                className="mb-3 h-1 w-10 rounded-full"
                style={{ backgroundImage: 'linear-gradient(90deg, var(--royal-from), var(--royal-to))' }}
                aria-hidden
              />
              {(tagline || requireIdentity) && (
                <p className="text-xs font-semibold uppercase tracking-widest text-[#3F2208]">
                  {tagline ||
                    (requireIdentity
                      ? 'A verified learning network for Bhutan'
                      : 'A learning network for Bhutan')}
                </p>
              )}
              <h1 className="mt-2 text-xl font-bold leading-tight tracking-tight text-stone-950 sm:text-2xl">
                {headline ? (
                  headline
                ) : (
                  <>
                    <span className="block">{defaultHeadlinePrefix}</span>
                    <span className="mt-1 block text-[var(--royal-to)]">{typed || '\u00A0'}</span>
                  </>
                )}
              </h1>
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-stone-700">
                {resolvedDescription}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Button
                  size="sm"
                  className="h-8 gap-1 rounded-full bg-royal px-3 text-xs font-bold shadow-sm shadow-orange-900/25 hover:brightness-105"
                  render={<Link href="/auth/login" />}
                >
                  {primaryCta}
                  <ArrowRight className="h-4 w-4" />
                </Button>
                {showCatalog ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-full border-orange-400/80 bg-white/80 px-3 text-xs font-bold text-orange-800 hover:bg-orange-50"
                    render={<Link href="#courses" />}
                  >
                    {secondaryCta}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
      </section>
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
          <p className="mb-6 text-sm font-semibold uppercase tracking-widest text-primary">
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
