import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { NODE_ENV: "test", CRON_SECRET: "cron-secret-0123456789" } }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findMany: vi.fn() } } }));
vi.mock("@/lib/push", () => ({ sendPush: vi.fn() }));
vi.mock("@/lib/db/review", () => ({ getWeeklyReview: vi.fn() }));

const { env } = await import("@/lib/env");
const { prisma } = await import("@/lib/prisma");
const { sendPush } = await import("@/lib/push");
const { getWeeklyReview } = await import("@/lib/db/review");
const { GET } = await import("./route");

const findMany = vi.mocked(prisma.user.findMany);
const AUTH = { authorization: "Bearer cron-secret-0123456789" };
// The weekly run: Monday Nov 9, 2026 at 02:00 UTC (Sunday 7 PM in Denver, 9 PM in New York)
const RUN = "2026-11-09T02:00:00.000Z";

const sub = (id: string) => ({ id, endpoint: `https://push.example.com/${id}`, p256dh: "p", auth: "a" });
const USERS = [
  { id: "denver", timezone: "America/Denver", pushSubscriptions: [sub("denver-phone"), sub("denver-laptop")] },
  // 6 PM Sunday there: this week isn't ready yet, so the notice is about last week
  { id: "la", timezone: "America/Los_Angeles", pushSubscriptions: [sub("la")] },
];

function request(headers: Record<string, string> = AUTH, now = RUN) {
  return new Request(`http://localhost/api/cron/review?now=${encodeURIComponent(now)}`, { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(env).NODE_ENV = "test";
  findMany.mockResolvedValue(USERS as never);
  vi.mocked(getWeeklyReview).mockResolvedValue({ totals: { planned: 36, done: 28 } } as never);
  vi.mocked(sendPush).mockResolvedValue({ sent: 2, removed: 0, failed: 0 });
});

describe("GET /api/cron/review auth", () => {
  it.each([
    ["no header", {}],
    ["a wrong secret", { authorization: "Bearer wrong" }],
    ["the bare secret", { authorization: "cron-secret-0123456789" }],
  ])("returns 401 for %s and touches nothing", async (_, headers) => {
    const response = await GET(request(headers));

    expect(response.status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("returns 401 when no secret is configured", async () => {
    vi.mocked(env).CRON_SECRET = undefined;
    try {
      expect((await GET(request({ authorization: "Bearer undefined" }))).status).toBe(401);
    } finally {
      vi.mocked(env).CRON_SECRET = "cron-secret-0123456789";
    }
  });
});

describe("GET /api/cron/review selection", () => {
  it("asks only for users with the reminder on and a subscription", async () => {
    await GET(request());

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { reviewNotify: true, pushSubscriptions: { some: {} } } }),
    );
  });

  it("sends to every device of every user, about their latest ready week", async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ users: 2, sent: 4, removed: 0, failed: 0 });
    expect(getWeeklyReview).toHaveBeenCalledWith("denver", "2026-11-02", "America/Denver", new Date(RUN));
    expect(getWeeklyReview).toHaveBeenCalledWith("la", "2026-10-26", "America/Los_Angeles", new Date(RUN));
    expect(sendPush).toHaveBeenCalledWith([sub("denver-phone"), sub("denver-laptop")], {
      title: "Your weekly review is ready",
      body: "You finished 28 of 36 tasks this week.",
      url: "/review/2026-11-02",
    });
    expect(sendPush).toHaveBeenCalledWith([sub("la")], expect.objectContaining({ url: "/review/2026-10-26" }));
  });

  it("sends nothing when no one has the reminder on", async () => {
    findMany.mockResolvedValue([]);

    const response = await GET(request());

    expect(await response.json()).toEqual({ users: 0, sent: 0, removed: 0, failed: 0 });
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("adds up removed and failed sends", async () => {
    findMany.mockResolvedValue([USERS[0]] as never);
    vi.mocked(sendPush).mockResolvedValue({ sent: 0, removed: 1, failed: 1 });

    const response = await GET(request());

    expect(await response.json()).toEqual({ users: 1, sent: 0, removed: 1, failed: 1 });
  });

  it("keeps going when one user's review fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    findMany.mockResolvedValue([
      USERS[0],
      { id: "denver2", timezone: "America/Denver", pushSubscriptions: [sub("denver2")] },
    ] as never);
    vi.mocked(getWeeklyReview).mockRejectedValueOnce(new Error("db down"));
    vi.mocked(sendPush).mockResolvedValue({ sent: 1, removed: 0, failed: 0 });

    const response = await GET(request());

    expect(await response.json()).toEqual({ users: 1, sent: 1, removed: 0, failed: 2 });
  });

  it("ignores a faked time in production", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // Wednesday Nov 4: the latest ready week is still Oct 26
    vi.setSystemTime(new Date("2026-11-04T15:00:00.000Z"));
    vi.mocked(env).NODE_ENV = "production";
    try {
      await GET(request());
      expect(getWeeklyReview).toHaveBeenCalledWith("denver", "2026-10-26", "America/Denver", expect.any(Date));
    } finally {
      vi.useRealTimers();
    }
  });
});
