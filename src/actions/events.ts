"use server";

import { NOT_SIGNED_IN } from "@/lib/action-helpers";
import { EVENT_NOT_FOUND, resolveEvent, revalidateEvents } from "@/lib/event-actions";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { eventIdSchema } from "@/lib/validations/events";
import type { ActionResult } from "@/types/actions";

export async function createEvent(input: unknown): Promise<ActionResult<{ id: string }>> {
  const event = await resolveEvent(input);
  if (!event.success) return event;

  try {
    const created = await prisma.event.create({
      data: { userId: event.userId, ...event.data },
      select: { id: true },
    });
    revalidateEvents();
    return { success: true, data: created };
  } catch (err) {
    console.error("createEvent failed", err);
    return { success: false, error: "Couldn't add the event. Try again." };
  }
}

export async function updateEvent(id: unknown, input: unknown): Promise<ActionResult<{ id: string }>> {
  const eventId = eventIdSchema.safeParse(id);
  if (!eventId.success) return { success: false, error: EVENT_NOT_FOUND };
  const event = await resolveEvent(input);
  if (!event.success) return event;

  try {
    const { count } = await prisma.event.updateMany({
      where: { id: eventId.data, userId: event.userId },
      data: event.data,
    });
    if (count === 0) return { success: false, error: EVENT_NOT_FOUND };
    revalidateEvents();
    return { success: true, data: { id: eventId.data } };
  } catch (err) {
    console.error("updateEvent failed", err);
    return { success: false, error: "Couldn't save the event. Try again." };
  }
}

export async function deleteEvent(id: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  if (!session) return { success: false, error: NOT_SIGNED_IN };

  const eventId = eventIdSchema.safeParse(id);
  if (!eventId.success) return { success: false, error: EVENT_NOT_FOUND };

  try {
    const { count } = await prisma.event.deleteMany({ where: { id: eventId.data, userId: session.user.id } });
    if (count === 0) return { success: false, error: EVENT_NOT_FOUND };
    revalidateEvents();
    return { success: true, data: { id: eventId.data } };
  } catch (err) {
    console.error("deleteEvent failed", err);
    return { success: false, error: "Couldn't delete the event. Try again." };
  }
}
