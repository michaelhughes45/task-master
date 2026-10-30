import { describe, expect, it } from "vitest";
import { expandTask } from "@/lib/recurrence";
import {
  buildRRule,
  customFromRule,
  customOptions,
  describeRRule,
  normalizeRRule,
  nthWeekdayOf,
  parseRRule,
  presetsFor,
  repeatProblem,
  repeatRule,
  repeatStateFor,
  type CustomRepeat,
  type RepeatOptions,
} from "@/lib/rrule-builder";

const WED = "2026-10-28";

function options(overrides: Partial<RepeatOptions>): RepeatOptions {
  return { freq: "DAILY", interval: 1, weekdays: [], monthly: null, end: { type: "never" }, ...overrides };
}

const ROUND_TRIPS: [string, RepeatOptions][] = [
  ["FREQ=DAILY", options({})],
  ["FREQ=DAILY;INTERVAL=3", options({ interval: 3 })],
  ["FREQ=WEEKLY", options({ freq: "WEEKLY" })],
  ["FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE", options({ freq: "WEEKLY", interval: 2, weekdays: ["MO", "WE"] })],
  ["FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", options({ freq: "WEEKLY", weekdays: ["MO", "TU", "WE", "TH", "FR"] })],
  ["FREQ=MONTHLY;BYMONTHDAY=28", options({ freq: "MONTHLY", monthly: { by: "day", day: 28 } })],
  ["FREQ=MONTHLY;BYDAY=2TU", options({ freq: "MONTHLY", monthly: { by: "weekday", nth: 2, weekday: "TU" } })],
  ["FREQ=MONTHLY;BYDAY=-1WE", options({ freq: "MONTHLY", monthly: { by: "weekday", nth: -1, weekday: "WE" } })],
  ["FREQ=MONTHLY", options({ freq: "MONTHLY" })],
  ["FREQ=YEARLY", options({ freq: "YEARLY" })],
  ["FREQ=DAILY;UNTIL=20261231", options({ end: { type: "until", until: "2026-12-31" } })],
  ["FREQ=WEEKLY;BYDAY=FR;COUNT=10", options({ freq: "WEEKLY", weekdays: ["FR"], end: { type: "count", count: 10 } })],
];

describe("buildRRule and parseRRule", () => {
  it.each(ROUND_TRIPS)("%s", (rule, parsed) => {
    expect(buildRRule(parsed)).toBe(rule);
    expect(parseRRule(rule)).toEqual(parsed);
    expect(parseRRule(buildRRule(parsed))).toEqual(parsed);
  });

  it("writes weekdays Monday first, once each", () => {
    expect(buildRRule(options({ freq: "WEEKLY", weekdays: ["FR", "MO", "FR"] }))).toBe("FREQ=WEEKLY;BYDAY=MO,FR");
  });

  it("only writes the parts for its frequency", () => {
    expect(buildRRule(options({ weekdays: ["MO"], monthly: { by: "day", day: 3 } }))).toBe("FREQ=DAILY");
  });

  it("normalizes order and case", () => {
    expect(normalizeRRule("byday=fr,mo;freq=weekly")).toBe("FREQ=WEEKLY;BYDAY=MO,FR");
  });

  it.each([
    "",
    "FREQ=HOURLY",
    "FREQ=SECONDLY",
    "INTERVAL=2",
    "FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=30",
    "FREQ=MONTHLY;BYSETPOS=-1;BYDAY=MO",
    "FREQ=DAILY;BYDAY=MO",
    "FREQ=WEEKLY;BYDAY=XX",
    "FREQ=WEEKLY;BYDAY=MO,MO",
    "FREQ=WEEKLY;BYMONTHDAY=3",
    "FREQ=MONTHLY;BYDAY=5MO",
    "FREQ=MONTHLY;BYDAY=MO,TU",
    "FREQ=MONTHLY;BYMONTHDAY=32",
    "FREQ=MONTHLY;BYMONTHDAY=3;BYDAY=1MO",
    "FREQ=DAILY;FREQ=WEEKLY",
    "FREQ=DAILY;COUNT=3;UNTIL=20261231",
    "FREQ=DAILY;UNTIL=20260230",
    "FREQ=DAILY;UNTIL=20261231T000000Z",
    "FREQ=DAILY;INTERVAL=-1",
    "FREQ=DAILY;;",
    "RRULE:FREQ=DAILY",
  ])("rejects %j", (rule) => {
    expect(parseRRule(rule)).toBeNull();
  });
});

