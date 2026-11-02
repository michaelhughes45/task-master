"use server";

import { revalidatePath } from "next/cache";
import { NOT_SIGNED_IN } from "@/lib/action-helpers";
import { prisma } from "@/lib/prisma";
import { sendPush, type SendSummary } from "@/lib/push";
import { getCurrentUserId } from "@/lib/session";
import { pushEndpointSchema, pushSubscriptionSchema } from "@/lib/validations/push";
import type { ActionResult } from "@/types/actions";

const SUBSCRIPTION_SELECT = { id: true, endpoint: true, p256dh: true, auth: true } as const;

// Time between test notifications, so the button can't be used to flood the user's devices.
const TEST_PUSH_COOLDOWN_MS = 30_000;

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
    // Claims the send in one conditional update, so two quick clicks can't both get through.
    const now = new Date();
    const { count } = await prisma.user.updateMany({
      where: {
        id: userId,
        OR: [{ lastTestPushAt: null }, { lastTestPushAt: { lte: new Date(now.getTime() - TEST_PUSH_COOLDOWN_MS) } }],
      },
      data: { lastTestPushAt: now },
    });
    if (count === 0) return { success: false, error: "A test was just sent. Wait 30 seconds and try again." };
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
