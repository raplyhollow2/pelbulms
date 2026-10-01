'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Maximize, Minimize, Play } from 'lucide-react'
import {
  HANDHELD_MEDIA_QUERY,
  enterLandscapeFullscreen,
  exitLandscapeFullscreen,
  isHandheldDevice,
  isPlayerFullscreen,
  lockAppPortrait,
  shouldIgnoreFullscreenExit,
} from '@/lib/landscape-fullscreen'
import {
  DRIVE_SHARE_HINT,
  YOUTUBE_EMBED_ALLOW,
  createYoutubeIframe,
  pinYoutubeIframe,
  getGoogleDriveEmbedUrl,
  getGoogleDriveFileId,
  getYoutubeId,
  isDirectVideoFile,
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
  const youtubeId = getYoutubeId(videoUrl)
  const driveFileId = !youtubeId ? getGoogleDriveFileId(videoUrl) : null
  const driveEmbedUrl = driveFileId ? getGoogleDriveEmbedUrl(driveFileId) : null
  const directFile = !youtubeId && !driveFileId && isDirectVideoFile(videoUrl)

  const containerRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const videoElRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<any>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Progress bookkeeping (refs so the polling loop always sees fresh values)
  const furthestRef = useRef(0)
  const watchedSecondsRef = useRef(0)
  const durationRef = useRef(0)
  const lastEmitRef = useRef(0)
  const thresholdFiredRef = useRef(false)
  const endedFiredRef = useRef(false)
  const initialSeekRef = useRef(initialPositionSeconds)
  const onEndedRef = useRef(onEnded)
  onEndedRef.current = onEnded

  const [duration, setDuration] = useState(0)
  const [watchedPercent, setWatchedPercent] = useState(0)
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

    loadYouTubeApi().then((YT) => {
      if (cancelled || !iframe.isConnected) return
      playerRef.current = new YT.Player(iframe, {
        events: {
          onReady: (e: any) => {
            pinYoutubeIframe(iframe)
            const dur = e.target.getDuration?.() || 0
            durationRef.current = dur
            setDuration(dur)
            if (initialSeekRef.current > 5 && initialSeekRef.current < dur - 5) {
              e.target.seekTo(initialSeekRef.current, true)
            }
          },
          onStateChange: (e: any) => {
            // 1 = playing
            if (e.data === 1 && !intervalRef.current) {
              startPolling()
            }
            // 2 = paused, 0 = ended
            if (e.data === 2 || e.data === 0) {
              const t = playerRef.current?.getCurrentTime?.() || 0
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
        const t = p.getCurrentTime() || 0
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

  // ---------- Direct HTML5 video ----------
  const handleLoadedMetadata = () => {
    const el = videoElRef.current
    if (!el) return
    durationRef.current = el.duration || 0
    setDuration(el.duration || 0)
    if (initialSeekRef.current > 5 && initialSeekRef.current < el.duration - 5) {
      el.currentTime = initialSeekRef.current
    }
  }

  const handleTimeUpdate = () => {
    const el = videoElRef.current
    if (!el) return
    const t = el.currentTime || 0
    if (t > furthestRef.current) {
      // Count only forward progress as "watched"
      watchedSecondsRef.current += Math.min(2, t - furthestRef.current)
      furthestRef.current = t
    }
    emit(t)
  }

  const handlePause = () => {
    const el = videoElRef.current
    if (el) emit(el.currentTime || 0, true)
  }

  const handleEnded = () => {
    const el = videoElRef.current
    if (el) {
      const dur = el.duration || durationRef.current
      if (dur > 0) furthestRef.current = Math.max(furthestRef.current, dur)
      emit(dur || el.currentTime || 0, true)
    }
    fireEnded()
  }

  // Flush on unmount
  useEffect(() => {
    return () => {
      const el = videoElRef.current
      const t = el?.currentTime ?? playerRef.current?.getCurrentTime?.() ?? 0
      emit(t, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useLayoutEffect(() => {
    setHandheld(isHandheldDevice())
  }, [])

  useEffect(() => {
    const media = window.matchMedia(HANDHELD_MEDIA_QUERY)
    const onMedia = () => setHandheld(isHandheldDevice())
    onMedia()
    media.addEventListener('change', onMedia)
    window.addEventListener('resize', onMedia)

    const onFullscreen = () => {
      const frame = frameRef.current
      if (!frame || !isHandheldDevice()) return
      if (shouldIgnoreFullscreenExit(frame)) {
        setLandscapeFs(true)
        return
      }
      const active = document.fullscreenElement
      if (active && (active === frame || frame.contains(active))) {
        void enterLandscapeFullscreen(frame).then(() => setLandscapeFs(true))
        return
      }
      setLandscapeFs(false)
      void lockAppPortrait()
    }

    document.addEventListener('fullscreenchange', onFullscreen)
    document.addEventListener('webkitfullscreenchange', onFullscreen)
    return () => {
      media.removeEventListener('change', onMedia)
      window.removeEventListener('resize', onMedia)
      document.removeEventListener('fullscreenchange', onFullscreen)
      document.removeEventListener('webkitfullscreenchange', onFullscreen)
      const frame = frameRef.current
      if (frame && isPlayerFullscreen(frame)) {
        void exitLandscapeFullscreen(frame)
      }
    }
  }, [])

  const toggleLandscape = useCallback(() => {
    const frame = frameRef.current
    if (!frame) return
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
        ) : directFile ? (
          <video
            ref={videoElRef}
            src={videoUrl}
            controls
            playsInline
            preload="metadata"
            controlsList={handheld ? 'nodownload nofullscreen' : 'nodownload'}
            onContextMenu={(e) => e.preventDefault()}
            className={MEDIA_CLASS}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onPause={handlePause}
            onEnded={handleEnded}
            title={title}
          />
        ) : driveEmbedUrl ? (
          <>
            <iframe
              src={driveEmbedUrl}
              className={MEDIA_CLASS}
              referrerPolicy="strict-origin-when-cross-origin"
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
              title={title || 'Google Drive video'}
            />
            <p className="absolute bottom-0 left-0 right-0 bg-black/70 text-[11px] text-white/80 px-2 py-1 pointer-events-none">
              If playback asks for access, the teacher must share the file as Anyone with the link
              (Viewer).
            </p>
          </>
        ) : (
          // Unknown provider (e.g. Vimeo) - embed without tracking
          <iframe
            src={videoUrl}
            className={MEDIA_CLASS}
            referrerPolicy="strict-origin-when-cross-origin"
            allow={YOUTUBE_EMBED_ALLOW}
            allowFullScreen
            title={title}
          />
        )}
        <button
          type="button"
          aria-label={landscapeFs ? 'Exit full screen' : 'Full screen'}
          aria-pressed={landscapeFs}
          onClick={toggleLandscape}
          className={`absolute right-2 top-2 z-20 h-11 w-11 items-center justify-center rounded-full bg-black/70 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${handheld ? 'flex' : 'hidden'}`}
        >
          {landscapeFs ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
        </button>
      </div>

      {/* Watch progress bar (tracking-aware providers only) */}
      {(youtubeId || directFile) && duration > 0 && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Watched</span>
            <span>{watchedPercent}%</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-1.5">
            <div
              className="bg-bhutan-yellow h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${watchedPercent}%` }}
            />
          </div>
        </div>
      )}
      {driveEmbedUrl && (
        <p className="mt-2 text-xs text-muted-foreground">{DRIVE_SHARE_HINT}</p>
      )}
    </div>
  )
}

export default TrackedVideoPlayer