describe("describeRRule", () => {
  it.each([
    ["FREQ=DAILY", "Repeats daily"],
    ["FREQ=DAILY;INTERVAL=3", "Every 3 days"],
    ["FREQ=WEEKLY", "Repeats weekly"],
    ["FREQ=WEEKLY;INTERVAL=2", "Every 2 weeks"],
    ["FREQ=WEEKLY;BYDAY=WE", "Weekly on Wednesday"],
    ["FREQ=WEEKLY;BYDAY=MO,WE,FR", "Weekly on Mon, Wed, Fri"],
    ["FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", "Every weekday"],
    ["FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE", "Every 2 weeks on Mon, Wed"],
    ["FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TU,WE,TH,FR", "Every 2 weeks on Mon, Tue, Wed, Thu, Fri"],
    ["FREQ=MONTHLY;BYDAY=4WE", "Monthly on the 4th Wednesday"],
    ["FREQ=MONTHLY;BYDAY=-1WE", "Monthly on the last Wednesday"],
    ["FREQ=MONTHLY;BYDAY=1MO", "Monthly on the 1st Monday"],
    ["FREQ=MONTHLY;BYMONTHDAY=28", "Monthly on day 28"],
    ["FREQ=MONTHLY", "Monthly on day 28"],
    ["FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=1", "Every 3 months on day 1"],
    ["FREQ=YEARLY", "Annually on October 28"],
    ["FREQ=YEARLY;INTERVAL=2", "Every 2 years on October 28"],
    ["FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20261231", "Every 2 weeks on Mon, Wed, until Dec 31, 2026"],
    ["FREQ=DAILY;COUNT=10", "Repeats daily, 10 times"],
    ["FREQ=DAILY;COUNT=1", "Repeats daily, 1 time"],
  ])("%s → %s", (rule, label) => {
    expect(describeRRule(rule, WED)).toBe(label);
  });

  it("is null for a rule it can't read", () => {
    expect(describeRRule("FREQ=HOURLY", WED)).toBeNull();
  });
});

describe("nthWeekdayOf", () => {
  it.each([
    ["2026-10-01", 1, "TH"],
    ["2026-10-13", 2, "TU"],
    ["2026-10-21", 3, "WE"],
    // The 4th Wednesday of October is also its last.
    ["2026-10-28", -1, "WE"],
    ["2026-11-25", -1, "WE"],
    ["2026-12-23", 4, "WE"],
    ["2026-12-30", -1, "WE"],
    // February 2027 has exactly four Sundays; the 28th is the last.
    ["2027-02-21", 3, "SU"],
    ["2027-02-28", -1, "SU"],
    // Leap day 2028 is a Tuesday, the 5th and last.
    ["2028-02-29", -1, "TU"],
    ["2028-02-22", 4, "TU"],
  ])("%s is the %i %s", (day, nth, weekday) => {
    expect(nthWeekdayOf(day)).toEqual({ nth, weekday });
  });
});

