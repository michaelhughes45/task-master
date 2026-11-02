// Service worker: makes the app installable, takes over pages straight away and shows the
// Sunday review push notification. Requests go to the network as usual; nothing is cached.

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

const DEFAULT_NOTIFICATION = {
  title: "Your weekly review is ready",
  body: "See how your week went.",
  url: "/review",
};

function readPayload(event) {
  try {
    return { ...DEFAULT_NOTIFICATION, ...event.data.json() };
  } catch {
    return DEFAULT_NOTIFICATION;
  }
}

// Only same-origin paths are opened, whatever the payload says.
function safePath(url) {
  return typeof url === "string" && url.startsWith("/") && !url.startsWith("//") ? url : "/review";
}

self.addEventListener("push", (event) => {
  const { title, body, url } = readPayload(event);
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "weekly-review",
      data: { url: safePath(url) },
    }),
  );
});

// Focus an open Task Master window and take it to the review, or open a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(safePath(event.notification.data?.url), self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        if ("navigate" in existing) await existing.navigate(target);
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
