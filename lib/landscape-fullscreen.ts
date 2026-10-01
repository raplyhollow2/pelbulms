/**
 * Phones and tablets only. Desktop is left alone.
 * The screen stays portrait-locked. Fullscreen on a lesson video is the exception:
 * the screen turns landscape, and leaving fullscreen locks portrait again.
 */

import { clearContainedMedia, fitContainedMedia, fitYoutubeIframe } from '@/lib/video-url'

/** Phones, and tablets including iPad widths. Desktop pointers are excluded. */
export const HANDHELD_MEDIA_QUERY =
  '(hover: none) and (pointer: coarse), (pointer: coarse) and (max-width: 1366px)'

export const LANDSCAPE_LOCK_CLASS = 'video-landscape-lock'

const FALLBACK_ATTR = 'data-landscape-fallback'
const IGNORE_EXIT_ATTR = 'data-landscape-ignore-exit'

const FRAME_STYLE_PROPS = ['top', 'left', 'width', 'height', 'transform', 'transform-origin', 'background'] as const

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
const frameHomes = new WeakMap<HTMLElement, HTMLElement>()
const SHELL_STYLE_PROPS = ['position', 'top', 'left', 'width', 'height', 'transform', 'transform-origin', 'overflow', 'max-width', 'max-height'] as const

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

function placeRotatedCover(el: HTMLElement) {
  const { width, height, offsetLeft, offsetTop } = visualViewportBox()
  el.style.setProperty('transform-origin', 'top left', 'important')
  el.style.setProperty('top', `${offsetTop}px`, 'important')
  el.style.setProperty('left', `${offsetLeft + width}px`, 'important')
  el.style.setProperty('width', `${height}px`, 'important')
  el.style.setProperty('height', `${width}px`, 'important')
  el.style.setProperty('transform', 'rotate(90deg)', 'important')
}

function placeFilledCover(el: HTMLElement) {
  const { width, height, offsetLeft, offsetTop } = visualViewportBox()
  el.style.setProperty('transform-origin', 'top left', 'important')
  el.style.setProperty('top', `${offsetTop}px`, 'important')
  el.style.setProperty('left', `${offsetLeft}px`, 'important')
  el.style.setProperty('width', `${width}px`, 'important')
  el.style.setProperty('height', `${height}px`, 'important')
  el.style.setProperty('transform', 'none', 'important')
}

/** Mobile browsers ignore the manifest lock. Keep the page in a portrait frame anyway. */
export function syncBrowserPortraitShell(shell: HTMLElement) {
  if (!isHandheldDevice() || videoLandscapeActive()) {
    clearPortraitShell(shell)
    return
  }
  const { width, height } = visualViewportBox()
  const landscape = width > height
  document.documentElement.classList.toggle('browser-portrait-lock', landscape)
  if (!landscape) {
    clearPortraitShell(shell)
    return
  }
  placeRotatedCover(shell)
  shell.style.setProperty('position', 'fixed', 'important')
  shell.style.setProperty('overflow', 'auto', 'important')
  shell.style.setProperty('max-width', 'none', 'important')
  shell.style.setProperty('max-height', 'none', 'important')
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
  frame.querySelectorAll('video').forEach((node) => {
    if (node instanceof HTMLElement) fitContainedMedia(node)
  })
  frame.querySelectorAll('iframe').forEach((node) => {
    if (node instanceof HTMLIFrameElement) fitYoutubeIframe(node)
  })
}

function attachFrameToBody(frame: HTMLElement) {
  const parent = frame.parentElement
  if (parent && parent !== document.body) frameHomes.set(frame, parent)
  if (frame.parentElement !== document.body) document.body.appendChild(frame)
}

function restoreFrameHome(frame: HTMLElement) {
  const home = frameHomes.get(frame)
  if (home?.isConnected && frame.parentElement !== home) home.appendChild(frame)
}

function layoutRotatedFrame(frame: HTMLElement) {
  const { width, height } = visualViewportBox()
  // Portrait viewport: rotate only the player. Landscape viewport: the browser
  // already turned, so fill that screen without rotating the picture again.
  if (height >= width) placeRotatedCover(frame)
  else placeFilledCover(frame)
  fitFrameMedia(frame)
}

/** Keep the player on document.body so a portrait-locked page cannot clip or rotate it. */
export function syncLandscapeFrame(frame: HTMLElement) {
  if (!frame.hasAttribute(FALLBACK_ATTR)) return
  attachFrameToBody(frame)
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
  restoreFrameHome(frame)
}

function applyRotatedFrame(frame: HTMLElement) {
  frame.setAttribute(FALLBACK_ATTR, '')
  document.documentElement.classList.add(LANDSCAPE_LOCK_CLASS)
  attachFrameToBody(frame)
  layoutRotatedFrame(frame)
  watchViewport(frame)
  window.requestAnimationFrame(() => {
    if (frame.hasAttribute(FALLBACK_ATTR)) layoutRotatedFrame(frame)
  })
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
  if (orientationTransition || element.hasAttribute(FALLBACK_ATTR)) return
  orientationTransition = true
  try {
    document.documentElement.classList.add(LANDSCAPE_LOCK_CLASS)
    element.style.setProperty('background', '#000', 'important')
    const entered = await requestElementFullscreen(element)
    const locked = await tryLockLandscape()
    if (locked) {
      element.removeAttribute(FALLBACK_ATTR)
      for (const prop of FRAME_STYLE_PROPS) element.style.removeProperty(prop)
      element.style.setProperty('background', '#000', 'important')
      fitFrameMedia(element)
      watchViewport(element)
      return
    }

    // Safari cannot turn the screen. Drop the portrait fullscreen and rotate the player instead.
    if (entered || currentFullscreenElement()) {
      element.setAttribute(IGNORE_EXIT_ATTR, '')
      await exitDocumentFullscreen(element)
      element.removeAttribute(IGNORE_EXIT_ATTR)
    }
    applyRotatedFrame(element)
  } finally {
    orientationTransition = false
  }
}

export async function exitLandscapeFullscreen(element?: HTMLElement | null): Promise<void> {
  if (orientationTransition) return
  orientationTransition = true
  try {
    document.documentElement.classList.remove(LANDSCAPE_LOCK_CLASS)
    await exitDocumentFullscreen(element)
    clearCssFallback(element)
    await lockAppPortrait()
  } finally {
    orientationTransition = false
  }
}
