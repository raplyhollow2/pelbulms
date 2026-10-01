/**
 * Phones and tablets only. Desktop is left alone.
 * The screen stays portrait-locked. Fullscreen on a lesson video is the exception:
 * the screen turns landscape, and leaving fullscreen locks portrait again.
 */

import { clearContainedMedia, fitFilledMedia, fitYoutubeIframe } from '@/lib/video-url'

/** Phones, and tablets including iPad widths. Desktop pointers are excluded. */
export const HANDHELD_MEDIA_QUERY =
  '(hover: none) and (pointer: coarse), (pointer: coarse) and (max-width: 1366px)'

export const LANDSCAPE_LOCK_CLASS = 'video-landscape-lock'

const FALLBACK_ATTR = 'data-landscape-fallback'
const IGNORE_EXIT_ATTR = 'data-landscape-ignore-exit'

const FRAME_STYLE_PROPS = [
  'position',
  'top',
  'left',
  'width',
  'height',
  'transform',
  'transform-origin',
  'background',
  'aspect-ratio',
  'max-width',
  'max-height',
  'margin',
  'border-radius',
  'z-index',
  'overflow',
] as const

type OrientationWithLock = ScreenOrientation & {
  lock?: (
    orientation: 'landscape' | 'landscape-primary' | 'portrait' | 'portrait-primary'
  ) => Promise<void>
}

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => void | Promise<void>
}

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => void | Promise<void>
}

const viewportWatchers = new WeakMap<HTMLElement, () => void>()
let orientationTransition = false
let landscapeHeld = false
let exitRequested = false
let nativeAttemptAt = 0
const SHELL_STYLE_PROPS = ['position', 'top', 'left', 'width', 'height', 'transform', 'transform-origin', 'overflow', 'max-width', 'max-height'] as const

/**
 * Moving a frame onto document.body reloads its iframe and restarts the video.
 * Lift clipping on the ancestors instead, and leave the player where React put it.
 */
const ancestorClips = new WeakMap<HTMLElement, { el: HTMLElement; inline: Record<string, string> }[]>()

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

