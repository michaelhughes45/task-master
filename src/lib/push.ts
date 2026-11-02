import "server-only";
import webpush, { WebPushError } from "web-push";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { isPushServiceEndpoint } from "@/lib/validations/push";

export interface PushPayload {
  title: string;
  body: string;
  // Opened when the notification is clicked
  url: string;
}

export interface StoredSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface SendSummary {
  sent: number;
  removed: number;
  failed: number;
}

// The push service no longer knows this subscription (unsubscribed, expired, app removed).
const GONE = new Set([404, 410]);
// Keep it a day: a review notification a day late is still useful, later isn't.
const TTL_SECONDS = 24 * 60 * 60;
// web-push has no default timeout: a push service that never answers would hold the cron
// until it's killed at maxDuration. A stalled send counts as failed instead.
const SEND_TIMEOUT_MS = 10_000;

function vapidDetails() {
  const { NEXT_PUBLIC_VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: subject } = env;
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}

export function isPushConfigured() {
  return vapidDetails() !== null;
}

// Logs name the push service only: endpoints identify a device and keys are secrets.
function endpointHost(endpoint: string) {
  try {
    return new URL(endpoint).host;
  } catch {
    return "invalid endpoint";
  }
}

type Outcome = "sent" | "removed" | "failed";

async function sendOne(subscription: StoredSubscription, payload: string): Promise<Outcome> {
  const details = vapidDetails();
  if (!details) return "failed";
  // Rows saved before the push service allowlist could point anywhere: never POST to those.
  if (!isPushServiceEndpoint(subscription.endpoint)) {
    console.error(`Skipped push to ${endpointHost(subscription.endpoint)}: not a known push service`);
    return "failed";
  }
  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      payload,
      { vapidDetails: details, TTL: TTL_SECONDS, timeout: SEND_TIMEOUT_MS },
    );
    return "sent";
  } catch (err) {
    if (err instanceof WebPushError && GONE.has(err.statusCode)) return "removed";
    const status = err instanceof WebPushError ? err.statusCode : "no response";
    console.error(`Push to ${endpointHost(subscription.endpoint)} failed (${status})`);
    return "failed";
  }
}

// Sends to every subscription and deletes the ones the push service says are gone.
export async function sendPush(subscriptions: StoredSubscription[], payload: PushPayload): Promise<SendSummary> {
  if (!isPushConfigured()) {
    console.error("Push is not configured: set the VAPID environment variables");
    return { sent: 0, removed: 0, failed: subscriptions.length };
  }
  const body = JSON.stringify(payload);
  const outcomes = await Promise.all(subscriptions.map((subscription) => sendOne(subscription, body)));

  const goneIds = subscriptions.filter((_, i) => outcomes[i] === "removed").map(({ id }) => id);
  if (goneIds.length > 0) await prisma.pushSubscription.deleteMany({ where: { id: { in: goneIds } } });

  const count = (outcome: Outcome) => outcomes.filter((o) => o === outcome).length;
  return { sent: count("sent"), removed: count("removed"), failed: count("failed") };
}
