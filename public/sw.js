// Service Worker for Pelbu LMS PWA
// Bump this version whenever the SW logic changes so clients pick up the update
// and old caches are purged.
const CACHE_NAME = 'pelbu-lms-v2'
const PRECACHE_URLS = ['/', '/offline.html', '/manifest.json', '/icon.svg']

// Install - precache core assets (best-effort so a single 404 can't break install)
self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)))
    )
  )
})

// Activate - drop old caches and take control of open clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      )
      await self.clients.claim()
    })()
  )
})

// Fetch - cache-first for same-origin GET assets; bypass everything else
self.addEventListener('fetch', (event) => {
  let url
  try {
    url = new URL(event.request.url)
  } catch {
    return
  }

  // Let the browser handle: non-GET, cross-origin (e.g. Supabase), auth/API,
  // and OAuth callback URLs. We intentionally do NOT call respondWith here so
  // these requests are never intercepted by the service worker.
  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/api/') ||
    url.searchParams.has('code') ||
    url.searchParams.has('error')
  ) {
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached

      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response
          }
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
          return response
        })
        .catch(() => caches.match('/offline.html'))
    })
  )
})
