// The service worker: a small script the browser keeps running for this
// site, sitting between the app and the network. Served at
// /service-worker.js and registered from app/frontend/entrypoints/inertia.tsx.
//
// It does ONE job here: when a page can't be loaded because there is no
// signal, show a friendly "you're offline" page instead of the browser's
// error screen.
//
// What it deliberately does NOT do is keep copies of the app's pages or
// data to use offline. Stock, orders and money must come fresh from the
// server every time; an old copy of "3 left" is worse than no answer.

const OFFLINE_PAGE = "/offline.html"
const CACHE = "comfyzone-offline-v1" // change the name to make phones fetch it again

// When the worker is first installed: fetch the offline page and keep it.
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_PAGE)))
  self.skipWaiting() // take over straight away, don't wait for old tabs to close
})

// When a new version takes over: throw away caches from older versions.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))))
  )
  self.clients.claim()
})

// Every request the app makes passes through here.
self.addEventListener("fetch", (event) => {
  // Only step in for opening a page ("navigate"). Everything else (saving a
  // sale, loading a photo, Inertia's own requests) goes to the network
  // untouched, so nothing is ever recorded against stale data.
  if (event.request.mode !== "navigate") return

  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_PAGE)))
})
