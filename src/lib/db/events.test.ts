import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { event: { findMany: vi.fn() } } }));

const { prisma } = await import("@/lib/prisma");
const { getEventsInRange } = await import("./events");

const findMany = vi.mocked(prisma.event.findMany);
const NY = "America/New_York";

// Applies the query's where clause to rows, the way Postgres would.
type Row = { allDay: boolean; startAt: Date; endAt: Date };
type Clause = { allDay: boolean; startAt: { lt: Date }; endAt: { gt: Date } };
function matches(row: Row) {
  const { OR } = findMany.mock.calls[0][0]?.where as unknown as { OR: Clause[] };
  return OR.some(
    (clause) => clause.allDay === row.allDay && row.startAt < clause.startAt.lt && row.endAt > clause.endAt.gt,
  );
}

const timed = (startAt: string, endAt: string) => ({ allDay: false, startAt: new Date(startAt), endAt: new Date(endAt) });
const allDay = (first: string, next: string) => ({
  allDay: true,
  startAt: new Date(`${first}T00:00:00Z`),
  endAt: new Date(`${next}T00:00:00Z`),
});

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([]);
});

describe("getEventsInRange", () => {
  it("scopes to the user and orders all-day events first", async () => {
    await getEventsInRange("user-1", "2026-10-30", "2026-10-30", NY);

    const args = findMany.mock.calls[0][0];
    expect(args?.where?.userId).toBe("user-1");
    expect(args?.orderBy).toEqual([{ allDay: "desc" }, { startAt: "asc" }]);
  });

  it("compares timed events with the day's bounds in the user's zone", async () => {
    await getEventsInRange("user-1", "2026-10-30", "2026-10-30", NY);

    expect(findMany.mock.calls[0][0]?.where?.OR).toContainEqual({
      allDay: false,
      // Oct 30 in New York (EDT, UTC−4)
      startAt: { lt: new Date("2026-10-31T04:00:00Z") },
      endAt: { gt: new Date("2026-10-30T04:00:00Z") },
    });
  });

  it("includes an event that starts before the range and ends inside it", async () => {
    await getEventsInRange("user-1", "2026-10-30", "2026-10-30", NY);

    // 10 PM Oct 29 to 1 AM Oct 30 in New York
    expect(matches(timed("2026-10-30T02:00:00Z", "2026-10-30T05:00:00Z"))).toBe(true);
  });

  it("leaves out timed events that end as the range starts or start as it ends", async () => {
    await getEventsInRange("user-1", "2026-10-30", "2026-10-30", NY);

    expect(matches(timed("2026-10-30T03:00:00Z", "2026-10-30T04:00:00Z"))).toBe(false);
    expect(matches(timed("2026-10-31T04:00:00Z", "2026-10-31T05:00:00Z"))).toBe(false);
    // 11 PM Oct 30 in New York is already Oct 31 in UTC.
    expect(matches(timed("2026-10-31T03:00:00Z", "2026-10-31T03:30:00Z"))).toBe(true);
  });

  it("keeps all-day events on their own dates in any zone", async () => {
    await getEventsInRange("user-1", "2026-10-30", "2026-10-30", "Pacific/Auckland");

    expect(matches(allDay("2026-10-30", "2026-10-31"))).toBe(true);
    expect(matches(allDay("2026-10-29", "2026-10-30"))).toBe(false);
    expect(matches(allDay("2026-10-31", "2026-11-01"))).toBe(false);
    expect(matches(allDay("2026-10-28", "2026-11-02"))).toBe(true);
  });

  it("covers a whole week across the fall-back change", async () => {
    await getEventsInRange("user-1", "2026-10-26", "2026-11-01", NY);

    expect(findMany.mock.calls[0][0]?.where?.OR).toEqual([
      {
        allDay: false,
        // Monday 00:00 EDT to the next Monday 00:00 EST
        startAt: { lt: new Date("2026-11-02T05:00:00Z") },
        endAt: { gt: new Date("2026-10-26T04:00:00Z") },
      },
      {
        allDay: true,
        startAt: { lt: new Date("2026-11-02T00:00:00Z") },
        endAt: { gt: new Date("2026-10-26T00:00:00Z") },
      },
    ]);
  });
});
