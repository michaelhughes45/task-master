import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: { task: { findMany: vi.fn() }, taskCompletion: { findMany: vi.fn() } },
}));

const { prisma } = await import("@/lib/prisma");
const { getDayTasks, getOpenEarlier, getWeekDayCounts, getWeekTasks, toTaskView } = await import(
  "./tasks"
);

const findMany = vi.mocked(prisma.task.findMany);
const findCompletions = vi.mocked(prisma.taskCompletion.findMany);
const day = (value: string) => new Date(`${value}T00:00:00Z`);
const NY = "America/New_York";

type Row = Parameters<typeof toTaskView>[0];

function row(overrides: Partial<Row> = {}): Row {
  return {
    id: "task-1",
    title: "Pay bill",
    notes: null,
    scope: "DAILY" as const,
    priority: "NORMAL" as const,
    date: day("2026-10-28"),
    rrule: null,
    exceptions: [],
    completions: [],
    ...overrides,
  };
}

function done(occurrenceDate: string, completedAt: string, minutesSpent: number | null = null) {
  return { occurrenceDate: day(occurrenceDate), completedAt: new Date(completedAt), minutesSpent, workNote: null };
}

const occurrence = (date: string, occurrenceDate = date) => ({ occurrenceDate, date, title: "Pay bill" });

// Every day from Monday, Oct 26, ticked on Tuesday only.
const READ = row({
  id: "read",
  title: "Read 20 pages",
  date: day("2026-10-26"),
  rrule: "FREQ=DAILY",
  completions: [done("2026-10-27", "2026-10-27T22:00:00Z")],
});

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([]);
  findCompletions.mockResolvedValue([]);
});

