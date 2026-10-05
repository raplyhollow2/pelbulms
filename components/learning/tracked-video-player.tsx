'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Maximize, Minimize, Play } from 'lucide-react'
import {
  HANDHELD_MEDIA_QUERY,
  LANDSCAPE_LOCK_CLASS,
  enterLandscapeFullscreen,
  exitLandscapeFullscreen,
  isDeviceLandscape,
  isHandheldDevice,
  isLandscapeHeld,
  isPlayerFullscreen,
  lockAppPortrait,
  shouldIgnoreFullscreenExit,
  syncLandscapeFrame,
} from '@/lib/landscape-fullscreen'
import { DrivePreviewFrame } from '@/components/learning/drive-preview-frame'
import {
  DRIVE_SHARE_HINT,
  YOUTUBE_EMBED_ALLOW,
  classifyVideoUrl,
  createYoutubeIframe,
  pinYoutubeIframe,
} from '@/lib/video-url'

export interface VideoProgressData {
  /** Furthest watched position as a percentage of duration (0-100) */
  percent: number
  /** Current playhead position in seconds */
  positionSeconds: number
  /** Total seconds actually watched during this session */
  watchedSeconds: number
  /** Total video duration in seconds (0 if unknown) */
  duration: number
}

interface TrackedVideoPlayerProps {
  videoUrl: string
  title?: string
  /** Resume playback from this position (seconds) */
  initialPositionSeconds?: number
  /** Percentage of the video that counts as "watched enough" to auto-complete */
  thresholdPercent?: number
  /** Throttled progress callback (fires roughly every few seconds while playing) */
  onProgress?: (data: VideoProgressData) => void
  /** Fires once when the watch threshold is first reached */
  onThresholdReached?: () => void
  /** Fires once when the video finishes (YouTube ended / HTML5 ended) */
  onEnded?: () => void
  className?: string
}

const YT_API_SRC = 'https://www.youtube.com/iframe_api'

/** Column-width 16:9. Height comes only from aspect-video; the media is taken out of flow. */
const FRAME_CLASS = 'relative aspect-video w-full overflow-hidden rounded-xl bg-black'
const MEDIA_CLASS = 'absolute inset-0 h-full w-full border-0 object-cover'

type WatchMemory = { seconds: number; holdUntil: number }

/**
 * A landscape resize can make the player report 0. Ignore that jump unless the
 * learner actually scrubbed, and keep the last real watch point.
 */
function noteReportedTime(memory: WatchMemory, reported: number, trustRewind: boolean) {
  const next = Number.isFinite(reported) ? Math.max(0, reported) : 0
  if (!trustRewind && memory.seconds > 1 && next + 1.25 < memory.seconds) {
    return { seconds: memory.seconds, restore: true as const }
  }
  memory.seconds = next
  return { seconds: next, restore: false as const }
}

