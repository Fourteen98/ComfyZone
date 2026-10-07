// The service worker: a small script the browser keeps running for this
// site, sitting between the app and the network. Served at
// /service-worker.js and registered from app/frontend/entrypoints/inertia.tsx.
//
// It does two jobs:
//   1. When a page can't be loaded because there is no signal, show a
//      friendly "you're offline" page instead of the browser's error screen.
//   2. Show push notifications (bottom of this file). The phone wakes this
//      script when a message arrives, even with the app closed.
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

// ---------- Push notifications ----------
// Rails sends { title, body, path, tag } (see Push.notify in app/models/push.rb).

self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    // Not JSON: show a plain notification rather than nothing.
  }

  // waitUntil keeps the worker awake until the notification is on screen.
  event.waitUntil(
    self.registration.showNotification(data.title || "The Comfy Zone", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // Same tag = the newer one replaces the older instead of stacking up.
      // renotify makes the replacement buzz again.
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { path: data.path || "/" },
    })
  )
})

// Tapping a notification opens the page it is about. If the app is already
// open somewhere, that window is brought forward and sent there instead of
// opening a second copy.
self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const path = (event.notification.data && event.notification.data.path) || "/"

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => "focus" in client)
      if (open) return open.focus().then((client) => (client && "navigate" in client ? client.navigate(path) : undefined))
      return self.clients.openWindow(path)
    })
  )
})
