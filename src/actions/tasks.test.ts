import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/session", () => ({ getCurrentUserId: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    taskCompletion: { upsert: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const { revalidatePath } = await import("next/cache");
const { getCurrentUserId } = await import("@/lib/session");
const { prisma } = await import("@/lib/prisma");
const { completeTask, createTask, deleteTask, saveCompletionDetails, uncompleteTask, updateTask } =
  await import("./tasks");

const task = vi.mocked(prisma.task);
const completion = vi.mocked(prisma.taskCompletion);

const day = (value: string) => new Date(`${value}T00:00:00Z`);
const DAILY_TASK = { id: "task-1", scope: "DAILY" as const, date: day("2026-10-28") };
const WEEKLY_TASK = { id: "task-2", scope: "WEEKLY" as const, date: day("2026-10-26") };

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
});

describe("createTask", () => {
  it("creates a daily task for the session user on its day", async () => {
    const result = await createTask({ title: "  Pay bill ", scope: "DAILY", date: "2026-10-28" });

    expect(result).toEqual({ success: true, data: { id: "task-new" } });
    expect(task.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user-1", title: "Pay bill", date: day("2026-10-28") }),
      select: { id: true },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/todos");
  });

  it.each([
    ["2026-10-29", "2026-10-26"],
    ["2026-11-01", "2026-10-26"],
    ["2026-11-02", "2026-11-02"],
  ])("moves a weekly task dated %s to its Monday %s", async (date, monday) => {
    await createTask({ title: "Grocery run", scope: "WEEKLY", date });

    expect(task.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ date: day(monday) }) }),
    );
  });

  it("ignores a userId in the input", async () => {
    await createTask({ title: "Sneaky", scope: "DAILY", date: "2026-10-28", userId: "user-2" });

    expect(task.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "user-1" }) }),
    );
  });

  it.each([
    [{ title: "   ", scope: "DAILY", date: "2026-10-28" }, "title"],
    [{ title: "x".repeat(201), scope: "DAILY", date: "2026-10-28" }, "title"],
    [{ title: "Task", scope: "MONTHLY", date: "2026-10-28" }, "scope"],
    [{ title: "Task", scope: "DAILY", date: "2026-02-30" }, "date"],
    [{ title: "Task", scope: "DAILY", date: "2026-10-28", priority: "URGENT" }, "priority"],
  ])("rejects %j with a %s field error", async (input, field) => {
    const result = await createTask(input);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.fieldErrors).toHaveProperty(field);
    expect(task.create).not.toHaveBeenCalled();
  });

  it("rejects signed-out callers", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);

    const result = await createTask({ title: "Task", scope: "DAILY", date: "2026-10-28" });

    expect(result.success).toBe(false);
    expect(task.create).not.toHaveBeenCalled();
  });

  it("returns a friendly error when the write fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    task.create.mockRejectedValue(new Error("P1001: can't reach database"));

    const result = await createTask({ title: "Task", scope: "DAILY", date: "2026-10-28" });

    expect(result).toEqual({ success: false, error: "Couldn't add the task. Try again." });
  });
});

describe("updateTask", () => {
  it("looks the task up by id and session user", async () => {
    const result = await updateTask("task-1", { title: "New title" });

    expect(result).toEqual({ success: true, data: { id: "task-1" } });
    expect(task.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "task-1", userId: "user-1" } }),
    );
    expect(task.update).toHaveBeenCalledWith({
      where: { id: "task-1", userId: "user-1" },
      data: { title: "New title", date: undefined },
    });
    expect(completion.updateMany).not.toHaveBeenCalled();
  });

  it("returns not found for another user's task", async () => {
    task.findFirst.mockResolvedValue(null);

    const result = await updateTask("someone-elses", { title: "Mine now" });

    expect(result).toEqual({ success: false, error: "That task doesn't exist or was deleted." });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("moves a weekly task to the new week's Monday, completion included", async () => {
    task.findFirst.mockResolvedValue(WEEKLY_TASK as never);

    await updateTask("task-2", { date: "2026-11-05" });

    expect(task.update).toHaveBeenCalledWith({
      where: { id: "task-2", userId: "user-1" },
      data: { date: day("2026-11-02") },
    });
    expect(completion.updateMany).toHaveBeenCalledWith({
      where: { taskId: "task-2" },
      data: { occurrenceDate: day("2026-11-02") },
    });
  });

  it("clears notes with an empty string", async () => {
    await updateTask("task-1", { notes: "  " });

    expect(task.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { notes: null, date: undefined } }),
    );
  });

  it("rejects invalid fields", async () => {
    const result = await updateTask("task-1", { priority: "urgent" });

    expect(result.success).toBe(false);
    expect(task.findFirst).not.toHaveBeenCalled();
  });
});

