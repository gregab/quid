// Aviary Service Worker — lightweight app-shell caching
const CACHE_VERSION = "aviary-v1";
const APP_SHELL_CACHE = `app-shell-${CACHE_VERSION}`;

// App shell resources to pre-cache
const APP_SHELL = ["/offline.html"];

// Install: pre-cache the offline fallback
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  // Activate immediately — don't wait for old tabs to close
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== APP_SHELL_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  // Take control of all open tabs immediately
  self.clients.claim();
});

// Fetch: network-first for everything, offline fallback for navigations
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Skip non-GET requests and cross-origin requests
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) {
    return;
  }

  // API calls: always network, no caching
  if (request.url.includes("/api/")) {
    return;
  }

  // Navigation requests: network-first with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html"))
    );
    return;
  }

  // Static assets (JS, CSS, images): stale-while-revalidate
  if (
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "image" ||
    request.destination === "font"
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetched = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
        return cached || fetched;
      })
    );
    return;
  }
});
