"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addDays, resolveTimezone, toDbDate, wallTimeToInstant } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { END_BEFORE_START, eventIdSchema, eventSchema, type EventInput } from "@/lib/validations/events";
import type { ActionResult } from "@/types/actions";

const NOT_SIGNED_IN = "You're signed out. Sign in and try again.";
const NOT_FOUND = "That event doesn't exist or was deleted.";

type Failure = Extract<ActionResult<never>, { success: false }>;
type Times = { startAt: Date; endAt: Date };

function revalidateEvents() {
  revalidatePath("/today");
  revalidatePath("/calendar");
}

function invalid(error: z.ZodError): Failure {
  const { fieldErrors } = z.flattenError(error);
  return {
    success: false,
    error: error.issues[0].message,
    fieldErrors: fieldErrors as Record<string, string[]>,
  };
}

// All-day events are stored as UTC dates (see the Event model); timed ones as instants of the
// wall times in the user's timezone. A skipped DST time can push the start past the end.
function eventTimes(event: EventInput, tz: string): Failure | Times {
  if (event.allDay) return { startAt: toDbDate(event.date), endAt: toDbDate(addDays(event.date, 1)) };

  // The schema requires both times when the event isn't all day.
  const startAt = wallTimeToInstant(event.date, event.startTime as string, tz);
  const endAt = wallTimeToInstant(event.date, event.endTime as string, tz);
  if (endAt <= startAt) {
    return { success: false, error: END_BEFORE_START, fieldErrors: { endTime: [END_BEFORE_START] } };
  }
  return { startAt, endAt };
}

// Shared checks for create and update: signed in and valid input, turned into the row's fields.
async function resolveEvent(input: unknown) {
  const session = await getSession();
  if (!session) return { success: false, error: NOT_SIGNED_IN } satisfies Failure;

  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const times = eventTimes(parsed.data, resolveTimezone(session.user));
  if ("success" in times) return times;

  const { title, notes, location, color, allDay } = parsed.data;
  return {
    success: true as const,
    userId: session.user.id,
    data: { title, notes: notes ?? null, location: location ?? null, color, allDay, ...times },
  };
}

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
  if (!eventId.success) return { success: false, error: NOT_FOUND };
  const event = await resolveEvent(input);
  if (!event.success) return event;

  try {
    const { count } = await prisma.event.updateMany({
      where: { id: eventId.data, userId: event.userId },
      data: event.data,
    });
    if (count === 0) return { success: false, error: NOT_FOUND };
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
  if (!eventId.success) return { success: false, error: NOT_FOUND };

  try {
    const { count } = await prisma.event.deleteMany({ where: { id: eventId.data, userId: session.user.id } });
    if (count === 0) return { success: false, error: NOT_FOUND };
    revalidateEvents();
    return { success: true, data: { id: eventId.data } };
  } catch (err) {
    console.error("deleteEvent failed", err);
    return { success: false, error: "Couldn't delete the event. Try again." };
  }
}
