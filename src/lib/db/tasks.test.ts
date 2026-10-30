import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { task: { findMany: vi.fn() } } }));

const { prisma } = await import("@/lib/prisma");
const { getDayTasks, getOpenEarlier, getWeekDayCounts, getWeekTasks, toTaskView } = await import(
  "./tasks"
);

const findMany = vi.mocked(prisma.task.findMany);
const day = (value: string) => new Date(`${value}T00:00:00Z`);
const NY = "America/New_York";

function row(overrides: Partial<Parameters<typeof toTaskView>[0]> = {}) {
  return {
    id: "task-1",
    title: "Pay bill",
    notes: null,
    scope: "DAILY" as const,
    priority: "NORMAL" as const,
    date: day("2026-10-28"),
    completions: [],
    ...overrides,
  };
}

function done(occurrenceDate: string, completedAt: string, minutesSpent: number | null = null) {
  return { occurrenceDate: day(occurrenceDate), completedAt: new Date(completedAt), minutesSpent, workNote: null };
}

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([]);
});

describe("toTaskView", () => {
  it("shows an open task", () => {
    expect(toTaskView(row(), NY)).toEqual({
      id: "task-1",
      title: "Pay bill",
      notes: null,
      scope: "DAILY",
      priority: "NORMAL",
      day: "2026-10-28",
      done: false,
      doneLate: false,
      minutesSpent: null,
      workNote: null,
    });
  });

  it("treats a tick late that evening in the user's zone as on time", () => {
    // 11:30 PM Oct 28 in New York is already Oct 29 in UTC.
    const view = toTaskView(row({ completions: [done("2026-10-28", "2026-10-29T03:30:00Z", 25)] }), NY);

    expect(view).toMatchObject({ done: true, doneLate: false, minutesSpent: 25 });
  });

  it("marks a tick after the day ended as done late", () => {
    const view = toTaskView(row({ completions: [done("2026-10-28", "2026-10-29T04:30:00Z")] }), NY);

    expect(view).toMatchObject({ done: true, doneLate: true });
  });

  it("counts a weekly task done on Sunday as on time", () => {
    const view = toTaskView(
      row({ scope: "WEEKLY", date: day("2026-10-26"), completions: [done("2026-10-26", "2026-11-02T03:00:00Z")] }),
      NY,
    );

    expect(view).toMatchObject({ day: "2026-10-26", done: true, doneLate: false });
  });

  it("ignores a completion for another date", () => {
    expect(toTaskView(row({ completions: [done("2026-10-27", "2026-10-27T15:00:00Z")] }), NY).done).toBe(false);
  });
});

describe("queries", () => {
  it("scopes day and week queries to the user", async () => {
    await getDayTasks("user-1", "2026-10-28", NY);
    await getWeekTasks("user-1", "2026-10-29", NY);

    expect(findMany.mock.calls[0][0]?.where).toEqual({ userId: "user-1", scope: "DAILY", date: day("2026-10-28") });
    // Any day of the week finds that week's tasks.
    expect(findMany.mock.calls[1][0]?.where).toEqual({ userId: "user-1", scope: "WEEKLY", date: day("2026-10-26") });
  });

  it("counts done and total per day, Monday to Sunday", async () => {
    findMany.mockResolvedValue([
      { date: day("2026-10-26"), completions: [{ occurrenceDate: day("2026-10-26") }] },
      { date: day("2026-10-26"), completions: [] },
      { date: day("2026-11-01"), completions: [] },
    ] as never);

    const counts = await getWeekDayCounts("user-1", "2026-10-28");

    expect(findMany.mock.calls[0][0]?.where).toEqual({
      userId: "user-1",
      scope: "DAILY",
      date: { gte: day("2026-10-26"), lt: day("2026-11-02") },
    });
    expect(counts).toHaveLength(7);
    expect(counts[0]).toEqual({ day: "2026-10-26", done: 1, total: 2 });
    expect(counts[2]).toEqual({ day: "2026-10-28", done: 0, total: 0 });
    expect(counts[6]).toEqual({ day: "2026-11-01", done: 0, total: 1 });
  });

  it("finds earlier days this week that are open or were ticked today", async () => {
    await getOpenEarlier("user-1", "2026-10-30", NY);

    expect(findMany.mock.calls[0][0]?.where).toEqual({
      userId: "user-1",
      scope: "DAILY",
      date: { gte: day("2026-10-26"), lt: day("2026-10-30") },
      OR: [
        { completions: { none: {} } },
        {
          completions: {
            some: {
              // Oct 30 in New York (EDT, UTC−4)
              completedAt: { gte: new Date("2026-10-30T04:00:00Z"), lt: new Date("2026-10-31T04:00:00Z") },
            },
          },
        },
      ],
    });
  });

  it("has nothing earlier on a Monday", async () => {
    expect(await getOpenEarlier("user-1", "2026-11-02", NY)).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
