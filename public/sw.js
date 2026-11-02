// Minimal service worker: makes the app installable and takes over pages straight away.
// Requests go to the network as usual; nothing is cached. Push handling arrives with spec 22.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Network-first passthrough: same-origin GETs go to the network unchanged; everything else
// is left to the browser.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  // fetch() throws for this combination (DevTools sends it), so let the browser handle it
  if (request.cache === "only-if-cached" && request.mode !== "same-origin") return;
  event.respondWith(fetch(request));
});
