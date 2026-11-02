import "server-only";
import { revalidatePath } from "next/cache";
import { invalid, NOT_SIGNED_IN } from "@/lib/action-helpers";
import { addDays, resolveTimezone, toDbDate, wallTimeToInstant } from "@/lib/dates";
import { normalizeRRule } from "@/lib/rrule-builder";
import { getSession } from "@/lib/session";
import { END_BEFORE_START, eventSchema, occurrenceEventSchema, type EventInput } from "@/lib/validations/events";
import type { Failure } from "@/types/actions";

// Shared by the event and event occurrence actions.

export const EVENT_NOT_FOUND = "That event doesn't exist or was deleted.";

type Times = { startAt: Date; endAt: Date };

export function revalidateEvents() {
  revalidatePath("/today");
  revalidatePath("/calendar");
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
export async function resolveEvent(input: unknown, schema: typeof occurrenceEventSchema = eventSchema) {
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
