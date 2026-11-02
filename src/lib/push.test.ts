import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: "public-key",
    VAPID_PRIVATE_KEY: "private-key",
    VAPID_SUBJECT: "mailto:test@example.com",
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { pushSubscription: { deleteMany: vi.fn() } } }));
vi.mock("web-push", async () => {
  const actual = await vi.importActual<typeof import("web-push")>("web-push");
  return { default: { sendNotification: vi.fn() }, WebPushError: actual.WebPushError };
});

const webpush = (await import("web-push")).default;
const { WebPushError } = await import("web-push");
const { env } = await import("@/lib/env");
const { prisma } = await import("@/lib/prisma");
const { isPushConfigured, sendPush } = await import("./push");

const send = vi.mocked(webpush.sendNotification);
const deleteMany = vi.mocked(prisma.pushSubscription.deleteMany);

const sub = (id: string) => ({
  id,
  endpoint: `https://fcm.googleapis.com/fcm/send/${id}`,
  p256dh: `p256dh-${id}`,
  auth: `auth-${id}`,
});
const PAYLOAD = { title: "Title", body: "Body", url: "/review" };

function pushError(statusCode: number) {
  return new WebPushError("failed", statusCode, {}, "", "https://push.example.com/x");
}

beforeEach(() => {
  vi.clearAllMocks();
  send.mockResolvedValue({ statusCode: 201, body: "", headers: {} });
  deleteMany.mockResolvedValue({ count: 0 });
});

describe("sendPush", () => {
  it("sends the JSON payload to every subscription with the VAPID details", async () => {
    const summary = await sendPush([sub("a"), sub("b")], PAYLOAD);

    expect(summary).toEqual({ sent: 2, removed: 0, failed: 0 });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith(
      { endpoint: "https://fcm.googleapis.com/fcm/send/a", keys: { p256dh: "p256dh-a", auth: "auth-a" } },
      JSON.stringify(PAYLOAD),
      expect.objectContaining({
        vapidDetails: { publicKey: "public-key", privateKey: "private-key", subject: "mailto:test@example.com" },
      }),
    );
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it.each([404, 410])("deletes subscriptions that return %i", async (status) => {
    send.mockImplementation(async (subscription) => {
      if (subscription.endpoint.endsWith("/b")) throw pushError(status);
      return { statusCode: 201, body: "", headers: {} };
    });

    const summary = await sendPush([sub("a"), sub("b")], PAYLOAD);

    expect(summary).toEqual({ sent: 1, removed: 1, failed: 0 });
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["b"] } } });
  });

  it("counts other errors as failed, keeps the subscription and logs no keys or endpoint path", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    send.mockRejectedValueOnce(pushError(500)).mockRejectedValueOnce(new Error("ECONNRESET"));

    const summary = await sendPush([sub("a"), sub("b")], PAYLOAD);

    expect(summary).toEqual({ sent: 0, removed: 0, failed: 2 });
    expect(deleteMany).not.toHaveBeenCalled();
    const logged = log.mock.calls.flat().join(" ");
    expect(logged).toContain("fcm.googleapis.com");
    expect(logged).not.toContain("/a");
    expect(logged).not.toContain("auth-");
    expect(logged).not.toContain("p256dh-");
  });

  it("never sends to a stored endpoint that isn't a known push service", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const stray = { ...sub("x"), endpoint: "https://attacker.example.com/hook" };

    const summary = await sendPush([sub("a"), stray], PAYLOAD);

    expect(summary).toEqual({ sent: 1, removed: 0, failed: 1 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].endpoint).toBe("https://fcm.googleapis.com/fcm/send/a");
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("sends nothing when VAPID isn't configured", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(env).VAPID_PRIVATE_KEY = undefined;

    try {
      expect(isPushConfigured()).toBe(false);
      expect(await sendPush([sub("a")], PAYLOAD)).toEqual({ sent: 0, removed: 0, failed: 1 });
      expect(send).not.toHaveBeenCalled();
    } finally {
      vi.mocked(env).VAPID_PRIVATE_KEY = "private-key";
    }
  });
});
