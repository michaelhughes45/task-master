import { describe, expect, it } from "vitest";
import { wallTimeToInstant } from "@/lib/dates";
import { expandEvent, expandTask, type EventExceptionInput, type TaskExceptionInput } from "@/lib/recurrence";
import {
  continueRule,
  endRuleBefore,
  planEventDelete,
  planEventEdit,
  planTaskDelete,
  planTaskEdit,
  shiftRule,
  type EventValues,
  type RepeatingEvent,
  type RepeatingTask,
} from "@/lib/recurrence-edit";

const NY = "America/New_York";
const at = (day: string, time: string, tz = NY) => wallTimeToInstant(day, time, tz);

function task(rrule: string, overrides: Partial<RepeatingTask> = {}): RepeatingTask {
  return { scope: "DAILY", date: "2026-10-26", rrule, title: "Read 20 pages", priority: "NORMAL", ...overrides };
}

function taskException(occurrenceDate: string, overrides: Partial<TaskExceptionInput> = {}): TaskExceptionInput {
  return { occurrenceDate, cancelled: false, title: null, date: null, ...overrides };
}

// Gym, Mon/Wed/Fri 7:00–8:00 AM in New York from Monday, Oct 26 2026 (EDT until Nov 1).
function gym(rrule = "FREQ=WEEKLY;BYDAY=MO,WE,FR", overrides: Partial<RepeatingEvent> = {}): RepeatingEvent {
  return {
    allDay: false,
    startAt: at("2026-10-26", "07:00"),
    endAt: at("2026-10-26", "08:00"),
    rrule,
    title: "Gym",
    notes: null,
    location: null,
    color: "BLUE",
    ...overrides,
  };
}

function eventException(occurrenceStart: Date, overrides: Partial<EventExceptionInput> = {}): EventExceptionInput {
  return {
    occurrenceStart,
    cancelled: false,
    title: null,
    startAt: null,
    endAt: null,
    notes: null,
    location: null,
    ...overrides,
  };
}

// The form as it opens on an occurrence: the series' values at the occurrence's times.
function form(event: RepeatingEvent, day: string, start: string, end: string, overrides: Partial<EventValues> = {}) {
  return {
    title: event.title,
    notes: event.notes,
    location: event.location,
    color: event.color,
    allDay: event.allDay,
    rrule: event.rrule,
    startAt: at(day, start),
    endAt: at(day, end),
    ...overrides,
  };
}

const startsOf = (event: RepeatingEvent, first: string, last: string, exceptions: EventExceptionInput[] = []) =>
  expandEvent(event, exceptions, first, last, NY).map((o) => o.startAt.toISOString());

describe("endRuleBefore / continueRule", () => {
  it("ends an open rule on the last earlier date, as a date-only UNTIL", () => {
    expect(endRuleBefore("FREQ=DAILY", ["2026-10-26", "2026-10-27"])).toBe("FREQ=DAILY;UNTIL=20261027");
    expect(continueRule("FREQ=DAILY", 2)).toBe("FREQ=DAILY");
  });

  it("replaces an existing end date", () => {
    expect(endRuleBefore("FREQ=WEEKLY;BYDAY=MO;UNTIL=20261231", ["2026-10-26"])).toBe(
      "FREQ=WEEKLY;BYDAY=MO;UNTIL=20261026",
    );
    expect(continueRule("FREQ=WEEKLY;BYDAY=MO;UNTIL=20261231", 1)).toBe("FREQ=WEEKLY;BYDAY=MO;UNTIL=20261231");
  });

  it("splits a COUNT between the two series", () => {
    expect(endRuleBefore("FREQ=DAILY;COUNT=10", ["2026-10-26", "2026-10-27", "2026-10-28"])).toBe("FREQ=DAILY;COUNT=3");
    expect(continueRule("FREQ=DAILY;COUNT=10", 3)).toBe("FREQ=DAILY;COUNT=7");
  });

  it("refuses rules the builder can't read, and an empty earlier list", () => {
    expect(endRuleBefore("FREQ=HOURLY", ["2026-10-26"])).toBeNull();
    expect(continueRule("FREQ=HOURLY", 1)).toBeNull();
    expect(endRuleBefore("FREQ=DAILY", [])).toBeNull();
  });
});