describe("deleteTask", () => {
  it("deletes only the session user's task", async () => {
    const result = await deleteTask("task-1");

    expect(result).toEqual({ success: true, data: { id: "task-1" } });
    expect(task.deleteMany).toHaveBeenCalledWith({ where: { id: "task-1", userId: "user-1" } });
  });

  it("returns not found for another user's task", async () => {
    task.deleteMany.mockResolvedValue({ count: 0 });

    const result = await deleteTask("someone-elses");

    expect(result).toEqual({ success: false, error: "That task doesn't exist or was deleted." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([42, "", null])("rejects id %j", async (id) => {
    expect((await deleteTask(id)).success).toBe(false);
    expect(task.deleteMany).not.toHaveBeenCalled();
  });
});

describe("completeTask", () => {
  it("records a completion for the task's day, now", async () => {
    const result = await completeTask("task-1", "2026-10-28");

    expect(result).toEqual({ success: true, data: { taskId: "task-1" } });
    expect(completion.upsert).toHaveBeenCalledWith({
      where: { taskId_occurrenceDate: { taskId: "task-1", occurrenceDate: day("2026-10-28") } },
      create: {
        taskId: "task-1",
        occurrenceDate: day("2026-10-28"),
        completedAt: new Date("2026-10-30T15:00:00Z"),
      },
      update: {},
    });
  });

  it("stores a weekly completion against the week's Monday", async () => {
    task.findFirst.mockResolvedValue(WEEKLY_TASK as never);

    await completeTask("task-2", "2026-10-30");

    expect(completion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ occurrenceDate: day("2026-10-26") }),
      }),
    );
  });

  it("rejects a day the task isn't planned for", async () => {
    const result = await completeTask("task-1", "2026-10-29");

    expect(result).toEqual({ success: false, error: "That task isn't planned for that date." });
    expect(completion.upsert).not.toHaveBeenCalled();
  });

  it("returns not found for another user's task", async () => {
    task.findFirst.mockResolvedValue(null);

    const result = await completeTask("someone-elses", "2026-10-28");

    expect(result.success).toBe(false);
    expect(task.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "someone-elses", userId: "user-1" } }),
    );
    expect(completion.upsert).not.toHaveBeenCalled();
  });

  it("rejects a malformed date", async () => {
    const result = await completeTask("task-1", "28/10/2026");

    expect(result.success).toBe(false);
    expect(task.findFirst).not.toHaveBeenCalled();
  });
});

describe("uncompleteTask", () => {
  it("deletes the completion for that occurrence", async () => {
    const result = await uncompleteTask("task-1", "2026-10-28");

    expect(result.success).toBe(true);
    expect(completion.deleteMany).toHaveBeenCalledWith({
      where: { taskId: "task-1", occurrenceDate: day("2026-10-28") },
    });
  });

  it("returns not found for another user's task", async () => {
    task.findFirst.mockResolvedValue(null);

    expect((await uncompleteTask("someone-elses", "2026-10-28")).success).toBe(false);
    expect(completion.deleteMany).not.toHaveBeenCalled();
  });
});

describe("saveCompletionDetails", () => {
  it.each([0, 1440])("accepts %i minutes", async (minutesSpent) => {
    const result = await saveCompletionDetails("task-1", "2026-10-28", { minutesSpent });

    expect(result.success).toBe(true);
    expect(completion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { minutesSpent } }),
    );
  });

  it.each([-1, 1441, 12.5, "30"])("rejects %j minutes", async (minutesSpent) => {
    const result = await saveCompletionDetails("task-1", "2026-10-28", { minutesSpent });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.fieldErrors).toHaveProperty("minutesSpent");
    expect(completion.upsert).not.toHaveBeenCalled();
  });

  it("rejects a note over 500 characters", async () => {
    const result = await saveCompletionDetails("task-1", "2026-10-28", {
      workNote: "x".repeat(501),
    });

    expect(result.success).toBe(false);
    expect(completion.upsert).not.toHaveBeenCalled();
  });

  it("ticks the task if it wasn't done yet, with the details", async () => {
    await saveCompletionDetails("task-1", "2026-10-28", { minutesSpent: 30, workNote: " Done " });

    expect(completion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: {
          taskId: "task-1",
          occurrenceDate: day("2026-10-28"),
          completedAt: new Date("2026-10-30T15:00:00Z"),
          minutesSpent: 30,
          workNote: "Done",
        },
        update: { minutesSpent: 30, workNote: "Done" },
      }),
    );
  });

  it("returns not found for another user's task", async () => {
    task.findFirst.mockResolvedValue(null);

    const result = await saveCompletionDetails("someone-elses", "2026-10-28", { minutesSpent: 5 });

    expect(result.success).toBe(false);
    expect(completion.upsert).not.toHaveBeenCalled();
  });
});