describe("presetsFor", () => {
  it("offers Google Calendar's list for a Wednesday", () => {
    expect(presetsFor(WED, "DAILY")).toEqual([
      { value: "none", label: "Does not repeat", rrule: null },
      { value: "daily", label: "Daily", rrule: "FREQ=DAILY" },
      { value: "weekly", label: "Weekly on Wednesday", rrule: "FREQ=WEEKLY;BYDAY=WE" },
      { value: "weekdays", label: "Every weekday (Monday to Friday)", rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" },
      { value: "monthly", label: "Monthly on the last Wednesday", rrule: "FREQ=MONTHLY;BYDAY=-1WE" },
      { value: "yearly", label: "Annually on October 28", rrule: "FREQ=YEARLY" },
      { value: "custom", label: "Custom…", rrule: null },
    ]);
  });

  it("says fourth when a later one fits in the month", () => {
    const monthly = presetsFor("2026-12-23", "DAILY").find((p) => p.value === "monthly");
    expect(monthly).toEqual({ value: "monthly", label: "Monthly on the fourth Wednesday", rrule: "FREQ=MONTHLY;BYDAY=4WE" });
  });

  it("follows the chosen day", () => {
    const labels = presetsFor("2027-02-01", "DAILY").map((p) => p.label);
    expect(labels).toContain("Weekly on Monday");
    expect(labels).toContain("Monthly on the first Monday");
    expect(labels).toContain("Annually on February 1");
  });

  it("offers weeks only for weekly-list tasks", () => {
    expect(presetsFor(WED, "WEEKLY")).toEqual([
      { value: "none", label: "Does not repeat", rrule: null },
      { value: "weekly", label: "Every week", rrule: "FREQ=WEEKLY" },
      { value: "biweekly", label: "Every 2 weeks", rrule: "FREQ=WEEKLY;INTERVAL=2" },
      { value: "custom", label: "Custom…", rrule: null },
    ]);
  });

  it("builds rules that are valid and read like their label", () => {
    for (const preset of presetsFor(WED, "DAILY")) {
      if (!preset.rrule) continue;
      expect(repeatProblem(preset.rrule, "DAILY", WED)).toBeNull();
      expect(describeRRule(preset.rrule, WED)).toBeTruthy();
    }
    for (const preset of presetsFor("2026-10-26", "WEEKLY")) {
      if (preset.rrule) expect(repeatProblem(preset.rrule, "WEEKLY", "2026-10-26")).toBeNull();
    }
  });

  it("expands each preset to the expected days", () => {
    const days = (value: string) => {
      const rrule = presetsFor(WED, "DAILY").find((p) => p.value === value)?.rrule ?? null;
      return expandTask({ scope: "DAILY", date: WED, rrule, title: "t" }, [], WED, "2027-10-31").map((o) => o.date);
    };
    expect(days("daily").slice(0, 3)).toEqual(["2026-10-28", "2026-10-29", "2026-10-30"]);
    expect(days("weekly").slice(0, 3)).toEqual(["2026-10-28", "2026-11-04", "2026-11-11"]);
    expect(days("weekdays").slice(2, 5)).toEqual(["2026-10-30", "2026-11-02", "2026-11-03"]);
    expect(days("monthly").slice(0, 4)).toEqual(["2026-10-28", "2026-11-25", "2026-12-30", "2027-01-27"]);
    expect(days("yearly")).toEqual(["2026-10-28", "2027-10-28"]);
  });
});

describe("form state", () => {
  const custom = (overrides: Partial<CustomRepeat> = {}): CustomRepeat => ({
    ...customFromRule(null, WED),
    ...overrides,
  });

  it("defaults Custom… to weekly on the chosen day, three months of end date, 10 times", () => {
    expect(customFromRule(null, WED)).toEqual({
      freq: "WEEKLY",
      interval: "1",
      weekdays: ["WE"],
      monthlyBy: "day",
      ends: "never",
      until: "2027-01-28",
      count: "10",
    });
  });

  it("starts Custom… from the current choice", () => {
    expect(customFromRule("FREQ=MONTHLY;BYDAY=-1WE;COUNT=5", WED)).toMatchObject({
      freq: "MONTHLY",
      monthlyBy: "weekday",
      ends: "count",
      count: "5",
      weekdays: ["WE"],
    });
  });

  it("builds custom weekly rules with several days", () => {
    const state = { preset: "custom" as const, custom: custom({ interval: "2", weekdays: ["WE", "MO"], ends: "until", until: "2026-12-31" }) };
    expect(repeatRule(state, WED, "DAILY")).toBe("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20261231");
  });

  it("builds custom monthly rules by day and by weekday from the chosen date", () => {
    const byDay = { preset: "custom" as const, custom: custom({ freq: "MONTHLY" }) };
    const byWeekday = { preset: "custom" as const, custom: custom({ freq: "MONTHLY", monthlyBy: "weekday", ends: "count", count: "6" }) };
    expect(repeatRule(byDay, WED, "DAILY")).toBe("FREQ=MONTHLY;BYMONTHDAY=28");
    expect(repeatRule(byWeekday, "2026-10-13", "DAILY")).toBe("FREQ=MONTHLY;BYDAY=2TU;COUNT=6");
  });

  it("keeps weekly-list custom rules to weeks", () => {
    const state = { preset: "custom" as const, custom: custom({ freq: "DAILY", interval: "3" }) };
    expect(repeatRule(state, "2026-10-26", "WEEKLY")).toBe("FREQ=WEEKLY;INTERVAL=3");
  });

  it("turns a field that isn't a whole number into 0, which is a problem", () => {
    const rule = buildRRule(customOptions(custom({ interval: "", ends: "count", count: "2.5" }), WED, "DAILY"));
    expect(rule).toBe("FREQ=WEEKLY;INTERVAL=0;BYDAY=WE;COUNT=0");
    expect(repeatProblem(rule, "DAILY", WED)).toBe("Repeat every 1 to 99");
  });

  it("uses the preset's rule, following the chosen day", () => {
    const state = repeatStateFor("FREQ=WEEKLY;BYDAY=WE", WED, "DAILY");
    expect(state.preset).toBe("weekly");
    expect(repeatRule(state, "2026-10-29", "DAILY")).toBe("FREQ=WEEKLY;BYDAY=TH");
    expect(repeatRule({ ...state, preset: "none" }, WED, "DAILY")).toBeNull();
  });

  it("finds the preset of a stored rule, else Custom…", () => {
    expect(repeatStateFor(null, WED, "DAILY").preset).toBe("none");
    expect(repeatStateFor("FREQ=WEEKLY;BYDAY=FR,MO,TU,WE,TH", WED, "DAILY").preset).toBe("weekdays");
    expect(repeatStateFor("FREQ=WEEKLY;INTERVAL=2", "2026-10-26", "WEEKLY").preset).toBe("biweekly");
    expect(repeatStateFor("FREQ=WEEKLY;BYDAY=MO,WE,FR", WED, "DAILY").preset).toBe("custom");
    expect(repeatStateFor("FREQ=HOURLY", WED, "DAILY").preset).toBe("none");
  });
});

describe("repeatProblem", () => {
  it.each([
    ["FREQ=DAILY", null],
    ["FREQ=DAILY;INTERVAL=99", null],
    ["FREQ=DAILY;INTERVAL=100", "Repeat every 1 to 99"],
    ["FREQ=DAILY;INTERVAL=0", "Repeat every 1 to 99"],
    ["FREQ=DAILY;COUNT=999", null],
    ["FREQ=DAILY;COUNT=0", "End after 1 to 999 times"],
    ["FREQ=DAILY;COUNT=1000", "End after 1 to 999 times"],
    ["FREQ=DAILY;UNTIL=20261028", null],
    ["FREQ=DAILY;UNTIL=20261027", "The end date can't be before the start date"],
    // Starts on a Wednesday, repeats on Mondays, ends that Sunday.
    ["FREQ=WEEKLY;BYDAY=MO;UNTIL=20261101", "That doesn't repeat on any day before the end date"],
    ["FREQ=WEEKLY;BYDAY=MO;UNTIL=20261102", null],
    ["FREQ=MONTHLY;BYMONTHDAY=31;UNTIL=20261130", "That doesn't repeat on any day before the end date"],
    ["FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=30", "Choose a repeat option from the list"],
    ["FREQ=HOURLY", "Choose a repeat option from the list"],
  ])("%s", (rule, problem) => {
    const start = rule.includes("BYMONTHDAY=31") ? "2026-11-01" : WED;
    expect(repeatProblem(rule, "DAILY", start)).toBe(problem);
  });

  it("keeps weekly-list tasks to whole weeks", () => {
    expect(repeatProblem("FREQ=WEEKLY;INTERVAL=2", "WEEKLY", "2026-10-26")).toBeNull();
    expect(repeatProblem("FREQ=DAILY", "WEEKLY", "2026-10-26")).toBe("Weekly tasks repeat by week");
    expect(repeatProblem("FREQ=WEEKLY;BYDAY=MO", "WEEKLY", "2026-10-26")).toBe("Weekly tasks repeat by week");
  });

  it("checks a leap-day yearly rule quickly", () => {
    const started = performance.now();
    expect(repeatProblem("FREQ=YEARLY;UNTIL=20320101", "DAILY", "2028-02-29")).toBeNull();
    expect(repeatProblem("FREQ=MONTHLY;BYMONTHDAY=31;UNTIL=20270115", "DAILY", "2026-12-31")).toBeNull();
    expect(performance.now() - started).toBeLessThan(500);
  });
});
