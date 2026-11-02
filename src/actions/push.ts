"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sendPush, type SendSummary } from "@/lib/push";
import { getCurrentUserId } from "@/lib/session";
import { pushEndpointSchema, pushSubscriptionSchema } from "@/lib/validations/push";
import type { ActionResult } from "@/types/actions";

const NOT_SIGNED_IN = "You're signed out. Sign in and try again.";

const SUBSCRIPTION_SELECT = { id: true, endpoint: true, p256dh: true, auth: true } as const;

// Turning the reminder on from this device: store its subscription and switch the reminder on.
// Upserting by endpoint also moves a browser's subscription to whoever is signed in now.
export async function saveSubscription(input: unknown): Promise<ActionResult<null>> {
  const userId = await getCurrentUserId();
  if (!userId) return { success: false, error: NOT_SIGNED_IN };

  const parsed = pushSubscriptionSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "This browser sent an invalid subscription." };
  const { endpoint, keys } = parsed.data;

  try {
    await prisma.$transaction([
      prisma.pushSubscription.upsert({
        where: { endpoint },
        create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
        update: { userId, p256dh: keys.p256dh, auth: keys.auth },
      }),
      prisma.user.update({ where: { id: userId }, data: { reviewNotify: true } }),
    ]);
  } catch (err) {
    console.error("saveSubscription failed", err);
    return { success: false, error: "Couldn't turn on the reminder. Try again." };
  }
  revalidatePath("/settings");
  return { success: true, data: null };
}

// Turning the reminder off from this device: forget its subscription and switch the reminder off.
export async function removeSubscription(endpoint: unknown): Promise<ActionResult<null>> {
  const userId = await getCurrentUserId();
  if (!userId) return { success: false, error: NOT_SIGNED_IN };

  const parsed = pushEndpointSchema.safeParse(endpoint);
  if (!parsed.success) return { success: false, error: "Invalid subscription." };

  try {
    await prisma.$transaction([
      prisma.pushSubscription.deleteMany({ where: { endpoint: parsed.data, userId } }),
      prisma.user.update({ where: { id: userId }, data: { reviewNotify: false } }),
    ]);
  } catch (err) {
    console.error("removeSubscription failed", err);
    return { success: false, error: "Couldn't turn off the reminder. Try again." };
  }
  revalidatePath("/settings");
  return { success: true, data: null };
}

// Sends a sample to every device the user has turned the reminder on for.
export async function sendTestNotification(): Promise<ActionResult<SendSummary>> {
  const userId = await getCurrentUserId();
  if (!userId) return { success: false, error: NOT_SIGNED_IN };

  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
      select: SUBSCRIPTION_SELECT,
    });
    if (subscriptions.length === 0) {
      return { success: false, error: "Turn on the reminder on this device first." };
    }
    const summary = await sendPush(subscriptions, {
      title: "Notifications are on",
      body: "Your weekly review will arrive here on Sundays at 7:00 PM.",
      url: "/review",
    });
    if (summary.sent === 0) {
      return { success: false, error: "Couldn't send the test notification. Try turning the reminder off and on." };
    }
    return { success: true, data: summary };
  } catch (err) {
    console.error("sendTestNotification failed", err);
    return { success: false, error: "Couldn't send the test notification. Try again." };
  }
}
