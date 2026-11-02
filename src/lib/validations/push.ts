import { z } from "zod";

// Hosts of the browsers' push services: FCM (Chrome, Edge on Android, most Chromium browsers),
// Mozilla (Firefox), WNS (Edge on Windows) and Apple (Safari, iPhone).
const PUSH_SERVICE_HOSTS = ["fcm.googleapis.com"];
const PUSH_SERVICE_DOMAINS = ["push.services.mozilla.com", "notify.windows.com", "push.apple.com"];

// The server POSTs to stored endpoints, so only real push services are accepted (no SSRF).
export function isPushServiceEndpoint(endpoint: string) {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const host = url.hostname;
  return (
    PUSH_SERVICE_HOSTS.includes(host) ||
    PUSH_SERVICE_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`))
  );
}

// Push services hand out https endpoints; anything else is refused before it's stored.
export const pushEndpointSchema = z.url({ protocol: /^https$/ }).max(2048);

// The shape of PushSubscription.toJSON() in the browser.
export const pushSubscriptionSchema = z.object({
  endpoint: pushEndpointSchema.refine(isPushServiceEndpoint, "Not a known push service."),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(64),
  }),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