/** Loads the YouTube IFrame API exactly once and resolves when ready. */
let ytApiPromise: Promise<any> | null = null
function loadYouTubeApi(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject('no window')
  const w = window as any
  if (w.YT && w.YT.Player) return Promise.resolve(w.YT)
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
    // The API only fires its callback once. If another loader already consumed
    // it, poll until YT.Player exists.
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

export function TrackedVideoPlayer({
  videoUrl,
  title,
  initialPositionSeconds = 0,
  thresholdPercent = 90,
  onProgress,
  onThresholdReached,
  onEnded,
  className,
}: TrackedVideoPlayerProps) {
  const source = classifyVideoUrl(videoUrl)
  const youtubeId = source.kind === 'youtube' ? source.youtubeId : null
  const vimeoEmbedUrl = source.kind === 'vimeo' ? source.embedUrl : null
  const driveEmbedUrl = source.kind === 'drive' ? source.embedUrl : null
  const driveFileId = source.kind === 'drive' ? source.fileId : null

  const containerRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const videoElRef = useRef<HTMLVideoElement>(null)
  const vimeoFrameRef = useRef<HTMLIFrameElement>(null)
  const playerRef = useRef<any>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Progress bookkeeping (refs so the polling loop always sees fresh values)
  const furthestRef = useRef(0)
  const watchedSecondsRef = useRef(0)
  const durationRef = useRef(0)
  const lastEmitRef = useRef(0)
  const thresholdFiredRef = useRef(false)
  const endedFiredRef = useRef(false)
  const memoryRef = useRef<WatchMemory>({ seconds: initialPositionSeconds, holdUntil: 0 })
  const playingRef = useRef(false)
  const hasPlayedRef = useRef(false)
  const scrubbingRef = useRef(false)
  const scrubAtRef = useRef(0)
  const ignoreSeekUntilRef = useRef(0)
  const resumeTimersRef = useRef<number[]>([])
  const onEndedRef = useRef(onEnded)
  onEndedRef.current = onEnded

  const [duration, setDuration] = useState(0)
  const [watchedPercent, setWatchedPercent] = useState(0)
  const [driveStreamFailed, setDriveStreamFailed] = useState(false)
  const drivePlaybackSrc =
    driveFileId && !driveStreamFailed ? `/api/drive-video/${driveFileId}` : null

  const html5Src = drivePlaybackSrc || (source.kind === 'file' ? source.src : null)
  const embedSrc = driveEmbedUrl || (source.kind === 'embed' ? source.src : null)
  const [handheld, setHandheld] = useState(false)
  const [landscapeFs, setLandscapeFs] = useState(false)

  const fireEnded = useCallback(() => {
    if (endedFiredRef.current) return
    endedFiredRef.current = true
    onEndedRef.current?.()
  }, [])

  const emit = useCallback(
    (positionSeconds: number, force = false) => {
      const dur = durationRef.current
      if (dur > 0) {
        const pct = Math.min(100, Math.round((furthestRef.current / dur) * 100))
        setWatchedPercent(pct)
        if (!thresholdFiredRef.current && pct >= thresholdPercent) {
          thresholdFiredRef.current = true
          onThresholdReached?.()
        }
        const now = Date.now()
        if (force || now - lastEmitRef.current >= 5000) {
          lastEmitRef.current = now
          onProgress?.({
            percent: pct,
            positionSeconds: Math.round(positionSeconds),
            watchedSeconds: Math.round(watchedSecondsRef.current),
            duration: Math.round(dur),
          })
        }
      }
    },
    [onProgress, onThresholdReached, thresholdPercent]
  )
  const emitRef = useRef(emit)
  emitRef.current = emit

  const restorePlayhead = () => {
    const target = memoryRef.current.seconds
    if (target <= 1) return
    const el = videoElRef.current
    if (el && el.currentTime + 1.25 < target) {
      ignoreSeekUntilRef.current = Date.now() + 500
      try {
        el.currentTime = target
      } catch {
        /* metadata not ready yet */
      }
      if (playingRef.current && el.paused) void el.play().catch(() => {})
    }
    const player = playerRef.current
    if (!player?.seekTo) return
    try {
      const current = Number(player.getCurrentTime?.()) || 0
      if (current + 1.25 < target) {
        player.seekTo(target, true)
        if (playingRef.current) player.playVideo?.()
      }
    } catch {
      /* player was torn down by a reload */
    }
  }

  const holdPlayheadRef = useRef(() => {})
  holdPlayheadRef.current = () => {
    const memory = memoryRef.current
    const el = videoElRef.current
    if (el && el.currentTime > memory.seconds) memory.seconds = el.currentTime
    try {
      const t = Number(playerRef.current?.getCurrentTime?.()) || 0
      if (t > memory.seconds) memory.seconds = t
    } catch {
      /* player not ready */
    }
    memory.holdUntil = Date.now() + 2500
    resumeTimersRef.current.forEach((id) => window.clearTimeout(id))
    resumeTimersRef.current = [0, 180, 600, 1400].map((delay) =>
      window.setTimeout(restorePlayhead, delay)
    )
  }

  useEffect(() => {
    endedFiredRef.current = false
    thresholdFiredRef.current = false
    furthestRef.current = 0
    watchedSecondsRef.current = 0
    durationRef.current = 0
    playingRef.current = false
    hasPlayedRef.current = false
    memoryRef.current = { seconds: initialPositionSeconds, holdUntil: 0 }
    setDuration(0)
    setWatchedPercent(0)
    setDriveStreamFailed(false)
    // Resume position is read once per video. Later progress saves must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl])

  // ---------- YouTube player ----------
  useEffect(() => {
    if (!youtubeId || !containerRef.current) return
    let cancelled = false
    // Build the iframe ourselves so referrerpolicy is set before YouTube loads.
    // Keep it outside React so the IFrame API can own the node.
    const iframe = createYoutubeIframe(
      youtubeId,
      {
        rel: 0,
        modestbranding: 1,
        // Our button owns fullscreen on phones and tablets so it can lock landscape.
        ...(isHandheldDevice() ? { fs: 0 } : {}),
      },
      { contain: true }
    )
    containerRef.current.replaceChildren(iframe)
    pinYoutubeIframe(iframe)

    const seekToWatchPoint = (player: { seekTo?: (seconds: number, allowSeekAhead: boolean) => void; playVideo?: () => void; getCurrentTime?: () => number }) => {
      const target = memoryRef.current.seconds
      if (target <= 1 || !player.seekTo) return
      try {
        const current = Number(player.getCurrentTime?.()) || 0
        if (current + 1.25 >= target) return
        player.seekTo(target, true)
        if (playingRef.current) player.playVideo?.()
      } catch {
        /* player not ready after a reload */
      }
    }

    let loads = 0
    const onIframeLoad = () => {
      loads += 1
      if (loads === 1) return
      window.setTimeout(() => seekToWatchPoint(playerRef.current || {}), 200)
    }
    iframe.addEventListener('load', onIframeLoad)

    loadYouTubeApi().then((YT) => {
      if (cancelled || !iframe.isConnected) return
      playerRef.current = new YT.Player(iframe, {
        events: {
          onReady: (e: any) => {
            pinYoutubeIframe(iframe)
            const dur = e.target.getDuration?.() || 0
            durationRef.current = dur
            setDuration(dur)
            const resumeAt = memoryRef.current.seconds
            if (resumeAt > 1 && (dur <= 0 || resumeAt < dur - 1)) {
              e.target.seekTo(resumeAt, true)
            }
          },
          onStateChange: (e: any) => {
            // 1 = playing
            if (e.data === 1) {
              playingRef.current = true
              if (!intervalRef.current) startPolling()
            }
            // 2 = paused, 0 = ended
            if (e.data === 2 || e.data === 0) {
              const raw = playerRef.current?.getCurrentTime?.() || 0
              const noted = noteReportedTime(
                memoryRef.current,
                raw,
                Date.now() >= memoryRef.current.holdUntil
              )
              if (noted.restore) {
                seekToWatchPoint(playerRef.current || {})
                return
              }
              playingRef.current = false
              const t = noted.seconds
              const dur = playerRef.current?.getDuration?.() || durationRef.current
              if (e.data === 0 && dur > 0) {
                furthestRef.current = Math.max(furthestRef.current, dur)
              }
              emit(e.data === 0 ? dur || t : t, true)
              stopPolling()
              if (e.data === 0) fireEnded()
            }
          },
        },
      })
    })

    function startPolling() {
      stopPolling()
      intervalRef.current = setInterval(() => {
        const p = playerRef.current
        if (!p?.getCurrentTime) return
        const raw = p.getCurrentTime() || 0
        const noted = noteReportedTime(
          memoryRef.current,
          raw,
          Date.now() >= memoryRef.current.holdUntil
        )
        if (noted.restore) {
          seekToWatchPoint(p)
          return
        }
        const t = noted.seconds
        const dur = p.getDuration?.() || durationRef.current
        if (dur && dur !== durationRef.current) {
          durationRef.current = dur
          setDuration(dur)
        }
        watchedSecondsRef.current += 1
        if (t > furthestRef.current) furthestRef.current = t
        emit(t)
      }, 1000)
    }

    function stopPolling() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      cancelled = true
      iframe.removeEventListener('load', onIframeLoad)
      stopPolling()
      try {
        playerRef.current?.destroy?.()
      } catch {
        /* noop */
      }
      playerRef.current = null
      containerRef.current?.replaceChildren()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youtubeId])

  // ---------- Vimeo player (postMessage; the iframe has no DOM access) ----------
  useEffect(() => {
    if (!vimeoEmbedUrl) return
    const iframe = vimeoFrameRef.current
    if (!iframe) return
    const origin = 'https://player.vimeo.com'
    let disposed = false
    let armed = false

    const send = (method: string, value?: unknown) => {
      if (disposed || !iframe.contentWindow) return
      iframe.contentWindow.postMessage({ method, value }, origin)
    }

    const arm = () => {
      const first = !armed
      if (first) {
        armed = true
        for (const name of ['timeupdate', 'pause', 'ended']) send('addEventListener', name)
      }
      const start = memoryRef.current.seconds
      if (start > 1 && (first || Date.now() < memoryRef.current.holdUntil)) {
        send('setCurrentTime', start)
      }
    }

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== iframe.contentWindow) return
      let payload: {
        event?: string
        method?: string
        data?: { seconds?: number; duration?: number }
      } | null = null
      try {
        payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
      } catch {
        return
      }
      if (!payload) return
      // The player answers `ping` with ready / ping once it can take listeners.
      if (payload.event === 'ready' || payload.method === 'ping') {
        arm()
        return
      }
      if (!payload.event) return
      const seconds = Number(payload.data?.seconds) || 0
      const dur = Number(payload.data?.duration) || 0
      if (payload.event === 'timeupdate') {
        if (dur > 0 && dur !== durationRef.current) {
          durationRef.current = dur
          setDuration(dur)
        }
        playingRef.current = true
        const noted = noteReportedTime(
          memoryRef.current,
          seconds,
          Date.now() >= memoryRef.current.holdUntil
        )
        if (noted.restore) {
          send('setCurrentTime', noted.seconds)
          return
        }
        if (noted.seconds > furthestRef.current) {
          watchedSecondsRef.current += Math.min(2, noted.seconds - furthestRef.current)
          furthestRef.current = noted.seconds
        }
        emitRef.current(noted.seconds)
        return
      }
      if (payload.event === 'pause') {
        const noted = noteReportedTime(
          memoryRef.current,
          seconds,
          Date.now() >= memoryRef.current.holdUntil
        )
        if (noted.restore) {
          send('setCurrentTime', noted.seconds)
          return
        }
        playingRef.current = false
        emitRef.current(noted.seconds, true)
        return
      }
      if (payload.event === 'ended') {
        const end = dur || durationRef.current
        if (end > 0) furthestRef.current = Math.max(furthestRef.current, end)
        emitRef.current(end || seconds, true)
        fireEnded()
      }
    }

    const kick = () => send('ping')
    iframe.addEventListener('load', kick)
    window.addEventListener('message', onMessage)
    kick()
    return () => {
      disposed = true
      iframe.removeEventListener('load', kick)
      window.removeEventListener('message', onMessage)
    }
  }, [vimeoEmbedUrl, fireEnded])

  // ---------- Direct HTML5 video, including Drive lessons ----------
  const applyResume = (el: HTMLVideoElement, seconds: number) => {
    ignoreSeekUntilRef.current = Date.now() + 500
    try {
      el.currentTime = seconds
    } catch {
      /* metadata not ready yet */
    }
    if (playingRef.current && el.paused) void el.play().catch(() => {})
  }

  const handleLoadedMetadata = () => {
    const el = videoElRef.current
    if (!el) return
    const dur = el.duration
    if (!Number.isFinite(dur) || dur <= 0) return
    durationRef.current = dur
    setDuration(dur)
    const resumeAt = memoryRef.current.seconds
    if (resumeAt > 1 && resumeAt < dur - 1 && el.currentTime + 1 < resumeAt) {
      applyResume(el, resumeAt)
    }
  }

  const handleSeeking = () => {
    if (Date.now() < ignoreSeekUntilRef.current) return
    const el = videoElRef.current
    const t = el?.currentTime || 0
    const memory = memoryRef.current.seconds
    const held = Date.now() < memoryRef.current.holdUntil
    const recentPointer = Date.now() - scrubAtRef.current < 1500
    const restarted = !!el && hasPlayedRef.current && el.played.length === 0 && t < 1 && memory > 1
    const reloading = !!el && el.readyState < 1 && t < 1 && memory > 1
    if (restarted || reloading || (held && !recentPointer && t + 1.25 < memory)) return
    scrubbingRef.current = true
    scrubAtRef.current = Date.now()
  }

  const handleSeeked = () => {
    if (Date.now() < ignoreSeekUntilRef.current) return
    const el = videoElRef.current
    if (scrubbingRef.current && el) memoryRef.current.seconds = el.currentTime || 0
    scrubbingRef.current = false
  }

  const handleTimeUpdate = () => {
    const el = videoElRef.current
    if (!el) return
    const dur = el.duration
    if (Number.isFinite(dur) && dur > 0 && dur !== durationRef.current) {
      durationRef.current = dur
      setDuration(dur)
    }
    const t = el.currentTime || 0
    if (t > 0.25) hasPlayedRef.current = true
    const trustRewind = scrubbingRef.current
    const noted = noteReportedTime(memoryRef.current, t, trustRewind)
    if (noted.restore) {
      if (Date.now() >= ignoreSeekUntilRef.current) applyResume(el, noted.seconds)
      return
    }
    if (noted.seconds > furthestRef.current) {
      // Count only forward progress as "watched"
      watchedSecondsRef.current += Math.min(2, noted.seconds - furthestRef.current)
      furthestRef.current = noted.seconds
    }
    emit(noted.seconds)
  }

  const handlePause = () => {
    const el = videoElRef.current
    if (!el) return
    const t = el.currentTime || 0
    const noted = noteReportedTime(memoryRef.current, t, scrubbingRef.current)
    if (noted.restore) {
      applyResume(el, noted.seconds)
      return
    }
    playingRef.current = false
    emit(noted.seconds, true)
  }

  const markScrub = () => {
    scrubAtRef.current = Date.now()
  }

  const handlePlay = () => {
    playingRef.current = true
    hasPlayedRef.current = true
  }

  const handleVideoError = () => {
    const el = videoElRef.current
    if (!driveFileId || !el) return
    // 1 = aborted while changing lessons. That is not a broken file.
    if (el.error?.code === 1) return
    setDriveStreamFailed(true)
  }

  const handleEnded = () => {
    playingRef.current = false
    const el = videoElRef.current
    if (el) {
      const dur = el.duration || durationRef.current
      if (dur > 0) {
        furthestRef.current = Math.max(furthestRef.current, dur)
        memoryRef.current.seconds = Math.max(memoryRef.current.seconds, dur)
      }
      emit(dur || el.currentTime || 0, true)
    }
    fireEnded()
  }

  // Flush on unmount
  useEffect(() => {
    return () => {
      resumeTimersRef.current.forEach((id) => window.clearTimeout(id))
      const el = videoElRef.current
      const t = el?.currentTime ?? playerRef.current?.getCurrentTime?.() ?? memoryRef.current.seconds
      emit(t, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useLayoutEffect(() => {
    setHandheld(isHandheldDevice())
  }, [])

  useLayoutEffect(() => {
    const frame = frameRef.current
    if (!frame || !handheld || !landscapeFs) return
    syncLandscapeFrame(frame)
  }, [handheld, landscapeFs])

  useEffect(() => {
    const media = window.matchMedia(HANDHELD_MEDIA_QUERY)
    const onMedia = () => setHandheld(isHandheldDevice())
    onMedia()
    media.addEventListener('change', onMedia)
    window.addEventListener('resize', onMedia)

    const onFullscreen = () => {
      holdPlayheadRef.current()
      const frame = frameRef.current
      if (!frame || !isHandheldDevice()) return
      if (shouldIgnoreFullscreenExit(frame)) {
        setLandscapeFs(true)
        return
      }
      if (isPlayerFullscreen(frame)) {
        setLandscapeFs(true)
        if (!document.documentElement.classList.contains(LANDSCAPE_LOCK_CLASS)) {
          void enterLandscapeFullscreen(frame).then(() => setLandscapeFs(isPlayerFullscreen(frame)))
        }
        return
      }
      if (isLandscapeHeld()) {
        setLandscapeFs(true)
        void enterLandscapeFullscreen(frame).then(() => setLandscapeFs(isPlayerFullscreen(frame)))
        return
      }
      setLandscapeFs(false)
      void lockAppPortrait()
    }

    document.addEventListener('fullscreenchange', onFullscreen)
    document.addEventListener('webkitfullscreenchange', onFullscreen)

    const orientMedia = window.matchMedia('(orientation: landscape)')
    const onOrientation = () => {
      holdPlayheadRef.current()
      window.setTimeout(() => {
        const frame = frameRef.current
        if (!frame || !isHandheldDevice() || !isDeviceLandscape()) return
        if (isPlayerFullscreen(frame)) {
          syncLandscapeFrame(frame)
          return
        }
        void enterLandscapeFullscreen(frame).then(() => setLandscapeFs(true))
      }, 50)
    }
    window.addEventListener('orientationchange', onOrientation)
    screen.orientation?.addEventListener?.('change', onOrientation)
    orientMedia.addEventListener('change', onOrientation)

    return () => {
      media.removeEventListener('change', onMedia)
      window.removeEventListener('resize', onMedia)
      document.removeEventListener('fullscreenchange', onFullscreen)
      document.removeEventListener('webkitfullscreenchange', onFullscreen)
      window.removeEventListener('orientationchange', onOrientation)
      screen.orientation?.removeEventListener?.('change', onOrientation)
      orientMedia.removeEventListener('change', onOrientation)
      const frame = frameRef.current
      if (frame && isPlayerFullscreen(frame)) {
        holdPlayheadRef.current()
        void exitLandscapeFullscreen(frame)
      }
    }
  }, [])

  const toggleLandscape = useCallback(() => {
    const frame = frameRef.current
    if (!frame) return
    holdPlayheadRef.current()
    if (isPlayerFullscreen(frame)) {
      void exitLandscapeFullscreen(frame).then(() => setLandscapeFs(false))
      return
    }
    void enterLandscapeFullscreen(frame).then(() => {
      setLandscapeFs(isPlayerFullscreen(frame))
    })
  }, [])

  if (!videoUrl) {
    return (
      <div className={`${FRAME_CLASS} flex items-center justify-center ${className || ''}`}>
        <div className="text-center text-white">
          <Play className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg opacity-75">No video available</p>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div ref={frameRef} className={FRAME_CLASS}>
        {youtubeId ? (
          <div ref={containerRef} className="absolute inset-0" />
        ) : vimeoEmbedUrl ? (
          <iframe
            ref={vimeoFrameRef}
            src={vimeoEmbedUrl}
            className={MEDIA_CLASS}
            referrerPolicy="strict-origin-when-cross-origin"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            title={title || 'Vimeo video'}
          />
        ) : html5Src ? (
          <video
            key={html5Src}
            ref={videoElRef}
            src={html5Src}
            controls
            playsInline
            preload="metadata"
            controlsList={handheld ? 'nodownload nofullscreen' : 'nodownload'}
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={markScrub}
            onKeyDown={markScrub}
            className={MEDIA_CLASS}
            onLoadedMetadata={handleLoadedMetadata}
            onDurationChange={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onSeeking={handleSeeking}
            onSeeked={handleSeeked}
            onPlay={handlePlay}
            onPause={handlePause}
            onEnded={handleEnded}
            onError={handleVideoError}
            title={title}
          />
        ) : embedSrc ? (
          driveEmbedUrl ? (
            <>
              <DrivePreviewFrame
                src={embedSrc}
                className={MEDIA_CLASS}
                title={title || 'Google Drive video'}
              />
              <p className="absolute bottom-0 left-0 right-0 z-30 bg-black/70 text-[11px] text-white/80 px-2 py-1 pointer-events-none">
                If playback asks for access, the teacher must share the file as Anyone with the link
                (Viewer).
              </p>
            </>
          ) : (
            <iframe
              src={embedSrc}
              className={MEDIA_CLASS}
              referrerPolicy="strict-origin-when-cross-origin"
              allow={YOUTUBE_EMBED_ALLOW}
              allowFullScreen
              title={title}
            />
          )
        ) : null}
        <button
          type="button"
          aria-label={landscapeFs ? 'Exit full screen' : 'Full screen'}
          aria-pressed={landscapeFs}
          onClick={toggleLandscape}
          className={`absolute right-2 top-2 z-40 h-11 w-11 items-center justify-center rounded-full bg-black/70 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${handheld ? 'flex' : 'hidden'}`}
        >
          {landscapeFs ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
        </button>
      </div>

      {/* Watch progress bar (tracking-aware providers only) */}
      {(youtubeId || vimeoEmbedUrl || driveEmbedUrl || html5Src) && duration > 0 && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Watched</span>
            <span>{watchedPercent}%</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-1.5">
            <div
              className="bg-primary h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${watchedPercent}%` }}
            />
          </div>
        </div>
      )}
      {source.kind === 'drive' && (
        <p className="mt-2 text-xs text-muted-foreground">{DRIVE_SHARE_HINT}</p>
      )}
    </div>
  )
}

export default TrackedVideoPlayer
