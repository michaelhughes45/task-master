import { describe, expect, it } from "vitest";
import { newItemDefaults } from "@/lib/new-item";

const NY = "America/New_York";

describe("newItemDefaults", () => {
  it("uses today in the user's zone and the next full hour", () => {
    // 01:30 UTC on Oct 30 is 21:30 on Oct 29 in New York.
    const now = new Date("2026-10-30T01:30:00Z");
    expect(newItemDefaults("", NY, now)).toEqual({
      date: "2026-10-29",
      startTime: "22:00",
      endTime: "23:00",
    });
  });

  it("uses the page's ?date= when it is a real day", () => {
    const now = new Date("2026-10-30T13:05:00Z");
    expect(newItemDefaults("?view=week&date=2026-11-04", NY, now)).toEqual({
      date: "2026-11-04",
      startTime: "10:00",
      endTime: "11:00",
    });
  });

  it("falls back to today for a bad ?date=", () => {
    const now = new Date("2026-10-30T13:05:00Z");
    expect(newItemDefaults("?date=2026-02-30", NY, now).date).toBe("2026-10-30");
  });

  it("starts the next hour even on the hour", () => {
    const now = new Date("2026-10-30T13:00:00Z");
    expect(newItemDefaults("", NY, now)).toMatchObject({
      startTime: "10:00",
      endTime: "11:00",
    });
  });

  it("stays within the day late at night", () => {
    expect(newItemDefaults("", NY, new Date("2026-10-30T02:10:00Z"))).toMatchObject({
      startTime: "23:00",
      endTime: "23:59",
    });
    expect(newItemDefaults("", NY, new Date("2026-10-30T03:45:00Z"))).toMatchObject({
      startTime: "23:00",
      endTime: "23:59",
    });
  });

  it("reads the hour in the user's zone across a DST change", () => {
    // Nov 1 2026, 01:30 EST (the repeated hour, second pass) is 06:30 UTC.
    expect(newItemDefaults("", NY, new Date("2026-11-01T06:30:00Z"))).toEqual({
      date: "2026-11-01",
      startTime: "02:00",
      endTime: "03:00",
    });
  });
});
