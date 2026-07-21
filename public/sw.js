// Minimal offline-support service worker for Nimbus.
// - Navigations: network-only, falling back to the /offline shell. Rendered
//   pages are never cached — they contain the signed-in user's file names.
// - Static assets (_next/static, icons): cache-first. These are public build
//   artifacts, safe to persist.
// File bytes made "available offline" are cached separately, straight from
// the page (see lib/offline-store.ts) — this worker doesn't touch those, and
// they're wiped on sign-out.

const SHELL_CACHE = 'nimbus-shell-v1'
const OFFLINE_URL = '/offline'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      try {
        await cache.add(OFFLINE_URL)
      } catch {
        // No session yet, or offline during install — fine, we'll cache it
        // opportunistically the first time it's actually visited.
      }
    }),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    // Network-first, and deliberately DO NOT cache the response: every
    // signed-in page embeds that user's file names. Caching it would leave
    // their data readable on a shared device after sign-out.
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((cached) => cached || Response.error()),
      ),
    )
    return
  }

  if (url.pathname.startsWith('/_next/static') || url.pathname === '/icon.svg') {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          const clone = response.clone()
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone))
          return response
        })
      }),
    )
  }
})
