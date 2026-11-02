import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/session", () => ({ getCurrentUserId: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    taskCompletion: { upsert: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
    taskException: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const { revalidatePath } = await import("next/cache");
const { getCurrentUserId } = await import("@/lib/session");
const { prisma } = await import("@/lib/prisma");
const { deleteTaskOccurrence, updateTaskOccurrence } = await import("./task-occurrences");

const task = vi.mocked(prisma.task);
const completion = vi.mocked(prisma.taskCompletion);

const day = (value: string) => new Date(`${value}T00:00:00Z`);
const DAILY_TASK = { id: "task-1", title: "Pay bill", scope: "DAILY" as const, date: day("2026-10-28"), rrule: null };

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-30T15:00:00Z"));
  vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
  task.findFirst.mockResolvedValue(DAILY_TASK as never);
  task.create.mockResolvedValue({ id: "task-new" } as never);
  task.deleteMany.mockResolvedValue({ count: 1 });
  completion.upsert.mockResolvedValue({ minutesSpent: null, workNote: null } as never);
  completion.deleteMany.mockResolvedValue({ count: 1 });
  vi.mocked(prisma.$transaction).mockResolvedValue([] as never);
  vi.mocked(prisma.taskException.findMany).mockResolvedValue([]);
});

// The interactive transaction's client.
const tx = {
  task: { update: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  taskException: { upsert: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
  taskCompletion: { updateMany: vi.fn(), deleteMany: vi.fn() },
};

// Read 20 pages, daily from Monday, Oct 26.
const SERIES = {
  id: "task-3",
  title: "Read 20 pages",
  scope: "DAILY" as const,
  priority: "NORMAL" as const,
  notes: "Fiction only",
  date: day("2026-10-26"),
  rrule: "FREQ=DAILY",
  exceptions: [] as { occurrenceDate: Date; cancelled: boolean; title: string | null; date: Date | null }[],
};

describe("updateTaskOccurrence / deleteTaskOccurrence", () => {
  beforeEach(() => {
    task.findFirst.mockResolvedValue(SERIES as never);
    completion.findMany.mockResolvedValue([]);
    tx.task.create.mockResolvedValue({ id: "task-new" });
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) =>
      typeof fn === "function" ? fn(tx) : [],
    );
  });

  it("this one: renames the occurrence with an exception", async () => {
    const result = await updateTaskOccurrence("task-3", "2026-10-28", "this", { title: " Read 30 pages " });

    expect(result).toEqual({ success: true, data: { id: "task-3" } });
    expect(task.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "task-3", userId: "user-1" } }),
    );
    expect(tx.taskException.upsert).toHaveBeenCalledWith({
      where: { taskId_occurrenceDate: { taskId: "task-3", occurrenceDate: day("2026-10-28") } },
      create: {
        taskId: "task-3",
        occurrenceDate: day("2026-10-28"),
        cancelled: false,
        title: "Read 30 pages",
        date: null,
      },
      update: { cancelled: false, title: "Read 30 pages", date: null },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/todos");
  });

  it("this one: moves the occurrence to another day, keeping its completion where it was", async () => {
    task.findFirst.mockResolvedValue({ ...SERIES, rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" } as never);

    await updateTaskOccurrence("task-3", "2026-10-28", "this", { date: "2026-10-31" });

    expect(tx.taskException.upsert.mock.calls[0][0].update).toEqual({
      cancelled: false,
      title: null,
      date: day("2026-10-31"),
    });
    expect(tx.taskCompletion.updateMany).not.toHaveBeenCalled();
    expect(tx.taskCompletion.deleteMany).not.toHaveBeenCalled();
  });

  it("this and following: ends the series and moves later completions to the new one", async () => {
    completion.findMany.mockResolvedValue([
      { occurrenceDate: day("2026-10-28") },
      { occurrenceDate: day("2026-10-29") },
    ] as never);

    await updateTaskOccurrence("task-3", "2026-10-28", "following", { priority: "HIGH" });

    expect(completion.findMany).toHaveBeenCalledWith({
      where: { taskId: "task-3", occurrenceDate: { gte: day("2026-10-28") } },
      select: { occurrenceDate: true },
    });
    expect(tx.task.update).toHaveBeenCalledWith({
      where: { id: "task-3", userId: "user-1" },
      data: { rrule: "FREQ=DAILY;UNTIL=20261027" },
    });
    expect(tx.task.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        scope: "DAILY",
        notes: "Fiction only",
        title: "Read 20 pages",
        priority: "HIGH",
        rrule: "FREQ=DAILY",
        date: day("2026-10-28"),
        exceptions: { create: [] },
      },
      select: { id: true },
    });
    expect(tx.taskCompletion.updateMany).toHaveBeenCalledWith({
      where: { taskId: "task-3", occurrenceDate: { in: [day("2026-10-28"), day("2026-10-29")] } },
      data: { taskId: "task-new" },
    });
    expect(tx.taskException.deleteMany).toHaveBeenCalledWith({
      where: { taskId: "task-3", occurrenceDate: { gte: day("2026-10-28") } },
    });
  });

  it("all: updates the series", async () => {
    await updateTaskOccurrence("task-3", "2026-10-28", "all", { priority: "LOW" });

    expect(tx.task.update).toHaveBeenCalledWith({
      where: { id: "task-3", userId: "user-1" },
      data: { title: undefined, priority: "LOW" },
    });
    expect(tx.taskException.deleteMany).not.toHaveBeenCalled();
  });

  it("finds a weekly task's occurrence by its week's Monday", async () => {
    task.findFirst.mockResolvedValue({ ...SERIES, scope: "WEEKLY", rrule: "FREQ=WEEKLY" } as never);

    await updateTaskOccurrence("task-3", "2026-11-04", "this", { title: "Long run (12 km)" });

    expect(tx.taskException.upsert.mock.calls[0][0].where).toEqual({
      taskId_occurrenceDate: { taskId: "task-3", occurrenceDate: day("2026-11-02") },
    });
  });

  it("this one: cancels the occurrence and clears its completion", async () => {
    const result = await deleteTaskOccurrence("task-3", "2026-10-28", "this");

    expect(result.success).toBe(true);
    expect(tx.taskException.upsert.mock.calls[0][0].create).toMatchObject({ cancelled: true });
    expect(tx.taskCompletion.deleteMany).toHaveBeenCalledWith({
      where: { taskId: "task-3", occurrenceDate: day("2026-10-28") },
    });
  });

  it("this and following: ends the series and drops what's after it", async () => {
    await deleteTaskOccurrence("task-3", "2026-10-28", "following");

    expect(tx.task.update.mock.calls[0][0].data).toEqual({ rrule: "FREQ=DAILY;UNTIL=20261027" });
    expect(tx.taskCompletion.deleteMany).toHaveBeenCalledWith({
      where: { taskId: "task-3", occurrenceDate: { gte: day("2026-10-28") } },
    });
  });

  it("all: deletes only the user's series", async () => {
    await deleteTaskOccurrence("task-3", "2026-10-28", "all");

    expect(tx.task.deleteMany).toHaveBeenCalledWith({ where: { id: "task-3", userId: "user-1" } });
  });

  it("refuses a date the series doesn't produce, without writing", async () => {
    const result = await deleteTaskOccurrence("task-3", "2026-10-20", "this");

    expect(result.success).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses a priority for one occurrence", async () => {
    const result = await updateTaskOccurrence("task-3", "2026-10-28", "this", { priority: "HIGH" });

    expect(result.success).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses one-off tasks, other users' tasks, bad scopes and signed-out callers", async () => {
    task.findFirst.mockResolvedValueOnce({ ...SERIES, rrule: null } as never);
    expect((await deleteTaskOccurrence("task-3", "2026-10-28", "all")).success).toBe(false);

    task.findFirst.mockResolvedValueOnce(null);
    expect(await deleteTaskOccurrence("task-9", "2026-10-28", "all")).toEqual({
      success: false,
      error: "That task doesn't exist or was deleted.",
    });

    expect((await deleteTaskOccurrence("task-3", "2026-10-28", "everything")).success).toBe(false);
    expect((await updateTaskOccurrence("task-3", "2026-10-28", "this", { title: "" })).success).toBe(false);

    vi.mocked(getCurrentUserId).mockResolvedValue(null);
    expect((await deleteTaskOccurrence("task-3", "2026-10-28", "all")).success).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
