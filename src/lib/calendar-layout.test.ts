import { describe, expect, it } from "vitest";
import { initialScrollHour, layoutDay, type DaySpan } from "@/lib/calendar-layout";

const at = (hours: number) => hours * 60;
const span = (id: string, start: number, end: number): DaySpan => ({ id, start: at(start), end: at(end) });

function byId(spans: DaySpan[]) {
  return Object.fromEntries(layoutDay(spans).map((layout) => [layout.id, layout]));
}

describe("layoutDay", () => {
  it("gives a lone event the full width at 48px per hour", () => {
    expect(layoutDay([span("a", 9, 12)])).toEqual([{ id: "a", top: 432, height: 144, left: 0, width: 100 }]);
  });

  it("returns nothing for an empty day", () => {
    expect(layoutDay([])).toEqual([]);
  });

  it("keeps separate events full width", () => {
    const result = byId([span("a", 9, 10), span("b", 14, 15)]);
    expect(result.a).toMatchObject({ left: 0, width: 100 });
    expect(result.b).toMatchObject({ left: 0, width: 100 });
  });

  it("puts two overlapping events side by side", () => {
    const result = byId([span("b", 9.5, 11), span("a", 9, 10)]);
    expect(result.a).toMatchObject({ left: 0, width: 50 });
    expect(result.b).toMatchObject({ left: 50, width: 50 });
  });

  it("gives a chain of three the same width and reuses a freed column", () => {
    // a overlaps b, b overlaps c, but a ends before c starts.
    const result = byId([span("a", 9, 10), span("b", 9.5, 10.5), span("c", 10.25, 11)]);
    expect(result.a).toMatchObject({ left: 0, width: 50 });
    expect(result.b).toMatchObject({ left: 50, width: 50 });
    expect(result.c).toMatchObject({ left: 0, width: 50 });
  });

  it("uses three columns when all three overlap at once", () => {
    const result = byId([span("a", 9, 11), span("b", 9, 11), span("c", 10, 12)]);
    expect(result.a.left).toBe(0);
    expect(result.b.left).toBeCloseTo(100 / 3);
    expect(result.c.left).toBeCloseTo(200 / 3);
    expect(result.c.width).toBeCloseTo(100 / 3);
  });

  it("doesn't treat back-to-back events as overlapping", () => {
    const result = byId([span("a", 9, 10), span("b", 10, 11)]);
    expect(result.a).toMatchObject({ left: 0, width: 100 });
    expect(result.b).toMatchObject({ top: 480, left: 0, width: 100 });
  });

  it("puts the longer of two same-start events first", () => {
    const result = byId([span("short", 9, 9.5), span("long", 9, 11)]);
    expect(result.long.left).toBe(0);
    expect(result.short.left).toBe(50);
  });

  it("draws short events at least 30 minutes tall", () => {
    expect(layoutDay([span("a", 9, 9.25)])[0]).toMatchObject({ top: 432, height: 24 });
  });

  it("keeps a short event at the end of the day inside the column", () => {
    expect(layoutDay([{ id: "a", start: 1435, end: 1440 }])[0]).toMatchObject({ top: 1128, height: 24 });
  });

  it("starts a new cluster after a gap", () => {
    const result = byId([span("a", 9, 10), span("b", 9, 10), span("c", 11, 12)]);
    expect(result.c).toMatchObject({ left: 0, width: 100 });
  });
});

describe("initialScrollHour", () => {
  it("is 7 AM with no events", () => {
    expect(initialScrollHour([])).toBe(7);
  });

  it("is 7 AM when the first event starts at 7 or later", () => {
    expect(initialScrollHour([span("a", 9, 10), span("b", 7, 8)])).toBe(7);
  });

  it("is an hour before an earlier first event", () => {
    expect(initialScrollHour([span("a", 9, 10), span("b", 5.5, 6)])).toBe(4);
    expect(initialScrollHour([span("a", 6.75, 8)])).toBe(5);
  });

  it("stops at midnight", () => {
    expect(initialScrollHour([span("a", 0.5, 2)])).toBe(0);
  });
});
