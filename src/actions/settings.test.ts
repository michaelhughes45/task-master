import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/session", () => ({ getCurrentUserId: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { update: vi.fn(), updateMany: vi.fn() } },
}));

const { revalidatePath } = await import("next/cache");
const { getCurrentUserId } = await import("@/lib/session");
const { prisma } = await import("@/lib/prisma");
const { setTimezoneIfMissing, updateReviewNotify, updateTimezone } = await import("./settings");

const update = vi.mocked(prisma.user.update);
const updateMany = vi.mocked(prisma.user.updateMany);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
  update.mockResolvedValue({} as never);
  updateMany.mockResolvedValue({ count: 1 });
});

describe("updateTimezone", () => {
  it("saves a valid zone for the session user", async () => {
    const result = await updateTimezone("America/New_York");

    expect(result).toEqual({ success: true, data: { timezone: "America/New_York" } });
    expect(update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { timezone: "America/New_York" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it.each(["Mars/Olympus_Mons", "+05:00", "", 42, null])("rejects %j", async (input) => {
    const result = await updateTimezone(input);

    expect(result.success).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects signed-out callers", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);

    const result = await updateTimezone("Europe/London");

    expect(result.success).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("returns a friendly error when the write fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    update.mockRejectedValue(new Error("connection refused"));

    const result = await updateTimezone("Europe/London");

    expect(result).toEqual({ success: false, error: "Couldn't save your timezone. Try again." });
  });
});

describe("setTimezoneIfMissing", () => {
  it("only fills the session user's timezone while it is still null", async () => {
    const result = await setTimezoneIfMissing("Pacific/Auckland");

    expect(result).toEqual({ success: true, data: { updated: true } });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "user-1", timezone: null },
      data: { timezone: "Pacific/Auckland" },
    });
  });

  it("reports no change and skips revalidating when a timezone is already set", async () => {
    updateMany.mockResolvedValue({ count: 0 });

    const result = await setTimezoneIfMissing("Pacific/Auckland");

    expect(result).toEqual({ success: true, data: { updated: false } });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("accepts zones a browser reports that the runtime list leaves out", async () => {
    const result = await setTimezoneIfMissing("UTC");

    expect(result.success).toBe(true);
  });

  it("rejects an invalid zone", async () => {
    const result = await setTimezoneIfMissing("Not/A_Zone");

    expect(result.success).toBe(false);
    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe("updateReviewNotify", () => {
  it("saves the switch for the session user", async () => {
    const result = await updateReviewNotify(false);

    expect(result).toEqual({ success: true, data: { reviewNotify: false } });
    expect(update).toHaveBeenCalledWith({ where: { id: "user-1" }, data: { reviewNotify: false } });
  });

  it("rejects non-boolean input", async () => {
    const result = await updateReviewNotify("false");

    expect(result.success).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects signed-out callers", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);

    expect((await updateReviewNotify(true)).success).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});
