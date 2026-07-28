// Seen — service worker: offline shell cache + FCM background push handling.

// ── Firebase Cloud Messaging (background messages when app is closed) ──────
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBSez1kAaFXKZzM97E9y4HhDiqE3tRAeLE",
  authDomain: "uplift-6d9ea.firebaseapp.com",
  projectId: "uplift-6d9ea",
  storageBucket: "uplift-6d9ea.firebasestorage.app",
  messagingSenderId: "821891105119",
  appId: "1:821891105119:web:6245f2bc4c8c8ee96976ea",
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  // Messages are sent as data-only (no notification field) so this is the single
  // display path — the compat SDK won't auto-show a duplicate.
  const { title = "Seen", body = "" } = payload.data ?? {};
  const link = payload.webpush?.fcmOptions?.link ?? "/";
  self.registration.showNotification(title, {
    body,
    icon: "/icon-192.png",
    badge: "/badge-96.png",
    data: { link },
  });
});

// Open (or focus) the app when a push notification is tapped.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(link);
    })
  );
});

// ── PWA shell cache (network-first, offline fallback) ────────────────────────

// Bumped v5 -> v6 so the activate handler purges the old shell cache. A device that
// precached the V1 shell keeps serving it as the offline fallback until the cache name
// changes, which is the second half of why seenapp.app could still show V1.
const CACHE = "seen-shell-v6";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/badge-96.png"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Only handle same-origin requests; let Firebase, fonts, CDNs go straight to network.
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first, fall back to the cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/index.html").then((r) => r || caches.match("/")))
    );
    return;
  }

  // Same-origin assets: network-first, fall back to cache if offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(request))
  );
});