describe("toTaskView", () => {
  it("shows an open task", () => {
    expect(toTaskView(row(), occurrence("2026-10-28"), undefined, NY)).toEqual({
      id: "task-1",
      title: "Pay bill",
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
    });
  });

  it("labels an occurrence of a repeating task", () => {
    const view = toTaskView(row({ rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" }), occurrence("2026-10-28"), undefined, NY);
    expect(view.repeatLabel).toBe("Every weekday");
  });

  it("treats a tick late that evening in the user's zone as on time", () => {
    // 11:30 PM Oct 28 in New York is already Oct 29 in UTC.
    const view = toTaskView(row(), occurrence("2026-10-28"), done("2026-10-28", "2026-10-29T03:30:00Z", 25), NY);

    expect(view).toMatchObject({ done: true, doneLate: false, minutesSpent: 25 });
  });

  it("marks a tick after the day ended as done late", () => {
    const view = toTaskView(row(), occurrence("2026-10-28"), done("2026-10-28", "2026-10-29T04:30:00Z"), NY);

    expect(view).toMatchObject({ done: true, doneLate: true });
  });

  it("counts a weekly task done on Sunday as on time", () => {
    const view = toTaskView(
      row({ scope: "WEEKLY", date: day("2026-10-26") }),
      occurrence("2026-10-26"),
      done("2026-10-26", "2026-11-02T03:00:00Z"),
      NY,
    );

    expect(view).toMatchObject({ day: "2026-10-26", done: true, doneLate: false });
  });

  it("counts lateness from the day a moved occurrence is shown on", () => {
    // Moved from Oct 27 to Oct 28, ticked on Oct 28.
    const view = toTaskView(row(), occurrence("2026-10-28", "2026-10-27"), done("2026-10-27", "2026-10-28T20:00:00Z"), NY);

    expect(view).toMatchObject({ day: "2026-10-28", occurrenceDate: "2026-10-27", doneLate: false });
  });
});

describe("queries", () => {
  it("loads one-off tasks in the range and repeating series that started by its end", async () => {
    await getDayTasks("user-1", "2026-10-28", NY);

    const args = findMany.mock.calls[0][0];
    expect(args?.where).toEqual({
      userId: "user-1",
      scope: "DAILY",
      OR: [
        { rrule: null, date: { gte: day("2026-10-28"), lte: day("2026-10-28") } },
        { rrule: { not: null }, date: { lte: day("2026-10-28") } },
      ],
    });
    // Completions only for the range, so a long series doesn't load its whole history.
    expect(args?.select?.completions).toMatchObject({
      where: { occurrenceDate: { gte: day("2026-10-28"), lte: day("2026-10-28") } },
    });
  });

  it("finds a week's tasks from any day of it", async () => {
    await getWeekTasks("user-1", "2026-10-29", NY);

    expect(findMany.mock.calls[0][0]?.where).toMatchObject({ userId: "user-1", scope: "WEEKLY" });
    expect(findMany.mock.calls[0][0]?.where?.OR).toContainEqual({
      rrule: null,
      date: { gte: day("2026-10-26"), lte: day("2026-10-26") },
    });
  });

  it("shows a repeating task on each day, ticked only where it was ticked", async () => {
    findMany.mockResolvedValue([READ] as never);

    const tuesday = await getDayTasks("user-1", "2026-10-27", NY);
    const wednesday = await getDayTasks("user-1", "2026-10-28", NY);

    expect(tuesday).toEqual([expect.objectContaining({ id: "read", day: "2026-10-27", done: true })]);
    expect(wednesday).toEqual([expect.objectContaining({ id: "read", day: "2026-10-28", done: false })]);
  });

  it("leaves out a series before it starts and a one-off on another day", async () => {
    findMany.mockResolvedValue([READ, row({ date: day("2026-10-28") })] as never);

    expect(await getDayTasks("user-1", "2026-10-25", NY)).toEqual([]);
  });

  it("shows a weekly series once a week, on the Monday", async () => {
    findMany.mockResolvedValue([
      row({ id: "run", scope: "WEEKLY", date: day("2026-10-26"), rrule: "FREQ=WEEKLY" }),
    ] as never);

    const tasks = await getWeekTasks("user-1", "2026-11-05", NY);

    expect(tasks).toEqual([expect.objectContaining({ id: "run", day: "2026-11-02", occurrenceDate: "2026-11-02" })]);
  });

  it("applies cancelled and renamed occurrences", async () => {
    findMany.mockResolvedValue([
      {
        ...READ,
        exceptions: [
          { occurrenceDate: day("2026-10-28"), cancelled: true, title: null, date: null },
          { occurrenceDate: day("2026-10-29"), cancelled: false, title: "Read 30 pages", date: null },
        ],
      },
    ] as never);

    expect(await getDayTasks("user-1", "2026-10-28", NY)).toEqual([]);
    expect(await getDayTasks("user-1", "2026-10-29", NY)).toEqual([
      expect.objectContaining({ title: "Read 30 pages" }),
    ]);
  });

  it("loads the completion of an occurrence moved in from outside the range", async () => {
    findMany.mockResolvedValue([
      { ...READ, exceptions: [{ occurrenceDate: day("2026-10-27"), cancelled: false, title: null, date: day("2026-10-30") }] },
    ] as never);
    findCompletions.mockResolvedValue([{ taskId: "read", ...done("2026-10-27", "2026-10-30T14:00:00Z", 30) }] as never);

    const tasks = await getDayTasks("user-1", "2026-10-30", NY);

    expect(findCompletions.mock.calls[0][0]?.where).toEqual({
      OR: [{ taskId: "read", occurrenceDate: day("2026-10-27") }],
    });
    expect(tasks.map((t) => [t.occurrenceDate, t.done, t.minutesSpent])).toEqual([
      ["2026-10-27", true, 30],
      ["2026-10-30", false, null],
    ]);
  });

  it("orders by day, keeping the query's order within a day", async () => {
    findMany.mockResolvedValue([READ, row({ id: "bill", date: day("2026-10-27") })] as never);

    const tasks = await getOpenEarlier("user-1", "2026-10-29", NY);

    expect(tasks.map((t) => `${t.day} ${t.id}`)).toEqual(["2026-10-26 read", "2026-10-27 bill", "2026-10-28 read"]);
  });

  it("counts done and total per day, Monday to Sunday, repeating tasks included", async () => {
    findMany.mockResolvedValue([
      READ,
      row({ id: "a", date: day("2026-10-26"), completions: [done("2026-10-26", "2026-10-26T15:00:00Z")] }),
      row({ id: "b", date: day("2026-11-01") }),
    ] as never);

    const counts = await getWeekDayCounts("user-1", "2026-10-28");

    expect(findMany.mock.calls[0][0]?.where?.OR).toContainEqual({
      rrule: null,
      date: { gte: day("2026-10-26"), lte: day("2026-11-01") },
    });
    expect(counts).toHaveLength(7);
    expect(counts[0]).toEqual({ day: "2026-10-26", done: 1, total: 2 });
    expect(counts[1]).toEqual({ day: "2026-10-27", done: 1, total: 1 });
    expect(counts[2]).toEqual({ day: "2026-10-28", done: 0, total: 1 });
    expect(counts[6]).toEqual({ day: "2026-11-01", done: 0, total: 2 });
  });

  it("finds earlier days this week that are open or were ticked today", async () => {
    findMany.mockResolvedValue([
      row({
        id: "read",
        date: day("2026-10-26"),
        rrule: "FREQ=DAILY",
        completions: [
          // On time Monday; late on Tuesday, ticked this morning (Oct 30 in New York).
          done("2026-10-26", "2026-10-26T22:00:00Z"),
          done("2026-10-27", "2026-10-30T13:00:00Z"),
        ],
      }),
    ] as never);

    const tasks = await getOpenEarlier("user-1", "2026-10-30", NY);

    expect(findMany.mock.calls[0][0]?.where?.OR).toContainEqual({
      rrule: null,
      date: { gte: day("2026-10-26"), lte: day("2026-10-29") },
    });
    expect(tasks.map((t) => [t.day, t.done])).toEqual([
      ["2026-10-27", true],
      ["2026-10-28", false],
      ["2026-10-29", false],
    ]);
  });

  it("has nothing earlier on a Monday", async () => {
    expect(await getOpenEarlier("user-1", "2026-11-02", NY)).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