/** True while a lesson video should stay landscape until the user leaves fullscreen. */
export function isLandscapeHeld(): boolean {
  return landscapeHeld && !exitRequested
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

function videoLandscapeActive() {
  return document.documentElement.classList.contains(LANDSCAPE_LOCK_CLASS)
}

/** Portrait for phones and tablets, except while a lesson video is landscape-fullscreen. */
export async function lockAppPortrait(): Promise<void> {
  if (!isHandheldDevice() || videoLandscapeActive()) return
  const orientation = orientationApi()
  if (!orientation?.lock) return
  try {
    await orientation.lock('portrait')
  } catch {
    try {
      await orientation.lock('portrait-primary')
    } catch {
      /* iOS Safari rejects this. The manifest still locks an installed app. */
    }
  }
}

/** Requires fullscreen on most mobile browsers. Returns false when the lock is unavailable. */
async function tryLockLandscape(): Promise<boolean> {
  if (!isHandheldDevice()) return false
  const orientation = orientationApi()
  if (!orientation?.lock) return false
  try {
    await orientation.lock('landscape')
    return true
  } catch {
    try {
      await orientation.lock('landscape-primary')
      return true
    } catch {
      return false
    }
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

function pinFrameChrome(el: HTMLElement) {
  el.style.setProperty('position', 'fixed', 'important')
  el.style.setProperty('aspect-ratio', 'auto', 'important')
  el.style.setProperty('max-width', 'none', 'important')
  el.style.setProperty('max-height', 'none', 'important')
  el.style.setProperty('margin', '0', 'important')
  el.style.setProperty('border-radius', '0', 'important')
  el.style.setProperty('z-index', '2147483000', 'important')
  el.style.setProperty('background', '#000', 'important')
}

function placeRotatedCover(el: HTMLElement) {
  const { width, height, offsetLeft, offsetTop } = visualViewportBox()
  pinFrameChrome(el)
  el.style.setProperty('transform-origin', 'top left', 'important')
  el.style.setProperty('top', `${offsetTop}px`, 'important')
  el.style.setProperty('left', `${offsetLeft + width}px`, 'important')
  el.style.setProperty('width', `${height}px`, 'important')
  el.style.setProperty('height', `${width}px`, 'important')
  el.style.setProperty('transform', 'rotate(90deg)', 'important')
}

function placeFilledCover(el: HTMLElement) {
  const { width, height, offsetLeft, offsetTop } = visualViewportBox()
  pinFrameChrome(el)
  el.style.setProperty('transform-origin', 'top left', 'important')
  el.style.setProperty('top', `${offsetTop}px`, 'important')
  el.style.setProperty('left', `${offsetLeft}px`, 'important')
  el.style.setProperty('width', `${width}px`, 'important')
  el.style.setProperty('height', `${height}px`, 'important')
  el.style.setProperty('transform', 'none', 'important')
}

/** Clears a leftover page rotation. The page itself is not turned anymore. */
export function syncBrowserPortraitShell(shell: HTMLElement) {
  clearPortraitShell(shell)
}

function clearPortraitShell(shell: HTMLElement) {
  document.documentElement.classList.remove('browser-portrait-lock')
  for (const prop of SHELL_STYLE_PROPS) shell.style.removeProperty(prop)
}

function stretchMediaHosts(frame: HTMLElement) {
  frame.querySelectorAll('video, iframe').forEach((node) => {
    const parent = node.parentElement
    if (!parent || parent === frame) return
    parent.style.setProperty('position', 'absolute', 'important')
    parent.style.setProperty('inset', '0', 'important')
    parent.style.setProperty('width', '100%', 'important')
    parent.style.setProperty('height', '100%', 'important')
  })
}

function clearMediaHosts(frame: HTMLElement) {
  frame.querySelectorAll('video, iframe').forEach((node) => {
    const parent = node.parentElement
    if (!parent || parent === frame) return
    parent.style.removeProperty('position')
    parent.style.removeProperty('inset')
    parent.style.removeProperty('width')
    parent.style.removeProperty('height')
  })
}

function fitFrameMedia(frame: HTMLElement) {
  stretchMediaHosts(frame)
  frame.querySelectorAll('video, iframe').forEach((node) => {
    if (node instanceof HTMLVideoElement) fitFilledMedia(node)
    else if (node instanceof HTMLIFrameElement) fitYoutubeIframe(node)
  })
}

function releaseAncestorClipping(frame: HTMLElement) {
  if (ancestorClips.has(frame)) return
  const saved: { el: HTMLElement; inline: Record<string, string> }[] = []
  let node = frame.parentElement
  while (node && node !== document.body) {
    const computed = getComputedStyle(node)
    const inline: Record<string, string> = {}
    const force = (prop: string, value: string) => {
      inline[prop] = node!.style.getPropertyValue(prop)
      node!.style.setProperty(prop, value, 'important')
    }
    if (computed.overflowX !== 'visible' || computed.overflowY !== 'visible') {
      force('overflow', 'visible')
      force('overflow-x', 'visible')
      force('overflow-y', 'visible')
    }
    if (computed.transform !== 'none') force('transform', 'none')
    const backdrop = computed.backdropFilter || ''
    if (computed.filter !== 'none') force('filter', 'none')
    if (backdrop && backdrop !== 'none') force('backdrop-filter', 'none')
    if (computed.willChange !== 'auto') force('will-change', 'auto')
    if (computed.contain !== 'none' && computed.contain !== '') force('contain', 'none')
    if (Object.keys(inline).length > 0) saved.push({ el: node, inline })
    node = node.parentElement
  }
  ancestorClips.set(frame, saved)
}

function restoreAncestorClipping(frame: HTMLElement) {
  const saved = ancestorClips.get(frame)
  if (!saved) return
  for (const item of saved) {
    for (const [prop, value] of Object.entries(item.inline)) {
      if (value) item.el.style.setProperty(prop, value)
      else item.el.style.removeProperty(prop)
    }
  }
  ancestorClips.delete(frame)
}

function layoutRotatedFrame(frame: HTMLElement) {
  const { width, height } = visualViewportBox()
  // Portrait viewport: rotate only the player. Landscape viewport: the browser
  // already turned, so fill that screen without rotating the picture again.
  if (height >= width) placeRotatedCover(frame)
  else placeFilledCover(frame)
  fitFrameMedia(frame)
}

/** Cover the screen without reparenting, so the video element keeps its current time. */
export function syncLandscapeFrame(frame: HTMLElement) {
  if (!frame.hasAttribute(FALLBACK_ATTR)) return
  releaseAncestorClipping(frame)
  layoutRotatedFrame(frame)
}

function watchViewport(frame: HTMLElement) {
  unwatchViewport(frame)
  const update = () => {
    if (!videoLandscapeActive()) return
    if (frame.hasAttribute(FALLBACK_ATTR)) layoutRotatedFrame(frame)
    else fitFrameMedia(frame)
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
  clearMediaHosts(frame)
  frame.querySelectorAll('video, iframe').forEach((node) => {
    if (node instanceof HTMLElement) clearContainedMedia(node)
  })
  frame.querySelectorAll('iframe').forEach((node) => {
    if (node instanceof HTMLIFrameElement) fitYoutubeIframe(node)
  })
  restoreAncestorClipping(frame)
}

function applyRotatedFrame(frame: HTMLElement) {
  frame.setAttribute(FALLBACK_ATTR, '')
  document.documentElement.classList.add(LANDSCAPE_LOCK_CLASS)
  releaseAncestorClipping(frame)
  layoutRotatedFrame(frame)
  watchViewport(frame)
  window.requestAnimationFrame(() => {
    if (frame.hasAttribute(FALLBACK_ATTR)) layoutRotatedFrame(frame)
  })
  window.setTimeout(() => {
    if (frame.hasAttribute(FALLBACK_ATTR)) layoutRotatedFrame(frame)
  }, 350)
}

async function ensureNativeLandscape(element: HTMLElement): Promise<void> {
  const active = currentFullscreenElement()
  if (active && (active === element || element.contains(active))) {
    await tryLockLandscape()
    return
  }
  const now = Date.now()
  if (now - nativeAttemptAt < 900) return
  nativeAttemptAt = now
  element.setAttribute(IGNORE_EXIT_ATTR, '')
  await requestElementFullscreen(element)
  element.removeAttribute(IGNORE_EXIT_ATTR)
  await tryLockLandscape()
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

export function isDeviceLandscape(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(orientation: landscape)').matches) return true
  const type = screen.orientation?.type
  return !!type && type.startsWith('landscape')
}

export async function enterLandscapeFullscreen(element: HTMLElement): Promise<void> {
  if (!isHandheldDevice()) {
    await requestElementFullscreen(element)
    return
  }
  if (orientationTransition || exitRequested) return
  if (element.hasAttribute(FALLBACK_ATTR)) {
    layoutRotatedFrame(element)
    await ensureNativeLandscape(element)
    if (!exitRequested) layoutRotatedFrame(element)
    return
  }
  orientationTransition = true
  landscapeHeld = true
  try {
    applyRotatedFrame(element)
    await ensureNativeLandscape(element)
    if (!exitRequested && element.hasAttribute(FALLBACK_ATTR)) layoutRotatedFrame(element)
  } finally {
    orientationTransition = false
  }
}

export async function exitLandscapeFullscreen(element?: HTMLElement | null): Promise<void> {
  exitRequested = true
  landscapeHeld = false
  orientationTransition = true
  try {
    document.documentElement.classList.remove(LANDSCAPE_LOCK_CLASS)
    clearCssFallback(element)
    await exitDocumentFullscreen(element)
    await lockAppPortrait()
  } finally {
    orientationTransition = false
    exitRequested = false
  }
}
