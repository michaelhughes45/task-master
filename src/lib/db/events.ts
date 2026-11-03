import "server-only";
import { addDays, dayEndInstant, dayStartInstant, toDbDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { expandEvent } from "@/lib/recurrence";
import type { Prisma } from "@/generated/prisma/client";
import type { DateStr } from "@/types/dates";
import type { EventView } from "@/types/events";

// Also used by the occurrence actions, which load one series the same way.
export const EVENT_SELECT = {
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
// in the range, every repeating series that started by its end, and any later series with an
// occurrence moved into the range, then expands them.
export async function getEventsInRange(
  userId: string,
  firstDay: DateStr,
  lastDay: DateStr,
  tz: string,
): Promise<EventView[]> {
  const repeats = { rrule: { not: null } } satisfies Prisma.EventWhereInput;
  const timed = { lt: dayEndInstant(lastDay, tz), gt: dayStartInstant(firstDay, tz) };
  const allDay = { lt: toDbDate(addDays(lastDay, 1)), gt: toDbDate(firstDay) };
  // Moved occurrences store both startAt and endAt (planEventEdit sets them together).
  const movedInto = ({ lt, gt }: { lt: Date; gt: Date }) =>
    ({ some: { cancelled: false, startAt: { lt }, endAt: { gt } } }) satisfies Prisma.EventExceptionListRelationFilter;
  const events = await prisma.event.findMany({
    where: {
      userId,
      OR: [
        { allDay: false, startAt: { lt: timed.lt }, OR: [{ endAt: { gt: timed.gt } }, repeats] },
        { allDay: true, startAt: { lt: allDay.lt }, OR: [{ endAt: { gt: allDay.gt } }, repeats] },
        { allDay: false, ...repeats, exceptions: movedInto(timed) },
        { allDay: true, ...repeats, exceptions: movedInto(allDay) },
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
          series: event.rrule ? { rrule: event.rrule } : null,
        }),
      ),
    )
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.startAt.getTime() - b.startAt.getTime());
}
