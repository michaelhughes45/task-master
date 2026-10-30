import "server-only";
import { addDays, dayEndInstant, dayStartInstant, toDbDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
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
} satisfies Prisma.EventSelect;

// Events overlapping firstDay..lastDay (inclusive) in the user's timezone, all-day ones first.
// Timed events are compared as instants; all-day events by their UTC dates, so an all-day
// event stays on its day whatever the timezone.
export async function getEventsInRange(
  userId: string,
  firstDay: DateStr,
  lastDay: DateStr,
  tz: string,
): Promise<EventView[]> {
  return prisma.event.findMany({
    where: {
      userId,
      OR: [
        {
          allDay: false,
          startAt: { lt: dayEndInstant(lastDay, tz) },
          endAt: { gt: dayStartInstant(firstDay, tz) },
        },
        {
          allDay: true,
          startAt: { lt: toDbDate(addDays(lastDay, 1)) },
          endAt: { gt: toDbDate(firstDay) },
        },
      ],
    },
    select: EVENT_SELECT,
    orderBy: [{ allDay: "desc" }, { startAt: "asc" }],
  });
}
