"use server";

import { invalid, NOT_SIGNED_IN } from "@/lib/action-helpers";
import { resolveTimezone } from "@/lib/dates";
import { EVENT_SELECT } from "@/lib/db/events";
import { EVENT_NOT_FOUND, resolveEvent, revalidateEvents } from "@/lib/event-actions";
import { prisma } from "@/lib/prisma";
import { NOT_AN_OCCURRENCE, planEventDelete, planEventEdit, type EventPlan } from "@/lib/recurrence-edit";
import { getSession } from "@/lib/session";
import { eventIdSchema, occurrenceEventSchema, occurrenceStartSchema } from "@/lib/validations/events";
import { editScopeSchema } from "@/lib/validations/repeat";
import type { ActionResult, Failure } from "@/types/actions";

type Plan = Exclude<EventPlan, { type: "error" }>;

// Shared checks for the occurrence actions: signed in, valid ids and scope, and an own
// repeating event, loaded with its exceptions.
async function resolveSeries(userId: string, id: unknown, occurrenceStart: unknown, scope: unknown) {
  const eventId = eventIdSchema.safeParse(id);
  if (!eventId.success) return { success: false, error: EVENT_NOT_FOUND } satisfies Failure;
  const start = occurrenceStartSchema.safeParse(occurrenceStart);
  if (!start.success) return { success: false, error: NOT_AN_OCCURRENCE } satisfies Failure;
  const editScope = editScopeSchema.safeParse(scope);
  if (!editScope.success) return invalid(editScope.error);

  const row = await prisma.event.findFirst({ where: { id: eventId.data, userId }, select: EVENT_SELECT });
  if (!row) return { success: false, error: EVENT_NOT_FOUND } satisfies Failure;
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
