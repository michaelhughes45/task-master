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
const { createTask, deleteTask, updateTask } = await import("./tasks");

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
