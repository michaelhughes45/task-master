import { describe, expect, it } from "vitest";
import { reviewNotices, reviewNotificationBody } from "./notify-schedule";

// The weekly cron is `0 2 * * 1`: 02:00 UTC Monday, Sunday evening in Denver.
const weekOf = (tz: string, iso: string) => reviewNotices([{ timezone: tz }], new Date(iso))[0].weekStart;

describe("reviewNotices", () => {
  it("points Denver at the week just ended, in winter (MST, 7 PM) and summer (MDT, 8 PM)", () => {
    // Sunday Nov 8, 2026, 19:00 MST
    expect(weekOf("America/Denver", "2026-11-09T02:00:00Z")).toBe("2026-11-02");
    // Sunday Jul 12, 2026, 20:00 MDT
    expect(weekOf("America/Denver", "2026-07-13T02:00:00Z")).toBe("2026-07-06");
  });

  it("still finds the right week when Hobby runs the job up to 59 minutes late", () => {
    expect(weekOf("America/Denver", "2026-11-09T02:59:00Z")).toBe("2026-11-02");
  });

  it("covers both DST change weekends in Denver", () => {
    // Fall back Sunday Nov 1, 2026: 02:00 UTC Monday = 19:00 MST
    expect(weekOf("America/Denver", "2026-11-02T02:00:00Z")).toBe("2026-10-26");
    // Spring forward Sunday Mar 8, 2026: 02:00 UTC Monday = 20:00 MDT
    expect(weekOf("America/Denver", "2026-03-09T02:00:00Z")).toBe("2026-03-02");
  });

  it("uses the previous week for a zone where Sunday 7 PM hasn't come yet", () => {
    // 02:00 UTC Monday = 18:00 Sunday in Los Angeles (PST): this week isn't ready
    expect(weekOf("America/Los_Angeles", "2026-11-09T02:00:00Z")).toBe("2026-10-26");
  });

  it("uses the week just ended for zones already into Monday", () => {
    // 07:30 / 07:45 Monday in Kolkata (+5:30) and Kathmandu (+5:45)
    expect(weekOf("Asia/Kolkata", "2026-11-09T02:00:00Z")).toBe("2026-11-02");
    expect(weekOf("Asia/Kathmandu", "2026-11-09T02:00:00Z")).toBe("2026-11-02");
  });

  it("handles a week that crosses the new year", () => {
    // Sunday Jan 3, 2027 ends the week of Monday Dec 28, 2026
    expect(weekOf("America/Denver", "2027-01-04T02:00:00Z")).toBe("2026-12-28");
  });

  it("includes every user, treating a missing or invalid timezone as UTC", () => {
    const users = [
      { id: "denver", timezone: "America/Denver" },
      { id: "none", timezone: null },
      { id: "bad", timezone: "Mars/Base" },
    ];

    expect(reviewNotices(users, new Date("2026-11-09T02:00:00Z"))).toEqual([
      { user: users[0], tz: "America/Denver", weekStart: "2026-11-02" },
      { user: users[1], tz: "UTC", weekStart: "2026-11-02" },
      { user: users[2], tz: "UTC", weekStart: "2026-11-02" },
    ]);
  });
});

describe("reviewNotificationBody", () => {
  it("counts finished tasks", () => {
    expect(reviewNotificationBody({ planned: 36, done: 28 })).toBe("You finished 28 of 36 tasks this week.");
  });

  it("uses the singular for one task", () => {
    expect(reviewNotificationBody({ planned: 1, done: 0 })).toBe("You finished 0 of 1 task this week.");
  });

  it("has a fallback when nothing was planned", () => {
    expect(reviewNotificationBody({ planned: 0, done: 0 })).toBe("See how your week went and plan the next one.");
  });
});
