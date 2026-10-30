import { describe, expect, it } from "vitest";
import { draftTask } from "@/lib/task-list";
import { buildSchedule, eventTiming, formatList, missedSummary, nowAndNext } from "@/lib/today";
import type { EventView } from "@/types/events";
import type { TaskView } from "@/types/tasks";

const NY = "America/New_York";
const TODAY = "2026-10-28";

function event(overrides: Partial<EventView>): EventView {
  return {
    id: "ev1",
    key: "ev1",
    occurrenceStart: new Date("2026-10-28T13:00:00Z"),
    title: "Deep work",
    notes: null,
    location: null,
    color: "BLUE",
    allDay: false,
    // 9:00 AM – 12:00 PM EDT
    startAt: new Date("2026-10-28T13:00:00Z"),
    endAt: new Date("2026-10-28T16:00:00Z"),
    series: null,
    ...overrides,
  };
}

const at = (iso: string) => new Date(iso).getTime();

describe("buildSchedule", () => {
  it("formats times in the user's zone with a meta line of duration, location and repeat", () => {
    const [item] = buildSchedule(
      [event({ location: "Library", series: { rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" } })],
      TODAY,
      NY,
    );
    expect(item).toMatchObject({
      key: "ev1",
      startLabel: "9:00 AM",
      endLabel: "12:00 PM",
      startMs: at("2026-10-28T13:00:00Z"),
      endMs: at("2026-10-28T16:00:00Z"),
      meta: "3h · Library · Every weekday",
    });
    expect(item.details.dayLabel).toBe("Wednesday, October 28");
  });

  it("leaves out missing parts of the meta line", () => {
    const [item] = buildSchedule([event({ endAt: new Date("2026-10-28T13:45:00Z") })], TODAY, NY);
    expect(item.meta).toBe("45 min");
  });

  it("names the other day for an event that crosses midnight", () => {
    // Tue 11:00 PM – Wed 1:00 AM, and Wed 11:00 PM – Thu 1:00 AM, in New York.
    const [fromYesterday, intoTomorrow] = buildSchedule(
      [
        event({ startAt: new Date("2026-10-28T03:00:00Z"), endAt: new Date("2026-10-28T05:00:00Z") }),
        event({ key: "ev2", startAt: new Date("2026-10-29T03:00:00Z"), endAt: new Date("2026-10-29T05:00:00Z") }),
      ],
      TODAY,
      NY,
    );
    expect(fromYesterday).toMatchObject({ startLabel: "Tue 11:00 PM", endLabel: "1:00 AM" });
    expect(intoTomorrow).toMatchObject({ startLabel: "11:00 PM", endLabel: "Thu 1:00 AM" });
  });

  it("shows all-day events as all day, without instants", () => {
    const [item] = buildSchedule(
      [
        event({
          allDay: true,
          startAt: new Date("2026-10-28T00:00:00Z"),
          endAt: new Date("2026-10-29T00:00:00Z"),
          location: "Office",
        }),
      ],
      TODAY,
      NY,
    );
    expect(item).toMatchObject({ startLabel: "All day", endLabel: null, startMs: null, endMs: null, meta: "Office" });
  });

  it("measures real time across the fall-back change", () => {
    // Nov 1, 2026: 1:00 AM EDT to 3:00 AM EST is three hours.
    const [item] = buildSchedule(
      [event({ startAt: new Date("2026-11-01T05:00:00Z"), endAt: new Date("2026-11-01T08:00:00Z") })],
      "2026-11-01",
      NY,
    );
    expect(item).toMatchObject({ startLabel: "1:00 AM", endLabel: "3:00 AM", meta: "3h" });
  });
});

describe("eventTiming", () => {
  const item = { startMs: at("2026-10-28T13:00:00Z"), endMs: at("2026-10-28T16:00:00Z") };

  it("is upcoming before the start, now from the start, past from the end", () => {
    expect(eventTiming(item, at("2026-10-28T12:59:00Z"))).toBe("upcoming");
    expect(eventTiming(item, at("2026-10-28T13:00:00Z"))).toBe("now");
    expect(eventTiming(item, at("2026-10-28T15:59:00Z"))).toBe("now");
    expect(eventTiming(item, at("2026-10-28T16:00:00Z"))).toBe("past");
  });

  it("never marks all-day events past or now", () => {
    expect(eventTiming({ startMs: null, endMs: null }, at("2026-10-28T20:00:00Z"))).toBe("upcoming");
  });
});

describe("nowAndNext", () => {
  // The seeded Wednesday: gym 7:30–8:30, deep work 9–12, lunch 1 PM, all in New York.
  const schedule = buildSchedule(
    [
      event({ key: "all", allDay: true, startAt: new Date("2026-10-28T00:00:00Z"), endAt: new Date("2026-10-29T00:00:00Z") }),
      event({ key: "gym", startAt: new Date("2026-10-28T11:30:00Z"), endAt: new Date("2026-10-28T12:30:00Z") }),
      event({ key: "deep" }),
      event({ key: "lunch", startAt: new Date("2026-10-28T17:00:00Z"), endAt: new Date("2026-10-28T18:00:00Z") }),
    ],
    TODAY,
    NY,
  );

  it("finds the current event and the next one at 10:40 AM", () => {
    const { current, next } = nowAndNext(schedule, at("2026-10-28T14:40:00Z"));
    expect(current?.key).toBe("deep");
    expect(next?.key).toBe("lunch");
  });

  it("has only a next event between events", () => {
    const { current, next } = nowAndNext(schedule, at("2026-10-28T16:30:00Z"));
    expect(current).toBeUndefined();
    expect(next?.key).toBe("lunch");
  });

  it("has neither once the day's events are over", () => {
    expect(nowAndNext(schedule, at("2026-10-28T22:00:00Z"))).toEqual({ current: undefined, next: undefined });
  });
});

describe("formatList", () => {
  it("joins names with commas and a final 'and'", () => {
    expect(formatList([])).toBe("");
    expect(formatList(["Mon"])).toBe("Mon");
    expect(formatList(["Mon", "Tue"])).toBe("Mon and Tue");
    expect(formatList(["Mon", "Tue", "Wed"])).toBe("Mon, Tue and Wed");
  });
});

describe("missedSummary", () => {
  const task = (id: string, day: string, done = false): TaskView => ({ ...draftTask(id, id, "DAILY", day), id, done });

  it("counts the open tasks and names their days in order", () => {
    const summary = missedSummary([
      task("a", "2026-10-27"),
      task("b", "2026-10-26"),
      task("c", "2026-10-27"),
      task("d", "2026-10-26", true),
    ]);
    expect(summary).toEqual({ count: 3, firstDay: "2026-10-26", dayNames: "Mon and Tue" });
  });

  it("skips days whose tasks were all ticked off", () => {
    const summary = missedSummary([task("a", "2026-10-26", true), task("b", "2026-10-27")]);
    expect(summary).toEqual({ count: 1, firstDay: "2026-10-27", dayNames: "Tue" });
  });

  it("is empty when nothing is missed", () => {
    expect(missedSummary([task("a", "2026-10-26", true)])).toEqual({ count: 0, firstDay: null, dayNames: "" });
  });
});
