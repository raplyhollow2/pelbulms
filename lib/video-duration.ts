/**
 * Lesson video length helpers.
 *
 * `lessons.video_duration` and `lessons.duration_minutes` are both stored as seconds
 * (the teach editor multiplies typed minutes by 60). `courses.duration_minutes` is
 * real minutes and is what the course page clock shows beside the description.
 */
import { createClient } from '@/lib/supabase/client'
import { createYoutubeIframe } from '@/lib/video-url'

export type LessonDurationPatch = {
  video_duration: number
  duration_minutes: number
}

type YtPlayer = {
  destroy: () => void
  getDuration: () => number
}

type YtPlayerEvent = { target: YtPlayer }

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement,
        options: {
          videoId?: string
          width?: number
          height?: number
          playerVars?: Record<string, string | number>
          events?: {
            onReady?: (event: YtPlayerEvent) => void
            onError?: () => void
          }
        }
      ) => YtPlayer
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

let youtubeApiPromise: Promise<void> | null = null

function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('YouTube duration probe requires a browser'))
  }
  if (window.YT?.Player) return Promise.resolve()
  if (youtubeApiPromise) return youtubeApiPromise

  youtubeApiPromise = new Promise((resolve, reject) => {
    let settled = false
    const succeed = () => {
      if (settled) return
      settled = true
      resolve()
    }
    const fail = (message: string) => {
      if (settled) return
      settled = true
      youtubeApiPromise = null
      reject(new Error(message))
    }

    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      succeed()
    }

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      script.onerror = () => fail('Failed to load YouTube player API')
      document.head.appendChild(script)
    }

    window.setTimeout(() => {
      if (window.YT?.Player) succeed()
      else fail('YouTube player API timed out')
    }, 10000)
  })

  return youtubeApiPromise
}

export function finiteSeconds(value: unknown): number | null {
  const seconds = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  return Math.round(seconds)
}

/** Local file metadata. Prefer this over the upload response. */
export function readLocalVideoDuration(file: File): Promise<number | null> {
  if (typeof document === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    const finish = (seconds: number | null) => {
      URL.revokeObjectURL(url)
      video.removeAttribute('src')
      video.load()
      resolve(seconds)
    }
    video.onloadedmetadata = () => {
      const duration = video.duration
      finish(Number.isFinite(duration) && duration > 0 && duration !== Infinity ? Math.round(duration) : null)
    }
    video.onerror = () => finish(null)
    video.src = url
  })
}

/**
 * Reads length from an offscreen YouTube player.
 * Returns null when the video cannot be embedded so the creator can type a duration.
 */
export async function probeYouTubeDuration(videoId: string, timeoutMs = 10000): Promise<number | null> {
  if (!videoId || typeof document === 'undefined') return null
  try {
    await loadYouTubeIframeApi()
  } catch {
    return null
  }

  const Player = window.YT?.Player
  if (!Player) return null

  return new Promise((resolve) => {
    const host = document.createElement('div')
    host.setAttribute('aria-hidden', 'true')
    host.style.cssText =
      'position:fixed;width:200px;height:112px;left:-9999px;top:0;opacity:0;pointer-events:none;'
    const iframe = createYoutubeIframe(videoId, { autoplay: 0, controls: 0 }, { contain: true })
    host.appendChild(iframe)
    document.body.appendChild(host)

    let player: YtPlayer | null = null
    let poll: number | undefined
    let timer: number | undefined
    let settled = false

    const finish = (seconds: number | null) => {
      if (settled) return
      settled = true
      if (poll) window.clearInterval(poll)
      if (timer) window.clearTimeout(timer)
      try {
        player?.destroy()
      } catch {
        /* player may not have finished initializing */
      }
      host.remove()
      resolve(seconds)
    }

    timer = window.setTimeout(() => finish(null), timeoutMs)
    player = new Player(iframe, {
      events: {
        onReady: (event) => {
          const read = () => {
            const duration = event.target.getDuration()
            if (Number.isFinite(duration) && duration > 0) finish(Math.round(duration))
          }
          read()
          poll = window.setInterval(read, 300)
        },
        onError: () => finish(null),
      },
    })
  })
}

export function pickVideoDuration(localSeconds: number | null, remoteSeconds: number | null): number | null {
  if (localSeconds && localSeconds > 0) return localSeconds
  if (remoteSeconds && remoteSeconds > 0) return remoteSeconds
  return null
}

export function lessonDurationPatch(seconds: number | null | undefined): LessonDurationPatch | null {
  const rounded = finiteSeconds(seconds)
  if (!rounded) return null
  return { video_duration: rounded, duration_minutes: rounded }
}

export function clearedLessonVideoPatch(): { video_url: string } & LessonDurationPatch {
  return { video_url: '', video_duration: 0, duration_minutes: 0 }
}

export function lessonLengthSeconds(lesson: {
  video_duration?: number | null
  duration_minutes?: number | null
}): number {
  if (typeof lesson.video_duration === 'number' && lesson.video_duration > 0) return lesson.video_duration
  if (typeof lesson.duration_minutes === 'number' && lesson.duration_minutes > 0) return lesson.duration_minutes
  return 0
}

export function courseMinutesFromLessons(
  lessons: Array<{ video_duration?: number | null; duration_minutes?: number | null }>
): number {
  const totalSeconds = lessons.reduce((sum, lesson) => sum + lessonLengthSeconds(lesson), 0)
  if (totalSeconds <= 0) return 0
  return Math.round(totalSeconds / 60)
}

/**
 * Recompute the course total only after a length is written.
 * URL-only saves wait for the duration probe so an earlier sync cannot
 * overwrite the total with a stale sum.
 */
export function shouldSyncCourseDuration(updates: {
  video_duration?: number | null
  duration_minutes?: number | null
}): boolean {
  return 'video_duration' in updates || 'duration_minutes' in updates
}

let courseDurationSync: Promise<void> = Promise.resolve()

export function syncCourseDuration(courseId: string): Promise<void> {
  const run = courseDurationSync.then(() => writeCourseDuration(courseId))
  courseDurationSync = run.catch(() => undefined)
  return run
}

async function writeCourseDuration(courseId: string): Promise<void> {
  if (!courseId) return
  try {
    const supabase = createClient()
    const { data: modules, error: moduleError } = await supabase
      .from('modules')
      .select('id')
      .eq('course_id', courseId)
    if (moduleError) {
      console.error('Failed to load modules for course duration', moduleError)
      return
    }

    const moduleIds = (modules || []).map((row) => row.id)
    let lessons: Array<{ video_duration: number | null; duration_minutes: number }> = []
    if (moduleIds.length > 0) {
      const { data, error: lessonError } = await supabase
        .from('lessons')
        .select('video_duration, duration_minutes')
        .in('module_id', moduleIds)
      if (lessonError) {
        console.error('Failed to load lessons for course duration', lessonError)
        return
      }
      lessons = data || []
    }

    const minutes = courseMinutesFromLessons(lessons)
    const { error } = await supabase
      .from('courses')
      .update({ duration_minutes: minutes, updated_at: new Date().toISOString() })
      .eq('id', courseId)
    if (error) console.error('Failed to update course duration', error)
  } catch (error) {
    console.error('Failed to sync course duration', error)
  }
}
