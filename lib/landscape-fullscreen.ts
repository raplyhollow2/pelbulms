/**
 * Phone/tablet lesson video fullscreen.
 * Android can lock the screen to landscape after the Fullscreen API.
 * iOS rejects that lock, so the player frame is rotated to fill the viewport instead.
 */

export const HANDHELD_MEDIA_QUERY = '(hover: none) and (pointer: coarse)'
export const LANDSCAPE_LOCK_CLASS = 'video-landscape-lock'

const FALLBACK_ATTR = 'data-landscape-fallback'
const IGNORE_EXIT_ATTR = 'data-landscape-ignore-exit'

type OrientationWithLock = ScreenOrientation & {
  lock?: (orientation: 'landscape' | 'portrait') => Promise<void>
}

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => void | Promise<void>
}

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => void | Promise<void>
}

function orientationApi(): OrientationWithLock | null {
  if (typeof screen === 'undefined' || !screen.orientation) return null
  return screen.orientation as OrientationWithLock
}

function fullscreenDocument(): FullscreenDocument {
  return document as FullscreenDocument
}

export function currentFullscreenElement(): Element | null {
  const doc = fullscreenDocument()
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null
}

export function isHandheldDevice(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(HANDHELD_MEDIA_QUERY).matches
}

export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function isCssLandscape(element: HTMLElement): boolean {
  return element.hasAttribute(FALLBACK_ATTR)
}

export function shouldIgnoreFullscreenExit(element: HTMLElement): boolean {
  return element.hasAttribute(IGNORE_EXIT_ATTR) || element.hasAttribute(FALLBACK_ATTR)
}

export function isPlayerFullscreen(element: HTMLElement | null): boolean {
  if (!element) return false
  if (element.hasAttribute(FALLBACK_ATTR)) return true
  const active = currentFullscreenElement()
  return !!active && (active === element || element.contains(active))
}

async function requestElementFullscreen(element: HTMLElement): Promise<boolean> {
  const el = element as FullscreenElement
  try {
    if (typeof element.requestFullscreen === 'function') {
      await element.requestFullscreen()
      return currentFullscreenElement() != null
    }
    if (typeof el.webkitRequestFullscreen === 'function') {
      await el.webkitRequestFullscreen()
      return currentFullscreenElement() != null
    }
  } catch {
    return false
  }
  return false
}

async function exitDocumentFullscreen(element?: HTMLElement | null): Promise<void> {
  const active = currentFullscreenElement()
  if (!active) return
  if (element && active !== element && !element.contains(active)) return
  const doc = fullscreenDocument()
  try {
    if (typeof document.exitFullscreen === 'function') {
      await document.exitFullscreen()
    } else if (typeof doc.webkitExitFullscreen === 'function') {
      await doc.webkitExitFullscreen()
    }
  } catch {
    /* already left fullscreen */
  }
}

/** Best-effort. Returns false on iOS and whenever the browser rejects the lock. */
export async function tryLockLandscape(): Promise<boolean> {
  const orientation = orientationApi()
  if (!orientation?.lock) return false
  try {
    await orientation.lock('landscape')
    return true
  } catch {
    return false
  }
}

function applyCssFallback(element: HTMLElement) {
  element.setAttribute(FALLBACK_ATTR, '')
  document.documentElement.classList.add(LANDSCAPE_LOCK_CLASS)
}

function clearCssFallback(element?: HTMLElement | null) {
  if (element) {
    element.removeAttribute(FALLBACK_ATTR)
    element.removeAttribute(IGNORE_EXIT_ATTR)
  } else {
    document.querySelectorAll(`[${FALLBACK_ATTR}]`).forEach((node) => {
      node.removeAttribute(FALLBACK_ATTR)
      node.removeAttribute(IGNORE_EXIT_ATTR)
    })
  }
  if (!document.querySelector(`[${FALLBACK_ATTR}]`)) {
    document.documentElement.classList.remove(LANDSCAPE_LOCK_CLASS)
  }
}

/** Installed app stays portrait except while a lesson video is landscape-fullscreen. */
export async function lockPortraitIfStandalone(): Promise<void> {
  if (!isStandaloneApp()) return
  if (document.documentElement.classList.contains(LANDSCAPE_LOCK_CLASS)) return
  if (currentFullscreenElement()) return
  const orientation = orientationApi()
  if (!orientation?.lock) return
  try {
    await orientation.lock('portrait')
  } catch {
    /* Browser tabs and iOS reject this. Installed Chromium apps accept it. */
  }
}

export async function releaseOrientationLock(): Promise<void> {
  const orientation = orientationApi()
  try {
    orientation?.unlock?.()
  } catch {
    /* unlock throws if nothing was locked */
  }
  await lockPortraitIfStandalone()
}

export async function enterLandscapeFullscreen(element: HTMLElement): Promise<void> {
  if (!isHandheldDevice()) {
    await requestElementFullscreen(element)
    return
  }

  const entered = await requestElementFullscreen(element)
  const locked = await tryLockLandscape()
  if (locked) return

  // Mark the fallback before leaving native fullscreen so the exit event
  // does not clear the rotated frame we are about to show.
  applyCssFallback(element)
  if (entered || currentFullscreenElement()) {
    element.setAttribute(IGNORE_EXIT_ATTR, '')
    await exitDocumentFullscreen(element)
    element.removeAttribute(IGNORE_EXIT_ATTR)
  }
}

export async function exitLandscapeFullscreen(element?: HTMLElement | null): Promise<void> {
  clearCssFallback(element)
  await exitDocumentFullscreen(element)
  await releaseOrientationLock()
}