describe("shiftRule", () => {
  it("moves weekdays by the same number of days, wrapping round the week", () => {
    expect(shiftRule("FREQ=WEEKLY;BYDAY=MO,WE,FR", 1, "2026-10-27")).toBe("FREQ=WEEKLY;BYDAY=TU,TH,SA");
    expect(shiftRule("FREQ=WEEKLY;BYDAY=MO", -1, "2026-10-25")).toBe("FREQ=WEEKLY;BYDAY=SU");
    expect(shiftRule("FREQ=WEEKLY;BYDAY=SU;COUNT=4", 8, "2026-11-09")).toBe("FREQ=WEEKLY;BYDAY=MO;COUNT=4");
  });

  it("moves monthly rules to the new start's day or nth weekday", () => {
    expect(shiftRule("FREQ=MONTHLY;BYMONTHDAY=15", 2, "2026-10-17")).toBe("FREQ=MONTHLY;BYMONTHDAY=17");
    expect(shiftRule("FREQ=MONTHLY;BYDAY=4WE", 1, "2026-10-29")).toBe("FREQ=MONTHLY;BYDAY=-1TH");
  });

  it("leaves rules anchored on the start alone", () => {
    expect(shiftRule("FREQ=DAILY;INTERVAL=2", 3, "2026-10-29")).toBe("FREQ=DAILY;INTERVAL=2");
    expect(shiftRule("FREQ=YEARLY", 3, "2026-10-29")).toBe("FREQ=YEARLY");
    expect(shiftRule("FREQ=WEEKLY;BYDAY=MO", 0, "2026-10-26")).toBe("FREQ=WEEKLY;BYDAY=MO");
  });
});

