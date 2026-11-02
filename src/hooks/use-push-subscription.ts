"use client";

import { useEffect, useState } from "react";
import { removeSubscription, saveSubscription } from "@/actions/push";
import { isIos, isStandalone } from "@/lib/platform";

// What this browser can do about the reminder:
// - checking: not known yet (server render, first paint)
// - unsupported: no push here, or push isn't configured on the server
// - ios-not-installed: iPhone/iPad Safari, where push only works from the Home Screen app
// - denied: the user blocked notifications for the site
// - ready: can subscribe; `subscribed` says whether this device already is
export type PushStatus =
  | { kind: "checking" }
  | { kind: "unsupported" }
  | { kind: "ios-not-installed" }
  | { kind: "denied" }
  | { kind: "ready"; subscribed: boolean };

type Outcome = { ok: true } | { ok: false; error: string };

function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// The service worker only registers in production builds (RegisterServiceWorker).
function workerAvailable() {
  return process.env.NODE_ENV === "production";
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

async function detect(): Promise<PushStatus> {
  if (isIos() && !isStandalone()) return { kind: "ios-not-installed" };
  if (!pushSupported() || !workerAvailable()) return { kind: "unsupported" };
  if (Notification.permission === "denied") return { kind: "denied" };
  return { kind: "ready", subscribed: (await currentSubscription()) !== null };
}

// VAPID keys are URL-safe base64; pushManager.subscribe wants the raw bytes.
function keyBytes(base64Url: string) {
  const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function sameKey(a: ArrayBuffer | null, b: Uint8Array) {
  if (!a || a.byteLength !== b.length) return false;
  return new Uint8Array(a).every((byte, i) => byte === b[i]);
}

// Reuses this browser's subscription when it was made with the same key; otherwise replaces it.
async function subscribe(publicKey: string) {
  const registration = await navigator.serviceWorker.ready;
  const key = keyBytes(publicKey);
  const existing = await registration.pushManager.getSubscription();
  if (existing && sameKey(existing.options.applicationServerKey, key)) return existing;
  await existing?.unsubscribe();
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
}

export function usePushSubscription(publicKey: string | null) {
  const [status, setStatus] = useState<PushStatus>({ kind: "checking" });

  useEffect(() => {
    let active = true;
    const check = publicKey ? detect() : Promise.resolve<PushStatus>({ kind: "unsupported" });
    check
      .catch((): PushStatus => ({ kind: "unsupported" }))
      .then((next) => {
        if (active) setStatus(next);
      });
    return () => {
      active = false;
    };
  }, [publicKey]);

  // Must run straight from a click: browsers only show the permission prompt for a user gesture.
  async function enable(): Promise<Outcome> {
    if (!publicKey) return { ok: false, error: "Notifications aren't available." };
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      if (permission === "denied") setStatus({ kind: "denied" });
      return { ok: false, error: "Notifications weren't allowed." };
    }
    try {
      const subscription = await subscribe(publicKey);
      const result = await saveSubscription(subscription.toJSON());
      if (!result.success) return { ok: false, error: result.error };
      setStatus({ kind: "ready", subscribed: true });
      return { ok: true };
    } catch (err) {
      console.error("Push subscribe failed", err);
      return { ok: false, error: "Couldn't turn on notifications in this browser." };
    }
  }

  // Server first: if that fails the device stays subscribed and matches what's stored.
  async function disable(): Promise<Outcome> {
    try {
      const subscription = await currentSubscription();
      if (subscription) {
        const result = await removeSubscription(subscription.endpoint);
        if (!result.success) return { ok: false, error: result.error };
        await subscription.unsubscribe();
      }
      setStatus({ kind: "ready", subscribed: false });
      return { ok: true };
    } catch (err) {
      console.error("Push unsubscribe failed", err);
      return { ok: false, error: "Couldn't turn off notifications in this browser." };
    }
  }

  return { status, enable, disable };
}
