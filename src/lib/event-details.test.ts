import { describe, expect, it } from "vitest";
import { toEventDetails } from "@/lib/event-details";
import type { EventView } from "@/types/events";

const NY = "America/New_York";

function event(overrides: Partial<EventView>): EventView {
  return {
    id: "ev1",
    title: "Dentist",
    notes: null,
    location: null,
    color: "BLUE",
    allDay: false,
    startAt: new Date("2026-10-28T13:00:00Z"),
    endAt: new Date("2026-10-28T14:00:00Z"),
    ...overrides,
  };
}

describe("toEventDetails", () => {
  it("formats a timed event in the user's zone with its duration", () => {
    const details = toEventDetails(event({ location: "Main St", notes: "Bring card" }), NY);
    expect(details).toMatchObject({
      id: "ev1",
      dayLabel: "Wednesday, October 28",
      timeLabel: "9:00 AM – 10:00 AM (1h)",
      location: "Main St",
      notes: "Bring card",
    });
    expect(details.form).toEqual({
      title: "Dentist",
      date: "2026-10-28",
      allDay: false,
      startTime: "09:00",
      endTime: "10:00",
      location: "Main St",
      notes: "Bring card",
      color: "BLUE",
    });
  });

  it("uses the user's day, not the UTC day, late in the evening", () => {
    // 02:00 UTC Oct 29 is 10 PM Oct 28 in New York.
    const details = toEventDetails(
      event({
        startAt: new Date("2026-10-29T02:00:00Z"),
        endAt: new Date("2026-10-29T02:45:00Z"),
      }),
      NY,
    );
    expect(details.dayLabel).toBe("Wednesday, October 28");
    expect(details.timeLabel).toBe("10:00 PM – 10:45 PM (45 min)");
    expect(details.form).toMatchObject({
      date: "2026-10-28",
      startTime: "22:00",
      endTime: "22:45",
    });
  });

  it("counts the real duration across the fall-back hour", () => {
    // Nov 1 2026: 1:00 AM EDT (05:00 UTC) to 3:00 AM EST (08:00 UTC) is 3 hours.
    const details = toEventDetails(
      event({
        startAt: new Date("2026-11-01T05:00:00Z"),
        endAt: new Date("2026-11-01T08:00:00Z"),
      }),
      NY,
    );
    expect(details.timeLabel).toBe("1:00 AM – 3:00 AM (3h)");
  });

  it("names the end day when a timed event runs past midnight", () => {
    const details = toEventDetails(
      event({
        startAt: new Date("2026-10-29T03:00:00Z"),
        endAt: new Date("2026-10-29T05:30:00Z"),
      }),
      NY,
    );
    expect(details.timeLabel).toBe("11:00 PM – Thu, Oct 29, 1:30 AM (2h 30m)");
  });

  it("reads an all-day event as UTC dates, whatever the zone", () => {
    const allDay = event({
      allDay: true,
      color: "GREEN",
      startAt: new Date("2026-10-28T00:00:00Z"),
      endAt: new Date("2026-10-29T00:00:00Z"),
    });
    for (const tz of [NY, "Pacific/Auckland", "UTC"]) {
      const details = toEventDetails(allDay, tz);
      expect(details).toMatchObject({
        dayLabel: "Wednesday, October 28",
        timeLabel: "All day",
      });
      expect(details.form).toMatchObject({
        date: "2026-10-28",
        allDay: true,
        color: "GREEN",
      });
    }
  });

  it("shows the day range of a multi-day all-day event", () => {
    const details = toEventDetails(
      event({
        allDay: true,
        startAt: new Date("2026-10-30T00:00:00Z"),
        endAt: new Date("2026-11-02T00:00:00Z"),
      }),
      NY,
    );
    expect(details.dayLabel).toBe("Friday, October 30 – Sunday, November 1");
  });
});
