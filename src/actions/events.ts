"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addDays, resolveTimezone, toDbDate, wallTimeToInstant } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { NOT_AN_OCCURRENCE, planEventDelete, planEventEdit, type EventPlan } from "@/lib/recurrence-edit";
import { normalizeRRule } from "@/lib/rrule-builder";
import { getSession } from "@/lib/session";
import {
  END_BEFORE_START,
  eventIdSchema,
  eventSchema,
  occurrenceEventSchema,
  occurrenceStartSchema,
  type EventInput,
} from "@/lib/validations/events";
import { editScopeSchema } from "@/lib/validations/repeat";
import type { Prisma } from "@/generated/prisma/client";
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
async function resolveEvent(input: unknown, schema: typeof occurrenceEventSchema = eventSchema) {
  const session = await getSession();
  if (!session) return { success: false, error: NOT_SIGNED_IN } satisfies Failure;

  const parsed = schema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const tz = resolveTimezone(session.user);
  const times = eventTimes(parsed.data, tz);
  if ("success" in times) return times;

  const { title, notes, location, color, allDay, rrule } = parsed.data;
  return {
    success: true as const,
    userId: session.user.id,
    tz,
    data: {
      title,
      notes: notes ?? null,
      location: location ?? null,
      color,
      allDay,
      rrule: rrule ? normalizeRRule(rrule) : null,
      ...times,
    },
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

const SERIES_SELECT = {
  id: true,
  title: true,
  notes: true,
  location: true,
  color: true,
  allDay: true,
  startAt: true,
  endAt: true,
  rrule: true,
  exceptions: {
    select: { occurrenceStart: true, cancelled: true, title: true, startAt: true, endAt: true, notes: true, location: true },
  },
} satisfies Prisma.EventSelect;

type Plan = Exclude<EventPlan, { type: "error" }>;

// Shared checks for the occurrence actions: signed in, valid ids and scope, and an own
// repeating event, loaded with its exceptions.
async function resolveSeries(userId: string, id: unknown, occurrenceStart: unknown, scope: unknown) {
  const eventId = eventIdSchema.safeParse(id);
  if (!eventId.success) return { success: false, error: NOT_FOUND } satisfies Failure;
  const start = occurrenceStartSchema.safeParse(occurrenceStart);
  if (!start.success) return { success: false, error: NOT_AN_OCCURRENCE } satisfies Failure;
  const editScope = editScopeSchema.safeParse(scope);
  if (!editScope.success) return invalid(editScope.error);

  const row = await prisma.event.findFirst({ where: { id: eventId.data, userId }, select: SERIES_SELECT });
  if (!row) return { success: false, error: NOT_FOUND } satisfies Failure;
  if (!row.rrule) return { success: false, error: "That event doesn't repeat." } satisfies Failure;
  const { exceptions, ...series } = row;
  return {
    success: true as const,
    series: { ...series, rrule: row.rrule },
    exceptions,
    occurrenceStart: start.data,
    scope: editScope.data,
  };
}

// Writes a plan in one transaction. A changed series' exceptions are replaced as a whole, so
// re-keyed ones can't collide with the old keys.
async function runPlan(plan: Plan, eventId: string, userId: string) {
  await prisma.$transaction(async (tx) => {
    switch (plan.type) {
      case "exception": {
        const { occurrenceStart, ...fields } = plan.row;
        await tx.eventException.upsert({
          where: { eventId_occurrenceStart: { eventId, occurrenceStart } },
          create: { eventId, ...plan.row },
          update: fields,
        });
        return;
      }
      case "update":
        await tx.event.update({ where: { id: eventId, userId }, data: plan.data });
        await tx.eventException.deleteMany({ where: { eventId } });
        await tx.eventException.createMany({ data: plan.exceptions.map((e) => ({ eventId, ...e })) });
        return;
      case "split":
        await tx.event.update({ where: { id: eventId, userId }, data: { rrule: plan.rule } });
        await tx.eventException.deleteMany({ where: { eventId, occurrenceStart: { gte: plan.from } } });
        await tx.event.create({ data: { userId, ...plan.next, exceptions: { create: plan.exceptions } } });
        return;
      case "end":
        await tx.event.update({ where: { id: eventId, userId }, data: { rrule: plan.rule } });
        await tx.eventException.deleteMany({ where: { eventId, occurrenceStart: { gte: plan.from } } });
        return;
      case "delete":
        await tx.event.deleteMany({ where: { id: eventId, userId } });
    }
  });
}

function planFailure(plan: Extract<EventPlan, { type: "error" }>): Failure {
  return { success: false, error: plan.error, fieldErrors: plan.field ? { [plan.field]: [plan.error] } : undefined };
}

// Saves the event form for one occurrence of a repeating event, this and the following ones,
// or all of them. `occurrenceStart` is the occurrence's original start (ISO).
export async function updateEventOccurrence(
  id: unknown,
  occurrenceStart: unknown,
  scope: unknown,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const event = await resolveEvent(input, occurrenceEventSchema);
  if (!event.success) return event;

  try {
    const target = await resolveSeries(event.userId, id, occurrenceStart, scope);
    if (!target.success) return target;

    const plan = planEventEdit(
      target.series,
      target.exceptions,
      target.occurrenceStart,
      target.scope,
      event.data,
      event.tz,
    );
    if (plan.type === "error") return planFailure(plan);

    await runPlan(plan, target.series.id, event.userId);
    revalidateEvents();
    return { success: true, data: { id: target.series.id } };
  } catch (err) {
    console.error("updateEventOccurrence failed", err);
    return { success: false, error: "Couldn't save the event. Try again." };
  }
}

export async function deleteEventOccurrence(
  id: unknown,
  occurrenceStart: unknown,
  scope: unknown,
): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  if (!session) return { success: false, error: NOT_SIGNED_IN };

  try {
    const target = await resolveSeries(session.user.id, id, occurrenceStart, scope);
    if (!target.success) return target;

    const tz = resolveTimezone(session.user);
    const plan = planEventDelete(target.series, target.exceptions, target.occurrenceStart, target.scope, tz);
    if (plan.type === "error") return planFailure(plan);

    await runPlan(plan, target.series.id, session.user.id);
    revalidateEvents();
    return { success: true, data: { id: target.series.id } };
  } catch (err) {
    console.error("deleteEventOccurrence failed", err);
    return { success: false, error: "Couldn't delete the event. Try again." };
  }
}
