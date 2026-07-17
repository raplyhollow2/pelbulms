'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Play } from 'lucide-react'

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
  className?: string
}

const YT_API_SRC = 'https://www.youtube.com/iframe_api'

function getYoutubeId(url: string): string | null {
  if (!url) return null
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&]+)/,
    /(?:youtu\.be\/)([^?&]+)/,
    /(?:youtube\.com\/embed\/)([^?&]+)/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m?.[1]) return m[1]
  }
  return null
}

function isDirectVideoFile(url: string): boolean {
  return /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(url)
}

/** Loads the YouTube IFrame API exactly once and resolves when ready. */
let ytApiPromise: Promise<any> | null = null
function loadYouTubeApi(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject('no window')
  const w = window as any
  if (w.YT && w.YT.Player) return Promise.resolve(w.YT)
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
    }
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
  className,
}: TrackedVideoPlayerProps) {
  const youtubeId = getYoutubeId(videoUrl)
  const directFile = !youtubeId && isDirectVideoFile(videoUrl)

  const containerRef = useRef<HTMLDivElement>(null)
  const videoElRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<any>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Progress bookkeeping (refs so the polling loop always sees fresh values)
  const furthestRef = useRef(0)
  const watchedSecondsRef = useRef(0)
  const durationRef = useRef(0)
  const lastEmitRef = useRef(0)
  const thresholdFiredRef = useRef(false)
  const initialSeekRef = useRef(initialPositionSeconds)

  const [duration, setDuration] = useState(0)
  const [watchedPercent, setWatchedPercent] = useState(0)

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
    if (!youtubeId) return
    let cancelled = false

    loadYouTubeApi().then((YT) => {
      if (cancelled || !containerRef.current) return
      playerRef.current = new YT.Player(containerRef.current, {
        videoId: youtubeId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
        },
        events: {
          onReady: (e: any) => {
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
            if ((e.data === 2 || e.data === 0) && intervalRef.current) {
              // paused or ended -> flush and stop
              const t = playerRef.current?.getCurrentTime?.() || 0
              emit(t, true)
              stopPolling()
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

  // Flush on unmount
  useEffect(() => {
    return () => {
      const el = videoElRef.current
      const t = el?.currentTime ?? playerRef.current?.getCurrentTime?.() ?? 0
      emit(t, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!videoUrl) {
    return (
      <div className={`aspect-video w-full bg-black flex items-center justify-center ${className || ''}`}>
        <div className="text-center text-white">
          <Play className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg opacity-75">No video available</p>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="aspect-video w-full bg-black overflow-hidden">
        {youtubeId ? (
          <div ref={containerRef} className="w-full h-full" />
        ) : directFile ? (
          <video
            ref={videoElRef}
            src={videoUrl}
            controls
            className="w-full h-full"
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onPause={handlePause}
            title={title}
          />
        ) : (
          // Unknown provider (e.g. Vimeo) - embed without tracking
          <iframe
            src={videoUrl}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            title={title}
          />
        )}
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
    </div>
  )
}

export default TrackedVideoPlayer
