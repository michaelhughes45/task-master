import "server-only";
import { addDays, dayEndInstant, dayStartInstant, toDbDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { expandEvent } from "@/lib/recurrence";
import type { Prisma } from "@/generated/prisma/client";
import type { DateStr } from "@/types/dates";
import type { EventView } from "@/types/events";

const EVENT_SELECT = {
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
    select: {
      occurrenceStart: true,
      cancelled: true,
      title: true,
      startAt: true,
      endAt: true,
      notes: true,
      location: true,
    },
  },
} satisfies Prisma.EventSelect;

// Event occurrences overlapping firstDay..lastDay (inclusive) in the user's timezone, all-day
// ones first, then by start. Timed events are compared as instants; all-day events by their
// UTC dates, so an all-day event stays on its day whatever the timezone. Loads one-off events
// in the range and every repeating series that started by its end, then expands them.
export async function getEventsInRange(
  userId: string,
  firstDay: DateStr,
  lastDay: DateStr,
  tz: string,
): Promise<EventView[]> {
  const repeats = { rrule: { not: null } } satisfies Prisma.EventWhereInput;
  const events = await prisma.event.findMany({
    where: {
      userId,
      OR: [
        {
          allDay: false,
          startAt: { lt: dayEndInstant(lastDay, tz) },
          OR: [{ endAt: { gt: dayStartInstant(firstDay, tz) } }, repeats],
        },
        {
          allDay: true,
          startAt: { lt: toDbDate(addDays(lastDay, 1)) },
          OR: [{ endAt: { gt: toDbDate(firstDay) } }, repeats],
        },
      ],
    },
    select: EVENT_SELECT,
    orderBy: [{ allDay: "desc" }, { startAt: "asc" }],
  });

  return events
    .flatMap((event) =>
      expandEvent(event, event.exceptions, firstDay, lastDay, tz).map(
        (o): EventView => ({
          id: o.id,
          key: `${o.id}@${o.occurrenceStart.toISOString()}`,
          occurrenceStart: o.occurrenceStart,
          title: o.title,
          notes: o.notes,
          location: o.location,
          color: o.color,
          allDay: o.allDay,
          startAt: o.startAt,
          endAt: o.endAt,
        }),
      ),
    )
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.startAt.getTime() - b.startAt.getTime());
}
