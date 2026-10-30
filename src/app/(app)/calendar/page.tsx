import type { Metadata } from "next";
import { CalendarToolbar } from "@/components/calendar/CalendarToolbar";
import { PhoneDayRedirect } from "@/components/calendar/PhoneDayRedirect";
import { TimeGrid } from "@/components/calendar/TimeGrid";
import { PageHeader } from "@/components/layout/PageHeader";
import { buildCalendarColumns, calendarDays, calendarHref, parseView, rangeLabel } from "@/lib/calendar-view";
import { isDateStr, parseDateParam, resolveTimezone, todayIn } from "@/lib/dates";
import { getEventsInRange } from "@/lib/db/events";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Calendar" };

// Reads the session and searchParams.
export const instant = false;

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const user = await requireUser();
  const tz = resolveTimezone(user);
  const today = todayIn(tz);
  const params = await searchParams;
  const view = parseView(params.view);
  const date = parseDateParam(params.date, today);
  const days = calendarDays(view, date);

  const events = await getEventsInRange(user.id, days[0], days[days.length - 1], tz);
  const { columns, scrollHour } = buildCalendarColumns({ events, days, today, view, tz });
  const label = rangeLabel(view, date);

  return (
    <>
      <PageHeader kicker="Calendar" title={label} />
      <div className="flex flex-col gap-4 px-4 py-6 md:px-8">
        <CalendarToolbar view={view} date={date} label={label} />
        <TimeGrid columns={columns} scrollHour={scrollHour} tz={tz} />
      </div>
      {params.view === undefined && (
        <PhoneDayRedirect href={calendarHref("day", isDateStr(params.date) ? params.date : undefined)} />
      )}
    </>
  );
}
