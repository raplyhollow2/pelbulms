// Service Worker for Rigbu LMS PWA
// Bump this version whenever the SW logic changes so clients pick up the update
// and old caches are purged.
const CACHE_NAME = 'rigbu-lms-v6'
const IS_LOCAL_DEV =
  self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1'
const PRECACHE_URLS = ['/offline.html', '/site.webmanifest', '/favicon.svg', '/favicon.ico']

// Install - precache core assets (best-effort so a single 404 can't break install)
self.addEventListener('install', (event) => {
  self.skipWaiting()
  if (IS_LOCAL_DEV) return
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
      if (IS_LOCAL_DEV) {
        await Promise.all(names.map((name) => caches.delete(name)))
        await self.registration.unregister()
        const windows = await self.clients.matchAll({ type: 'window' })
        windows.forEach((client) => client.navigate(client.url))
        return
      }
      await Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      )
      await self.clients.claim()
    })()
  )
})

function isDocumentRequest(request, url) {
  if (request.mode === 'navigate') return true
  if (request.headers.get('RSC') === '1') return true
  if (request.headers.get('Next-Router-Prefetch')) return true
  if (url.searchParams.has('_rsc')) return true
  const accept = request.headers.get('accept') || ''
  return accept.includes('text/html')
}

function isStaticAsset(url) {
  if (url.pathname.startsWith('/_next/static/')) return true
  if (url.pathname.startsWith('/brand/')) return true
  if (url.pathname === '/offline.html' || url.pathname === '/site.webmanifest' || url.pathname === '/favicon.svg' || url.pathname === '/favicon.ico') {
    return true
  }
  return /\.(?:png|jpe?g|webp|gif|svg|ico|woff2?)$/i.test(url.pathname)
}

// Fetch - network for HTML so middleware can refresh the session cookie.
// Cache-first only for static files.
self.addEventListener('fetch', (event) => {
  if (IS_LOCAL_DEV) return
  let url
  try {
    url = new URL(event.request.url)
  } catch {
    return
  }

  // Let the browser handle: non-GET, cross-origin (e.g. Supabase), auth/API,
  // HTML/RSC navigations, and OAuth callback URLs. We intentionally do NOT
  // call respondWith here so these requests are never intercepted.
  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/api/') ||
    url.searchParams.has('code') ||
    url.searchParams.has('error') ||
    isDocumentRequest(event.request, url) ||
    !isStaticAsset(url)
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
