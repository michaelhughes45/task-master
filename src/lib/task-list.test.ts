import { describe, expect, it } from "vitest";
import type { TaskView } from "@/types/tasks";
import {
  applyTaskChange,
  countDone,
  draftTask,
  isDraftTask,
  isMissed,
  isPastOccurrence,
  taskKey,
} from "./task-list";

function task(overrides: Partial<TaskView> = {}): TaskView {
  return {
    id: "t1",
    title: "Write report",
    notes: null,
    scope: "DAILY",
    priority: "NORMAL",
    day: "2026-10-28",
    occurrenceDate: "2026-10-28",
    done: false,
    doneLate: false,
    minutesSpent: null,
    workNote: null,
    repeatLabel: null,
    ...overrides,
  };
}

describe("isPastOccurrence", () => {
  it("treats a daily task as past only after its day", () => {
    expect(isPastOccurrence(task({ day: "2026-10-27" }), "2026-10-28")).toBe(true);
    expect(isPastOccurrence(task({ day: "2026-10-28" }), "2026-10-28")).toBe(false);
    expect(isPastOccurrence(task({ day: "2026-10-29" }), "2026-10-28")).toBe(false);
  });

  it("keeps a weekly task open through its Sunday", () => {
    const weekly = task({ scope: "WEEKLY", day: "2026-10-26" });
    expect(isPastOccurrence(weekly, "2026-11-01")).toBe(false);
    expect(isPastOccurrence(weekly, "2026-11-02")).toBe(true);
  });

  it("handles a week that crosses a year boundary", () => {
    const weekly = task({ scope: "WEEKLY", day: "2026-12-28" });
    expect(isPastOccurrence(weekly, "2027-01-03")).toBe(false);
    expect(isPastOccurrence(weekly, "2027-01-04")).toBe(true);
  });
});

describe("isMissed", () => {
  it("is a past occurrence that isn't done", () => {
    expect(isMissed(task({ day: "2026-10-27" }), "2026-10-28")).toBe(true);
    expect(isMissed(task({ day: "2026-10-27", done: true }), "2026-10-28")).toBe(false);
    expect(isMissed(task({ day: "2026-10-28" }), "2026-10-28")).toBe(false);
  });
});

describe("countDone", () => {
  it("counts done and total", () => {
    expect(countDone([task({ done: true }), task(), task({ done: true })])).toEqual({ done: 2, total: 3 });
    expect(countDone([])).toEqual({ done: 0, total: 0 });
  });
});

describe("draftTask", () => {
  it("builds a not-done normal-priority placeholder marked as a draft", () => {
    const draft = draftTask("abc", "Call mum", "WEEKLY", "2026-10-26");
    expect(draft).toMatchObject({ title: "Call mum", scope: "WEEKLY", day: "2026-10-26", done: false, priority: "NORMAL" });
    expect(isDraftTask(draft)).toBe(true);
    expect(isDraftTask(task())).toBe(false);
  });
});

describe("taskKey", () => {
  it("tells occurrences of one task apart", () => {
    expect(taskKey(task({ id: "read", occurrenceDate: "2026-10-27" }))).toBe("read@2026-10-27");
  });
});

describe("applyTaskChange", () => {
  const today = "2026-10-28";

  it("ticks only the one occurrence of a repeating task", () => {
    const monday = task({ id: "read", day: "2026-10-26", occurrenceDate: "2026-10-26" });
    const tuesday = task({ id: "read", day: "2026-10-27", occurrenceDate: "2026-10-27" });
    const result = applyTaskChange([monday, tuesday], { type: "toggle", key: "read@2026-10-27", done: true, today });
    expect(result.map((t) => t.done)).toEqual([false, true]);

    const detailed = applyTaskChange(result, { type: "details", key: "read@2026-10-26", minutesSpent: 20, workNote: null, today });
    expect(detailed.map((t) => t.minutesSpent)).toEqual([20, null]);
  });

  it("renames every occurrence of a repeating task", () => {
    const occurrences = [task({ occurrenceDate: "2026-10-26" }), task({ occurrenceDate: "2026-10-27" })];
    const result = applyTaskChange(occurrences, { type: "update", id: "t1", title: "Read 30 pages" });
    expect(result.map((t) => t.title)).toEqual(["Read 30 pages", "Read 30 pages"]);
  });

  it("ticks a task for today on time", () => {
    const [result] = applyTaskChange([task()], { type: "toggle", key: "t1@2026-10-28", done: true, today });
    expect(result).toMatchObject({ done: true, doneLate: false });
  });

  it("ticks a past day's task as done late", () => {
    const [result] = applyTaskChange([task({ day: "2026-10-27" })], { type: "toggle", key: "t1@2026-10-28", done: true, today });
    expect(result).toMatchObject({ done: true, doneLate: true });
  });

  it("ticks this week's weekly task on time", () => {
    const weekly = task({ scope: "WEEKLY", day: "2026-10-26" });
    const [result] = applyTaskChange([weekly], { type: "toggle", key: "t1@2026-10-28", done: true, today: "2026-11-01" });
    expect(result).toMatchObject({ done: true, doneLate: false });
  });

  it("keeps the original lateness when an already-done task is ticked again", () => {
    const done = task({ day: "2026-10-27", done: true, doneLate: false });
    const [result] = applyTaskChange([done], { type: "toggle", key: "t1@2026-10-28", done: true, today });
    expect(result.doneLate).toBe(false);
  });

  it("clears lateness and details when unticking", () => {
    const done = task({ done: true, doneLate: true, minutesSpent: 30, workNote: "Draft" });
    const [result] = applyTaskChange([done], { type: "toggle", key: "t1@2026-10-28", done: false, today });
    expect(result).toMatchObject({ done: false, doneLate: false, minutesSpent: null, workNote: null });
  });

  it("saves details on a done task and keeps its lateness", () => {
    const done = task({ done: true, doneLate: false, minutesSpent: 10 });
    const [result] = applyTaskChange([done], { type: "details", key: "t1@2026-10-28", minutesSpent: 45, workNote: "Intro", today });
    expect(result).toMatchObject({ done: true, doneLate: false, minutesSpent: 45, workNote: "Intro" });
  });

  it("ticks a not-done task when saving details, late if its day has passed", () => {
    const past = task({ day: "2026-10-27" });
    const [result] = applyTaskChange([past], { type: "details", key: "t1@2026-10-28", minutesSpent: null, workNote: "Notes", today });
    expect(result).toMatchObject({ done: true, doneLate: true, minutesSpent: null, workNote: "Notes" });
  });

  it("only changes the matching task", () => {
    const other = task({ id: "t2" });
    const result = applyTaskChange([task(), other], { type: "toggle", key: "t1@2026-10-28", done: true, today });
    expect(result[1]).toBe(other);
  });

  it("appends an added task", () => {
    const added = task({ id: "t2" });
    expect(applyTaskChange([task()], { type: "add", task: added }).map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("renames and changes priority without touching other fields", () => {
    const renamed = applyTaskChange([task()], { type: "update", id: "t1", title: "New title" });
    expect(renamed[0]).toMatchObject({ title: "New title", priority: "NORMAL" });
    const prioritized = applyTaskChange(renamed, { type: "update", id: "t1", priority: "HIGH" });
    expect(prioritized[0]).toMatchObject({ title: "New title", priority: "HIGH" });
  });

  it("removes a task", () => {
    expect(applyTaskChange([task(), task({ id: "t2" })], { type: "remove", id: "t1" }).map((t) => t.id)).toEqual(["t2"]);
  });
});