describe("planTaskEdit", () => {
  const daily = task("FREQ=DAILY");

  it("this one: renames the occurrence with an exception", () => {
    expect(planTaskEdit(daily, [], [], "2026-10-28", "this", { title: "Read 30 pages" })).toEqual({
      type: "exception",
      row: taskException("2026-10-28", { title: "Read 30 pages" }),
    });
  });

  it("this one: renaming back to the series' title clears the override, keeping a move", () => {
    const existing = [taskException("2026-10-28", { title: "Read 30 pages", date: "2026-10-29" })];
    expect(planTaskEdit(daily, existing, [], "2026-10-28", "this", { title: "Read 20 pages" })).toEqual({
      type: "exception",
      row: taskException("2026-10-28", { date: "2026-10-29" }),
    });
  });

  it("this one: moves the occurrence to another day, or back", () => {
    const weekdays = task("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
    expect(planTaskEdit(weekdays, [], [], "2026-10-28", "this", { date: "2026-10-31" })).toEqual({
      type: "exception",
      row: taskException("2026-10-28", { date: "2026-10-31" }),
    });
    const moved = [taskException("2026-10-28", { date: "2026-10-31" })];
    expect(planTaskEdit(weekdays, moved, [], "2026-10-28", "this", { date: "2026-10-28" })).toEqual({
      type: "exception",
      row: taskException("2026-10-28"),
    });
  });

  it("this one: won't move an occurrence onto a day the task is already on", () => {
    const weekdays = task("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
    expect(planTaskEdit(weekdays, [], [], "2026-10-28", "this", { date: "2026-10-29" }).type).toBe("error");
    // Another occurrence was moved onto Saturday already.
    const moved = [taskException("2026-10-27", { date: "2026-10-31" })];
    expect(planTaskEdit(weekdays, moved, [], "2026-10-28", "this", { date: "2026-10-31" }).type).toBe("error");
    // Thursday's occurrence was cancelled, so Thursday is free.
    const cancelled = [taskException("2026-10-29", { cancelled: true })];
    expect(planTaskEdit(weekdays, cancelled, [], "2026-10-28", "this", { date: "2026-10-29" }).type).toBe("exception");
  });

  it("this one: priority can't be set on one occurrence", () => {
    expect(planTaskEdit(daily, [], [], "2026-10-28", "this", { priority: "HIGH" }).type).toBe("error");
  });

  it("only one occurrence can be moved", () => {
    expect(planTaskEdit(daily, [], [], "2026-10-28", "all", { date: "2026-10-30" }).type).toBe("error");
  });

  it("refuses a date the series doesn't produce, or a cancelled one", () => {
    const weekdays = task("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
    expect(planTaskEdit(weekdays, [], [], "2026-10-31", "this", { title: "x" }).type).toBe("error");
    expect(planTaskEdit(daily, [], [], "2026-10-25", "all", { title: "x" }).type).toBe("error");
    const cancelled = [taskException("2026-10-28", { cancelled: true })];
    expect(planTaskEdit(daily, cancelled, [], "2026-10-28", "all", { title: "x" }).type).toBe("error");
  });

  it("this and following: ends the series the day before and starts a new one", () => {
    const exceptions = [
      taskException("2026-10-27", { title: "Read in the park" }),
      taskException("2026-10-29", { title: "Read on the train" }),
      taskException("2026-10-30", { cancelled: true }),
      taskException("2026-10-31", { title: "Read early", date: "2026-11-01" }),
    ];
    const completions = ["2026-10-28", "2026-10-29"];
    const plan = planTaskEdit(daily, exceptions, completions, "2026-10-28", "following", { title: "Read 30 pages" });

    expect(plan).toEqual({
      type: "split",
      from: "2026-10-28",
      rule: "FREQ=DAILY;UNTIL=20261027",
      next: { date: "2026-10-28", rrule: "FREQ=DAILY", title: "Read 30 pages", priority: "NORMAL" },
      // Renamed with the series: only the cancellation and the move are left to carry.
      exceptions: [
        taskException("2026-10-30", { cancelled: true }),
        taskException("2026-10-31", { date: "2026-11-01" }),
      ],
      // Completions keep their dates; the 27th's stays with the old series.
      completions: ["2026-10-28", "2026-10-29"],
    });
  });

  it("this and following: a priority change keeps title overrides", () => {
    const exceptions = [taskException("2026-10-29", { title: "Read on the train" })];
    const plan = planTaskEdit(daily, exceptions, [], "2026-10-28", "following", { priority: "HIGH" });

    expect(plan).toMatchObject({
      type: "split",
      next: { title: "Read 20 pages", priority: "HIGH" },
      exceptions,
    });
  });

  it("this and following: the old series ends on the previous occurrence (weekdays, Monday)", () => {
    const weekdays = task("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
    const plan = planTaskEdit(weekdays, [], [], "2026-11-02", "following", { title: "Inbox zero" });

    expect(plan).toMatchObject({
      type: "split",
      rule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;UNTIL=20261030",
      next: { date: "2026-11-02", rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" },
    });
  });

  it("this and following: splits a COUNT so the total stays the same", () => {
    const counted = task("FREQ=DAILY;COUNT=10");
    const plan = planTaskEdit(counted, [], [], "2026-10-29", "following", { title: "Read 30 pages" });

    expect(plan).toMatchObject({
      rule: "FREQ=DAILY;COUNT=3",
      next: { date: "2026-10-29", rrule: "FREQ=DAILY;COUNT=7" },
    });
    if (plan.type !== "split") throw new Error("expected a split");
    const oldDates = expandTask({ ...counted, rrule: plan.rule }, [], "2026-10-01", "2026-12-31").map((o) => o.date);
    const newDates = expandTask({ ...counted, ...plan.next }, [], "2026-10-01", "2026-12-31").map((o) => o.date);
    expect([...oldDates, ...newDates]).toEqual(expandTask(counted, [], "2026-10-01", "2026-12-31").map((o) => o.date));
  });

  it("this and following: a weekly task's COUNT counts weeks", () => {
    const weekly = task("FREQ=WEEKLY;COUNT=5", { scope: "WEEKLY", title: "Long run" });
    const plan = planTaskEdit(weekly, [], [], "2026-11-09", "following", { title: "Long run (12 km)" });

    expect(plan).toMatchObject({
      rule: "FREQ=WEEKLY;COUNT=2",
      next: { date: "2026-11-09", rrule: "FREQ=WEEKLY;COUNT=3" },
    });
  });

  it("this and following on the first occurrence is the same as all", () => {
    const plan = planTaskEdit(daily, [], [], "2026-10-26", "following", { title: "Read 30 pages" });
    expect(plan).toEqual({ type: "update", data: { title: "Read 30 pages", priority: undefined }, exceptions: [] });
  });

  it("all: renames the series and its renamed occurrences, keeping other overrides", () => {
    const exceptions = [
      taskException("2026-10-27", { title: "Read in the park" }),
      taskException("2026-10-28", { title: "Read on the train", date: "2026-10-29" }),
      taskException("2026-10-30", { cancelled: true }),
    ];
    expect(planTaskEdit(daily, exceptions, [], "2026-10-29", "all", { title: "Read 30 pages" })).toEqual({
      type: "update",
      data: { title: "Read 30 pages", priority: undefined },
      exceptions: [
        taskException("2026-10-28", { date: "2026-10-29" }),
        taskException("2026-10-30", { cancelled: true }),
      ],
    });
  });

  it("all: a priority change leaves the exceptions alone", () => {
    expect(planTaskEdit(daily, [], [], "2026-10-29", "all", { priority: "LOW" })).toEqual({
      type: "update",
      data: { title: undefined, priority: "LOW" },
      exceptions: null,
    });
  });
});

describe("planTaskDelete", () => {
  const daily = task("FREQ=DAILY");

  it("this one: cancels the occurrence, keeping its other overrides", () => {
    const existing = [taskException("2026-10-28", { title: "Read on the train" })];
    expect(planTaskDelete(daily, existing, "2026-10-28", "this")).toEqual({
      type: "exception",
      row: taskException("2026-10-28", { title: "Read on the train", cancelled: true }),
    });
  });

  it("this and following: ends the series the day before", () => {
    expect(planTaskDelete(daily, [], "2026-10-28", "following")).toEqual({
      type: "end",
      from: "2026-10-28",
      rule: "FREQ=DAILY;UNTIL=20261027",
    });
  });

  it("this and following: a COUNT becomes the number before", () => {
    expect(planTaskDelete(task("FREQ=DAILY;COUNT=10"), [], "2026-10-30", "following")).toMatchObject({
      type: "end",
      rule: "FREQ=DAILY;COUNT=4",
    });
  });

  it("this and following on the first occurrence deletes the series", () => {
    expect(planTaskDelete(daily, [], "2026-10-26", "following")).toEqual({ type: "delete" });
  });

  it("all: deletes the series", () => {
    expect(planTaskDelete(daily, [], "2026-10-30", "all")).toEqual({ type: "delete" });
  });

  it("refuses a date that isn't an occurrence", () => {
    expect(planTaskDelete(task("FREQ=WEEKLY;BYDAY=MO"), [], "2026-10-27", "this").type).toBe("error");
  });
});

describe("planEventEdit: this one", () => {
  const event = gym();
  const wed = at("2026-10-28", "07:00");

  it("moves the occurrence with both times as overrides", () => {
    const plan = planEventEdit(event, [], wed, "this", form(event, "2026-10-28", "08:00", "09:00"), NY);

    expect(plan).toEqual({
      type: "exception",
      row: eventException(wed, { startAt: at("2026-10-28", "08:00"), endAt: at("2026-10-28", "09:00") }),
    });
  });

  it("stores changed text, and an emptied field as a cleared override", () => {
    const withNotes = gym(undefined, { notes: "Leg day", location: "Gym" });
    const values = form(withNotes, "2026-10-28", "07:00", "08:00", { title: "Gym (legs)", notes: null });

    expect(planEventEdit(withNotes, [], wed, "this", values, NY)).toEqual({
      type: "exception",
      row: eventException(wed, { title: "Gym (legs)", notes: "" }),
    });
  });

  it("replaces an existing exception with the form's values", () => {
    const existing = [
      eventException(wed, {
        title: "Gym (legs)",
        startAt: at("2026-10-28", "08:00"),
        endAt: at("2026-10-28", "09:00"),
      }),
    ];
    // Moved back to the original time, title unchanged.
    const values = form(event, "2026-10-28", "07:00", "08:00", { title: "Gym (legs)" });

    expect(planEventEdit(event, existing, wed, "this", values, NY)).toEqual({
      type: "exception",
      row: eventException(wed, { title: "Gym (legs)" }),
    });
  });

  it("refuses color, all day and repeat changes for one occurrence", () => {
    for (const change of [{ color: "GREEN" as const }, { rrule: "FREQ=DAILY" }]) {
      const values = form(event, "2026-10-28", "07:00", "08:00", change);
      expect(planEventEdit(event, [], wed, "this", values, NY).type).toBe("error");
    }
  });

  it("refuses a start the series doesn't produce, or a cancelled occurrence", () => {
    const values = form(event, "2026-10-28", "07:00", "08:00");
    expect(planEventEdit(event, [], at("2026-10-28", "07:30"), "this", values, NY).type).toBe("error");
    expect(planEventEdit(event, [], at("2026-10-27", "07:00"), "this", values, NY).type).toBe("error");
    const cancelled = [eventException(wed, { cancelled: true })];
    expect(planEventEdit(event, cancelled, wed, "this", values, NY).type).toBe("error");
  });
});

describe("planEventEdit: this and following", () => {
  const event = gym();
  // Monday after the fall-back change: 7:00 AM EST.
  const nov2 = at("2026-11-02", "07:00");

  it("ends the series on the previous occurrence's day and starts the new times there", () => {
    const plan = planEventEdit(event, [], nov2, "following", form(event, "2026-11-02", "18:00", "19:00"), NY);

    expect(plan).toEqual({
      type: "split",
      from: nov2,
      rule: "FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261030",
      next: {
        title: "Gym",
        notes: null,
        location: null,
        color: "BLUE",
        allDay: false,
        rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR",
        startAt: new Date("2026-11-02T23:00:00Z"),
        endAt: new Date("2026-11-03T00:00:00Z"),
      },
      exceptions: [],
    });
    if (plan.type !== "split") throw new Error("expected a split");
    // The old series keeps its morning sessions through Friday, the new one runs in the evening.
    expect(startsOf({ ...event, rrule: plan.rule }, "2026-10-26", "2026-11-08")).toEqual([
      "2026-10-26T11:00:00.000Z",
      "2026-10-28T11:00:00.000Z",
      "2026-10-30T11:00:00.000Z",
    ]);
    expect(startsOf({ ...event, ...plan.next, rrule: plan.next.rrule! }, "2026-11-02", "2026-11-06")).toEqual([
      "2026-11-02T23:00:00.000Z",
      "2026-11-04T23:00:00.000Z",
      "2026-11-06T23:00:00.000Z",
    ]);
  });

  it("keeps the occurrence's own time when only the title changes", () => {
    const plan = planEventEdit(
      event,
      [],
      nov2,
      "following",
      form(event, "2026-11-02", "07:00", "08:00", { title: "Gym (new plan)" }),
      NY,
    );

    expect(plan).toMatchObject({
      type: "split",
      next: { title: "Gym (new plan)", startAt: nov2, endAt: at("2026-11-02", "08:00") },
    });
  });

  it("carries later exceptions that still match, re-keyed to the new time", () => {
    const exceptions = [
      eventException(at("2026-10-28", "07:00"), { cancelled: true }),
      eventException(at("2026-11-04", "07:00"), { cancelled: true }),
      eventException(at("2026-11-06", "07:00"), { location: "Park" }),
    ];
    // Change to Mondays and Fridays at 6:30 PM.
    const values = form(event, "2026-11-02", "18:30", "19:30", { rrule: "FREQ=WEEKLY;BYDAY=MO,FR" });
    const plan = planEventEdit(event, exceptions, nov2, "following", values, NY);

    expect(plan).toMatchObject({
      type: "split",
      next: { rrule: "FREQ=WEEKLY;BYDAY=MO,FR" },
      // Wednesday's cancellation has no occurrence to belong to any more.
      exceptions: [eventException(at("2026-11-06", "18:30"), { location: "Park" })],
    });
  });

  it("splits a COUNT so the total stays the same", () => {
    const counted = gym("FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=6");
    const plan = planEventEdit(counted, [], nov2, "following", form(counted, "2026-11-02", "18:00", "19:00"), NY);

    expect(plan).toMatchObject({
      rule: "FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=3",
      next: { rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=3" },
    });
  });

  it("on the first occurrence is the same as all", () => {
    const first = at("2026-10-26", "07:00");
    const plan = planEventEdit(event, [], first, "following", form(event, "2026-10-26", "06:30", "07:30"), NY);

    expect(plan).toMatchObject({
      type: "update",
      data: { startAt: at("2026-10-26", "06:30"), endAt: at("2026-10-26", "07:30") },
    });
  });
});

describe("planEventEdit: moving the day", () => {
  // Weekly on Monday, 9:00–10:00 from Oct 5; the Oct 26 occurrence moved to Tuesday Oct 27.
  const mondays = gym("FREQ=WEEKLY;BYDAY=MO", { startAt: at("2026-10-05", "09:00"), endAt: at("2026-10-05", "10:00") });
  const oct26 = at("2026-10-26", "09:00");
  const values = form(mondays, "2026-10-27", "09:00", "10:00");
  const days = (event: RepeatingEvent) =>
    expandEvent(event, [], "2026-10-01", "2026-11-15", NY).map((o) => o.startAt.toISOString().slice(0, 10));

  it("all: the series moves to Tuesdays", () => {
    const plan = planEventEdit(mondays, [], oct26, "all", values, NY);

    expect(plan).toMatchObject({
      type: "update",
      data: { rrule: "FREQ=WEEKLY;BYDAY=TU", startAt: at("2026-10-06", "09:00") },
    });
    if (plan.type !== "update") throw new Error("expected an update");
    expect(days({ ...mondays, ...plan.data, rrule: plan.data.rrule! })).toEqual([
      "2026-10-06",
      "2026-10-13",
      "2026-10-20",
      "2026-10-27",
      "2026-11-03",
      "2026-11-10",
    ]);
  });

  it("this and following: Mondays until Oct 19, then Tuesdays from Oct 27, losing no week", () => {
    const plan = planEventEdit(mondays, [], oct26, "following", values, NY);

    expect(plan).toMatchObject({
      type: "split",
      rule: "FREQ=WEEKLY;BYDAY=MO;UNTIL=20261019",
      next: { rrule: "FREQ=WEEKLY;BYDAY=TU", startAt: at("2026-10-27", "09:00") },
    });
    if (plan.type !== "split") throw new Error("expected a split");
    expect([
      ...days({ ...mondays, rrule: plan.rule }),
      ...days({ ...mondays, ...plan.next, rrule: plan.next.rrule! }),
    ]).toEqual(["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-27", "2026-11-03", "2026-11-10"]);
  });

  it("this one: moves only the occurrence, past the series' end date too", () => {
    const ending = { ...mondays, rrule: "FREQ=WEEKLY;BYDAY=MO;UNTIL=20261026" };
    const later = form(ending, "2026-11-02", "09:00", "10:00");
    expect(planEventEdit(ending, [], oct26, "this", later, NY)).toEqual({
      type: "exception",
      row: eventException(oct26, { startAt: at("2026-11-02", "09:00"), endAt: at("2026-11-02", "10:00") }),
    });
  });
});

describe("planEventEdit: all", () => {
  const event = gym();

  it("moves the whole series to the new time and re-keys exceptions by day", () => {
    const exceptions = [
      eventException(at("2026-10-28", "07:00"), { cancelled: true }),
      eventException(at("2026-11-04", "07:00"), { title: "Gym (legs)" }),
    ];
    const values = form(event, "2026-11-02", "06:30", "07:30");
    const plan = planEventEdit(event, exceptions, at("2026-11-02", "07:00"), "all", values, NY);

    expect(plan).toEqual({
      type: "update",
      data: {
        title: "Gym",
        notes: null,
        location: null,
        color: "BLUE",
        allDay: false,
        rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR",
        // The series' first day at the new time.
        startAt: at("2026-10-26", "06:30"),
        endAt: at("2026-10-26", "07:30"),
      },
      exceptions: [
        eventException(at("2026-10-28", "06:30"), { cancelled: true }),
        eventException(at("2026-11-04", "06:30"), { title: "Gym (legs)" }),
      ],
    });
  });

  it("keeps the series' times when the occurrence was moved but its times weren't edited", () => {
    const wed = at("2026-10-28", "07:00");
    const exceptions = [eventException(wed, { startAt: at("2026-10-28", "09:00"), endAt: at("2026-10-28", "10:00") })];
    const values = form(event, "2026-10-28", "09:00", "10:00", { title: "Workout" });
    const plan = planEventEdit(event, exceptions, wed, "all", values, NY);

    expect(plan).toMatchObject({
      type: "update",
      data: { title: "Workout", startAt: event.startAt, endAt: event.endAt },
      exceptions,
    });
  });

  it("drops exceptions whose day the new rule no longer has, and overrides of changed fields", () => {
    const exceptions = [
      eventException(at("2026-10-28", "07:00"), { title: "Gym (legs)" }),
      eventException(at("2026-10-30", "07:00"), { cancelled: true }),
      eventException(at("2026-11-02", "07:00"), { title: "Gym (arms)", location: "Park" }),
    ];
    const values = form(event, "2026-10-26", "07:00", "08:00", { title: "Workout", rrule: "FREQ=WEEKLY;BYDAY=MO,WE" });
    const plan = planEventEdit(event, exceptions, at("2026-10-26", "07:00"), "all", values, NY);

    expect(plan).toMatchObject({
      type: "update",
      data: { title: "Workout", rrule: "FREQ=WEEKLY;BYDAY=MO,WE" },
      exceptions: [eventException(at("2026-11-02", "07:00"), { location: "Park" })],
    });
  });

  it("turns a timed series all day, keeping the days and dropping time overrides", () => {
    const exceptions = [
      eventException(at("2026-10-28", "07:00"), {
        startAt: at("2026-10-28", "09:00"),
        endAt: at("2026-10-28", "10:00"),
      }),
      eventException(at("2026-10-30", "07:00"), { cancelled: true }),
    ];
    const values = {
      ...form(event, "2026-10-26", "07:00", "08:00"),
      allDay: true,
      startAt: new Date("2026-10-26T00:00:00Z"),
      endAt: new Date("2026-10-27T00:00:00Z"),
    };
    const plan = planEventEdit(event, exceptions, at("2026-10-26", "07:00"), "all", values, NY);

    expect(plan).toMatchObject({
      type: "update",
      data: { allDay: true, startAt: new Date("2026-10-26T00:00:00Z"), endAt: new Date("2026-10-27T00:00:00Z") },
      exceptions: [eventException(new Date("2026-10-30T00:00:00Z"), { cancelled: true })],
    });
  });

  it("reports times that end before they start on the series' first day", () => {
    // Daily from Mar 14 2027, when 2:00–3:00 AM doesn't exist in New York: 2:15–3:15 there
    // is 3:15–3:15.
    const nightly = gym("FREQ=DAILY", { startAt: at("2027-03-14", "01:00"), endAt: at("2027-03-14", "01:45") });
    const values = form(nightly, "2027-03-20", "02:15", "03:15");
    const plan = planEventEdit(nightly, [], at("2027-03-20", "01:00"), "all", values, NY);
    expect(plan).toMatchObject({ type: "error", field: "endTime" });
  });

  it("checks the repeat against the series' new start", () => {
    const values = form(event, "2026-10-26", "07:00", "08:00", { rrule: "FREQ=WEEKLY;BYDAY=TU;UNTIL=20261026" });
    expect(planEventEdit(event, [], at("2026-10-26", "07:00"), "all", values, NY)).toMatchObject({
      type: "error",
      field: "rrule",
    });
  });
});

describe("planEventDelete", () => {
  const event = gym();
  const wed = at("2026-10-28", "07:00");

  it("this one: cancels the occurrence", () => {
    expect(planEventDelete(event, [], wed, "this", NY)).toEqual({
      type: "exception",
      row: eventException(wed, { cancelled: true }),
    });
  });

  it("this and following: ends the series on the previous occurrence's day", () => {
    const plan = planEventDelete(event, [], at("2026-11-02", "07:00"), "following", NY);

    expect(plan).toEqual({
      type: "end",
      from: at("2026-11-02", "07:00"),
      rule: "FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261030",
    });
  });

  it("this and following: a late-night series ends on its own (floating) day, not the UTC one", () => {
    // 11 PM in New York is 3–4 AM UTC the next day.
    const late = gym("FREQ=DAILY", { startAt: at("2026-10-26", "23:00"), endAt: at("2026-10-26", "23:30") });
    const plan = planEventDelete(late, [], at("2026-10-29", "23:00"), "following", NY);

    expect(plan).toMatchObject({ type: "end", rule: "FREQ=DAILY;UNTIL=20261028" });
    if (plan.type !== "end") throw new Error("expected an end");
    expect(startsOf({ ...late, rrule: plan.rule }, "2026-10-26", "2026-11-05")).toEqual([
      "2026-10-27T03:00:00.000Z",
      "2026-10-28T03:00:00.000Z",
      "2026-10-29T03:00:00.000Z",
    ]);
  });

  it("this and following: an all-day series ends on its UTC date", () => {
    const allDay = gym("FREQ=WEEKLY;BYDAY=SA", {
      allDay: true,
      startAt: new Date("2026-10-31T00:00:00Z"),
      endAt: new Date("2026-11-01T00:00:00Z"),
    });
    expect(planEventDelete(allDay, [], new Date("2026-11-14T00:00:00Z"), "following", NY)).toMatchObject({
      rule: "FREQ=WEEKLY;BYDAY=SA;UNTIL=20261107",
    });
  });

  it("this and following: a COUNT becomes the number before", () => {
    const counted = gym("FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=6");
    expect(planEventDelete(counted, [], wed, "following", NY)).toMatchObject({
      rule: "FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=1",
    });
  });

  it("this and following on the first occurrence deletes the series", () => {
    expect(planEventDelete(event, [], at("2026-10-26", "07:00"), "following", NY)).toEqual({ type: "delete" });
  });

  it("all: deletes the series", () => {
    expect(planEventDelete(event, [], wed, "all", NY)).toEqual({ type: "delete" });
  });

  it("refuses a start that isn't an occurrence", () => {
    expect(planEventDelete(event, [], at("2026-10-28", "08:00"), "all", NY).type).toBe("error");
  });
});
