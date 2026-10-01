/**
 * Phones and tablets only.
 * The app stays portrait. Fullscreen rotates just the lesson player into a
 * 16:9 landscape frame sized to the visible screen, so the picture is not stretched.
 */

import { clearContainedMedia, fitContainedMedia, fitYoutubeIframe } from '@/lib/video-url'

/** Phones, and tablets including iPad widths. Desktop pointers are excluded. */
export const HANDHELD_MEDIA_QUERY =
  '(hover: none) and (pointer: coarse), (pointer: coarse) and (max-width: 1366px)'

export const LANDSCAPE_LOCK_CLASS = 'video-landscape-lock'

const FALLBACK_ATTR = 'data-landscape-fallback'
const IGNORE_EXIT_ATTR = 'data-landscape-ignore-exit'

const FRAME_STYLE_PROPS = ['top', 'left', 'width', 'height', 'transform', 'transform-origin'] as const

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

const viewportWatchers = new WeakMap<HTMLElement, () => void>()

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
  if (window.matchMedia(HANDHELD_MEDIA_QUERY).matches) return true
  // iPadOS reports a desktop Macintosh UA. Touch points distinguish it from a Mac.
  const iPad =
    /iPad/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return iPad
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

/** Portrait for phones and tablets. Desktop is left alone. */
export async function lockAppPortrait(): Promise<void> {
  if (!isHandheldDevice()) return
  const orientation = orientationApi()
  if (!orientation?.lock) return
  try {
    await orientation.lock('portrait')
  } catch {
    /* iOS Safari rejects this. The installed app still follows the manifest. */
  }
}

function visualViewportBox() {
  const vv = window.visualViewport
  return {
    width: Math.round(vv?.width ?? window.innerWidth),
    height: Math.round(vv?.height ?? window.innerHeight),
    offsetLeft: Math.round(vv?.offsetLeft ?? 0),
    offsetTop: Math.round(vv?.offsetTop ?? 0),
  }
}

function fitFrameMedia(frame: HTMLElement) {
  frame.querySelectorAll('video').forEach((node) => {
    if (node instanceof HTMLElement) fitContainedMedia(node)
  })
  frame.querySelectorAll('iframe').forEach((node) => {
    if (node instanceof HTMLIFrameElement) fitYoutubeIframe(node)
  })
}

function layoutRotatedFrame(frame: HTMLElement) {
  const { width, height, offsetLeft, offsetTop } = visualViewportBox()
  const portrait = height >= width

  frame.style.setProperty('transform-origin', 'top left', 'important')
  if (portrait) {
    // Swap axes and rotate so the player is landscape while the page stays portrait.
    frame.style.setProperty('top', `${offsetTop}px`, 'important')
    frame.style.setProperty('left', `${offsetLeft + width}px`, 'important')
    frame.style.setProperty('width', `${height}px`, 'important')
    frame.style.setProperty('height', `${width}px`, 'important')
    frame.style.setProperty('transform', 'rotate(90deg)', 'important')
  } else {
    // Tablet already held sideways: fill that viewport. Do not rotate again.
    frame.style.setProperty('top', `${offsetTop}px`, 'important')
    frame.style.setProperty('left', `${offsetLeft}px`, 'important')
    frame.style.setProperty('width', `${width}px`, 'important')
    frame.style.setProperty('height', `${height}px`, 'important')
    frame.style.setProperty('transform', 'none', 'important')
  }

  fitFrameMedia(frame)
}

function watchViewport(frame: HTMLElement) {
  unwatchViewport(frame)
  const update = () => {
    if (!frame.hasAttribute(FALLBACK_ATTR)) return
    layoutRotatedFrame(frame)
  }
  window.visualViewport?.addEventListener('resize', update)
  window.visualViewport?.addEventListener('scroll', update)
  window.addEventListener('resize', update)
  viewportWatchers.set(frame, update)
}

function unwatchViewport(frame: HTMLElement) {
  const update = viewportWatchers.get(frame)
  if (!update) return
  window.visualViewport?.removeEventListener('resize', update)
  window.visualViewport?.removeEventListener('scroll', update)
  window.removeEventListener('resize', update)
  viewportWatchers.delete(frame)
}

function clearFrameLayout(frame: HTMLElement) {
  unwatchViewport(frame)
  for (const prop of FRAME_STYLE_PROPS) frame.style.removeProperty(prop)
  frame.querySelectorAll('video, iframe').forEach((node) => {
    if (node instanceof HTMLElement) clearContainedMedia(node)
  })
  frame.querySelectorAll('iframe').forEach((node) => {
    if (node instanceof HTMLIFrameElement) fitYoutubeIframe(node)
  })
}

function applyRotatedFrame(frame: HTMLElement) {
  frame.setAttribute(FALLBACK_ATTR, '')
  document.documentElement.classList.add(LANDSCAPE_LOCK_CLASS)
  layoutRotatedFrame(frame)
  watchViewport(frame)
}

function clearCssFallback(element?: HTMLElement | null) {
  const frames: HTMLElement[] = []
  if (element) frames.push(element)
  else {
    document.querySelectorAll(`[${FALLBACK_ATTR}]`).forEach((node) => {
      if (node instanceof HTMLElement) frames.push(node)
    })
  }

  for (const frame of frames) {
    frame.removeAttribute(FALLBACK_ATTR)
    frame.removeAttribute(IGNORE_EXIT_ATTR)
    clearFrameLayout(frame)
  }

  if (!document.querySelector(`[${FALLBACK_ATTR}]`)) {
    document.documentElement.classList.remove(LANDSCAPE_LOCK_CLASS)
  }
}

export async function enterLandscapeFullscreen(element: HTMLElement): Promise<void> {
  if (!isHandheldDevice()) {
    await requestElementFullscreen(element)
    return
  }

  applyRotatedFrame(element)
  if (currentFullscreenElement()) {
    element.setAttribute(IGNORE_EXIT_ATTR, '')
    await exitDocumentFullscreen(element)
    element.removeAttribute(IGNORE_EXIT_ATTR)
  }
  await lockAppPortrait()
}

export async function exitLandscapeFullscreen(element?: HTMLElement | null): Promise<void> {
  clearCssFallback(element)
  await exitDocumentFullscreen(element)
  await lockAppPortrait()
}
