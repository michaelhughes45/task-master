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
const {
  completeTask,
  createTask,
  deleteTask,
  deleteTaskOccurrence,
  saveCompletionDetails,
  uncompleteTask,
  updateTask,
  updateTaskOccurrence,
} = await import("./tasks");

const task = vi.mocked(prisma.task);
const completion = vi.mocked(prisma.taskCompletion);

const day = (value: string) => new Date(`${value}T00:00:00Z`);
const DAILY_TASK = { id: "task-1", title: "Pay bill", scope: "DAILY" as const, date: day("2026-10-28"), rrule: null };
const WEEKLY_TASK = { id: "task-2", title: "Long run", scope: "WEEKLY" as const, date: day("2026-10-26"), rrule: null };
// Every weekday from Monday, Oct 26.
const REPEATING_TASK = { ...DAILY_TASK, id: "task-3", date: day("2026-10-26"), rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" };

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

describe("createTask repeat rules", () => {
  it("stores a daily task's rule in its normal form", async () => {
    await createTask({ title: "Review inbox", scope: "DAILY", date: "2026-10-28", rrule: "FREQ=WEEKLY;BYDAY=FR,MO" });

    expect(task.create.mock.calls[0][0].data).toMatchObject({ rrule: "FREQ=WEEKLY;BYDAY=MO,FR" });
  });

  it("stores no rule for a one-off task", async () => {
    await createTask({ title: "Pay bill", scope: "DAILY", date: "2026-10-28" });

    expect(task.create.mock.calls[0][0].data).toMatchObject({ rrule: null });
  });

  it("repeats a weekly task from its Monday", async () => {
    await createTask({ title: "Long run", scope: "WEEKLY", date: "2026-10-29", rrule: "FREQ=WEEKLY;INTERVAL=2;COUNT=4" });

    expect(task.create.mock.calls[0][0].data).toMatchObject({
      date: day("2026-10-26"),
      rrule: "FREQ=WEEKLY;INTERVAL=2;COUNT=4",
    });
  });

  it("lets a weekly task end in the week it starts", async () => {
    // Picked Thursday; the series starts Monday, so an end date that Tuesday is fine.
    const result = await createTask({ title: "Long run", scope: "WEEKLY", date: "2026-10-29", rrule: "FREQ=WEEKLY;UNTIL=20261027" });

    expect(result.success).toBe(true);
  });

  it.each([
    ["DAILY", "FREQ=SECONDLY", "Choose a repeat option from the list"],
    ["DAILY", "FREQ=DAILY;INTERVAL=100", "Repeat every 1 to 99"],
    ["DAILY", "FREQ=DAILY;UNTIL=20261027", "The end date can't be before the start date"],
    ["WEEKLY", "FREQ=DAILY", "Weekly tasks repeat by week"],
    ["WEEKLY", "FREQ=WEEKLY;BYDAY=TU,TH", "Weekly tasks repeat by week"],
  ])("rejects a %s task repeating %s", async (scope, rrule, message) => {
    const result = await createTask({ title: "Read", scope, date: "2026-10-28", rrule });

    expect(result).toMatchObject({ success: false, fieldErrors: { rrule: [message] } });
    expect(task.create).not.toHaveBeenCalled();
  });
});

describe("updateTask repeat rules", () => {
  it("changes the whole series' rule", async () => {
    task.findFirst.mockResolvedValue(REPEATING_TASK as never);

    const result = await updateTask("task-3", { rrule: "freq=daily" });

    expect(result.success).toBe(true);
    expect(task.update).toHaveBeenCalledWith(expect.objectContaining({ data: { rrule: "FREQ=DAILY" } }));
  });

  it("stops repeating when the rule is cleared", async () => {
    task.findFirst.mockResolvedValue(REPEATING_TASK as never);

    await updateTask("task-3", { rrule: null });

    expect(task.update).toHaveBeenCalledWith(expect.objectContaining({ data: { rrule: null } }));
  });

  it("leaves the rule alone when it isn't sent", async () => {
    task.findFirst.mockResolvedValue(REPEATING_TASK as never);

    await updateTask("task-3", { title: "Inbox zero" });

    expect(task.update.mock.calls[0][0].data).not.toHaveProperty("rrule", expect.anything());
  });

  it("checks the rule against the stored scope and the series' start", async () => {
    task.findFirst.mockResolvedValue(WEEKLY_TASK as never);
    const weekly = await updateTask("task-2", { rrule: "FREQ=DAILY" });
    task.findFirst.mockResolvedValue(REPEATING_TASK as never);
    const tooEarly = await updateTask("task-3", { rrule: "FREQ=DAILY;UNTIL=20261025" });
    const movedPast = await updateTask("task-3", { date: "2026-11-02", rrule: "FREQ=DAILY;UNTIL=20261030" });

    expect(weekly).toMatchObject({ success: false, fieldErrors: { rrule: ["Weekly tasks repeat by week"] } });
    expect(tooEarly).toMatchObject({ success: false, fieldErrors: { rrule: ["The end date can't be before the start date"] } });
    expect(movedPast.success).toBe(false);
    expect(task.update).not.toHaveBeenCalled();
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

  it("leaves a repeating task's completions on their dates when its start moves", async () => {
    task.findFirst.mockResolvedValue(REPEATING_TASK as never);

    await updateTask("task-3", { date: "2026-11-02" });

    expect(task.update).toHaveBeenCalledWith(expect.objectContaining({ data: { date: day("2026-11-02") } }));
    expect(completion.updateMany).not.toHaveBeenCalled();
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

  it("ticks one occurrence of a repeating task", async () => {
    task.findFirst.mockResolvedValue(REPEATING_TASK as never);

    const result = await completeTask("task-3", "2026-10-29");

    expect(result.success).toBe(true);
    expect(prisma.taskException.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { taskId: "task-3", occurrenceDate: day("2026-10-29") } }),
    );
    expect(completion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { taskId_occurrenceDate: { taskId: "task-3", occurrenceDate: day("2026-10-29") } },
      }),
    );
  });

  it("rejects a day a repeating task skips, or one before it starts", async () => {
    task.findFirst.mockResolvedValue(REPEATING_TASK as never);

    expect((await completeTask("task-3", "2026-10-31")).success).toBe(false);
    expect((await completeTask("task-3", "2026-10-23")).success).toBe(false);
    expect(completion.upsert).not.toHaveBeenCalled();
  });

  it("rejects a cancelled occurrence", async () => {
    task.findFirst.mockResolvedValue(REPEATING_TASK as never);
    vi.mocked(prisma.taskException.findMany).mockResolvedValue([
      { occurrenceDate: day("2026-10-29"), cancelled: true, title: null, date: null },
    ] as never);

    const result = await completeTask("task-3", "2026-10-29");

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
