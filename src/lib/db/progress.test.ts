import { beforeEach, describe, expect, it, vi } from "vitest";
import { draftTask } from "@/lib/task-list";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/tasks", () => ({ getWeekDayCounts: vi.fn(), getWeekTasks: vi.fn() }));

const { getWeekDayCounts, getWeekTasks } = await import("@/lib/db/tasks");
const { getWeekProgress } = await import("./progress");

const NY = "America/New_York";

describe("getWeekProgress", () => {
  beforeEach(() => vi.clearAllMocks());

  it("adds every day's daily tasks to the week's weekly tasks", async () => {
    vi.mocked(getWeekDayCounts).mockResolvedValue([
      { day: "2026-10-26", done: 3, total: 4 },
      { day: "2026-10-27", done: 1, total: 4 },
      { day: "2026-10-28", done: 0, total: 5 },
    ]);
    vi.mocked(getWeekTasks).mockResolvedValue([
      { ...draftTask("w1", "Plan", "WEEKLY", "2026-10-26"), done: true },
      draftTask("w2", "Clean", "WEEKLY", "2026-10-26"),
    ]);

    expect(await getWeekProgress("user-1", "2026-10-28", NY)).toEqual({ done: 5, total: 15 });
  });

  it("asks for the week of the given day, by its Monday", async () => {
    vi.mocked(getWeekDayCounts).mockResolvedValue([]);
    vi.mocked(getWeekTasks).mockResolvedValue([]);

    // Sunday Nov 1 belongs to the week starting Monday Oct 26.
    expect(await getWeekProgress("user-1", "2026-11-01", NY)).toEqual({ done: 0, total: 0 });
    expect(getWeekDayCounts).toHaveBeenCalledWith("user-1", "2026-10-26");
    expect(getWeekTasks).toHaveBeenCalledWith("user-1", "2026-10-26", NY);
  });
});
