"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { reviewNotifySchema, timezoneSchema } from "@/lib/validations/settings";
import type { ActionResult } from "@/types/actions";

const NOT_SIGNED_IN = "You're signed out. Sign in and try again.";

// The timezone changes "today" and the week on every page, so refresh them all.
function revalidateApp() {
  revalidatePath("/", "layout");
}

export async function updateTimezone(input: unknown): Promise<ActionResult<{ timezone: string }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { success: false, error: NOT_SIGNED_IN };

  const parsed = timezoneSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    await prisma.user.update({ where: { id: userId }, data: { timezone: parsed.data } });
  } catch (err) {
    console.error("updateTimezone failed", err);
    return { success: false, error: "Couldn't save your timezone. Try again." };
  }
  revalidateApp();
  return { success: true, data: { timezone: parsed.data } };
}

// Called once from the browser after sign-in; only fills a timezone that was never set.
export async function setTimezoneIfMissing(
  input: unknown,
): Promise<ActionResult<{ updated: boolean }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { success: false, error: NOT_SIGNED_IN };

  const parsed = timezoneSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const { count } = await prisma.user.updateMany({
      where: { id: userId, timezone: null },
      data: { timezone: parsed.data },
    });
    if (count > 0) revalidateApp();
    return { success: true, data: { updated: count > 0 } };
  } catch (err) {
    console.error("setTimezoneIfMissing failed", err);
    return { success: false, error: "Couldn't save your timezone." };
  }
}

export async function updateReviewNotify(
  input: unknown,
): Promise<ActionResult<{ reviewNotify: boolean }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { success: false, error: NOT_SIGNED_IN };

  const parsed = reviewNotifySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid setting." };

  try {
    await prisma.user.update({ where: { id: userId }, data: { reviewNotify: parsed.data } });
  } catch (err) {
    console.error("updateReviewNotify failed", err);
    return { success: false, error: "Couldn't save the reminder setting. Try again." };
  }
  revalidatePath("/settings");
  return { success: true, data: { reviewNotify: parsed.data } };
}
