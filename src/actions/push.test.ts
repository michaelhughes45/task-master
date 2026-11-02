import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/session", () => ({ getCurrentUserId: vi.fn() }));
vi.mock("@/lib/push", () => ({ sendPush: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    pushSubscription: { upsert: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
    user: { update: vi.fn() },
  },
}));

const { revalidatePath } = await import("next/cache");
const { getCurrentUserId } = await import("@/lib/session");
const { sendPush } = await import("@/lib/push");
const { prisma } = await import("@/lib/prisma");
const { removeSubscription, saveSubscription, sendTestNotification } = await import("./push");

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc123";
const SUBSCRIPTION = { endpoint: ENDPOINT, expirationTime: null, keys: { p256dh: "BPk3y", auth: "a1b2" } };
const STORED = { id: "sub-1", endpoint: ENDPOINT, p256dh: "BPk3y", auth: "a1b2" };

const upsert = vi.mocked(prisma.pushSubscription.upsert);
const deleteMany = vi.mocked(prisma.pushSubscription.deleteMany);
const findMany = vi.mocked(prisma.pushSubscription.findMany);
const updateUser = vi.mocked(prisma.user.update);
const transaction = vi.mocked(prisma.$transaction);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
  // Return the query objects so the test can see which ran together
  upsert.mockImplementation(((args: unknown) => ({ op: "upsert", args })) as never);
  deleteMany.mockImplementation(((args: unknown) => ({ op: "deleteMany", args })) as never);
  updateUser.mockImplementation(((args: unknown) => ({ op: "updateUser", args })) as never);
  transaction.mockResolvedValue([] as never);
  findMany.mockResolvedValue([STORED] as never);
  vi.mocked(sendPush).mockResolvedValue({ sent: 1, removed: 0, failed: 0 });
});

describe("saveSubscription", () => {
  it("upserts by endpoint for the session user and turns the reminder on in one transaction", async () => {
    const result = await saveSubscription(SUBSCRIPTION);

    expect(result).toEqual({ success: true, data: null });
    expect(upsert).toHaveBeenCalledWith({
      where: { endpoint: ENDPOINT },
      create: { userId: "user-1", endpoint: ENDPOINT, p256dh: "BPk3y", auth: "a1b2" },
      update: { userId: "user-1", p256dh: "BPk3y", auth: "a1b2" },
    });
    expect(updateUser).toHaveBeenCalledWith({ where: { id: "user-1" }, data: { reviewNotify: true } });
    expect(transaction).toHaveBeenCalledWith([
      expect.objectContaining({ op: "upsert" }),
      expect.objectContaining({ op: "updateUser" }),
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/settings");
  });

  it.each([
    ["no endpoint", { keys: SUBSCRIPTION.keys }],
    ["an http endpoint", { ...SUBSCRIPTION, endpoint: "http://push.example.com/x" }],
    ["a non-URL endpoint", { ...SUBSCRIPTION, endpoint: "javascript:alert(1)" }],
    ["missing keys", { endpoint: ENDPOINT }],
    ["an empty auth key", { endpoint: ENDPOINT, keys: { p256dh: "x", auth: "" } }],
    ["an oversized key", { endpoint: ENDPOINT, keys: { p256dh: "x".repeat(300), auth: "a" } }],
    ["a string", "subscription"],
    ["null", null],
  ])("rejects %s", async (_, input) => {
    const result = await saveSubscription(input);

    expect(result.success).toBe(false);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects signed-out callers", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);

    expect((await saveSubscription(SUBSCRIPTION)).success).toBe(false);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("returns a friendly error when the write fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    transaction.mockRejectedValue(new Error("P2002 unique constraint"));

    expect(await saveSubscription(SUBSCRIPTION)).toEqual({
      success: false,
      error: "Couldn't turn on the reminder. Try again.",
    });
  });
});

describe("removeSubscription", () => {
  it("deletes only the session user's subscription and turns the reminder off", async () => {
    const result = await removeSubscription(ENDPOINT);

    expect(result).toEqual({ success: true, data: null });
    expect(deleteMany).toHaveBeenCalledWith({ where: { endpoint: ENDPOINT, userId: "user-1" } });
    expect(updateUser).toHaveBeenCalledWith({ where: { id: "user-1" }, data: { reviewNotify: false } });
    expect(transaction).toHaveBeenCalledWith([
      expect.objectContaining({ op: "deleteMany" }),
      expect.objectContaining({ op: "updateUser" }),
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/settings");
  });

  it.each(["", "not a url", "http://push.example.com/x", 42, null])("rejects %j", async (input) => {
    expect((await removeSubscription(input)).success).toBe(false);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects signed-out callers", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);

    expect((await removeSubscription(ENDPOINT)).success).toBe(false);
    expect(transaction).not.toHaveBeenCalled();
  });
});

describe("sendTestNotification", () => {
  it("sends to every subscription of the session user", async () => {
    const result = await sendTestNotification();

    expect(result).toEqual({ success: true, data: { sent: 1, removed: 0, failed: 0 } });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-1" } }));
    expect(sendPush).toHaveBeenCalledWith([STORED], expect.objectContaining({ url: "/review" }));
  });

  it("asks to turn the reminder on when there are no subscriptions", async () => {
    findMany.mockResolvedValue([]);

    const result = await sendTestNotification();

    expect(result).toEqual({ success: false, error: "Turn on the reminder on this device first." });
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("fails when nothing was delivered", async () => {
    vi.mocked(sendPush).mockResolvedValue({ sent: 0, removed: 1, failed: 0 });

    expect((await sendTestNotification()).success).toBe(false);
  });

  it("rejects signed-out callers", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);

    expect((await sendTestNotification()).success).toBe(false);
    expect(findMany).not.toHaveBeenCalled();
  });
});
