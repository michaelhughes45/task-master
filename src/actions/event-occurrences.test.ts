import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const { revalidatePath } = await import("next/cache");
const { getSession } = await import("@/lib/session");
const { prisma } = await import("@/lib/prisma");
const { deleteEventOccurrence, updateEventOccurrence } = await import("./event-occurrences");

const event = vi.mocked(prisma.event);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-30T15:00:00Z"));
  vi.mocked(getSession).mockResolvedValue({ user: { id: "user-1", timezone: "America/New_York" } } as never);
});

// The interactive transaction's client.
const tx = {
  event: { update: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  eventException: { upsert: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
};

// Spanish class, Wednesdays 7–8 PM New York from Oct 28 (EDT), so 23:00Z, then 00:00Z after Nov 1.
const SPANISH = {
  id: "event-3",
  title: "Spanish class",
  notes: null,
  location: "Room 4",
  color: "GREEN" as const,
  allDay: false,
  startAt: new Date("2026-10-28T23:00:00Z"),
  endAt: new Date("2026-10-29T00:00:00Z"),
  rrule: "FREQ=WEEKLY;BYDAY=WE",
  exceptions: [] as object[],
};
const NOV_11 = "2026-11-12T00:00:00.000Z";
const SPANISH_FORM = {
  title: "Spanish class",
  date: "2026-11-11",
  allDay: false,
  startTime: "19:00",
  endTime: "20:00",
  location: "Room 4",
  color: "GREEN",
  rrule: "FREQ=WEEKLY;BYDAY=WE",
};

describe("updateEventOccurrence / deleteEventOccurrence", () => {
  beforeEach(() => {
    event.findFirst.mockResolvedValue(SPANISH as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) =>
      typeof fn === "function" ? fn(tx) : [],
    );
  });

  it("this one: stores the new times as an exception", async () => {
    const values = { ...SPANISH_FORM, startTime: "18:00", endTime: "19:00" };
    const result = await updateEventOccurrence("event-3", NOV_11, "this", values);

    expect(result).toEqual({ success: true, data: { id: "event-3" } });
    expect(event.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "event-3", userId: "user-1" } }),
    );
    expect(tx.eventException.upsert).toHaveBeenCalledWith({
      where: { eventId_occurrenceStart: { eventId: "event-3", occurrenceStart: new Date(NOV_11) } },
      create: {
        eventId: "event-3",
        occurrenceStart: new Date(NOV_11),
        cancelled: false,
        title: null,
        notes: null,
        location: null,
        startAt: new Date("2026-11-11T23:00:00Z"),
        endAt: new Date("2026-11-12T00:00:00Z"),
      },
      update: expect.objectContaining({ startAt: new Date("2026-11-11T23:00:00Z") }),
    });
    expect(revalidatePath).toHaveBeenCalledWith("/calendar");
  });

  it("this and following: ends the series on the previous Wednesday and starts the new time", async () => {
    const values = { ...SPANISH_FORM, startTime: "18:30", endTime: "19:30" };
    await updateEventOccurrence("event-3", NOV_11, "following", values);

    expect(tx.event.update).toHaveBeenCalledWith({
      where: { id: "event-3", userId: "user-1" },
      data: { rrule: "FREQ=WEEKLY;BYDAY=WE;UNTIL=20261104" },
    });
    expect(tx.eventException.deleteMany).toHaveBeenCalledWith({
      where: { eventId: "event-3", occurrenceStart: { gte: new Date(NOV_11) } },
    });
    expect(tx.event.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        title: "Spanish class",
        notes: null,
        location: "Room 4",
        color: "GREEN",
        allDay: false,
        rrule: "FREQ=WEEKLY;BYDAY=WE",
        startAt: new Date("2026-11-11T23:30:00Z"),
        endAt: new Date("2026-11-12T00:30:00Z"),
        exceptions: { create: [] },
      },
    });
  });

  it("all: updates the series from its first day and replaces its exceptions", async () => {
    await updateEventOccurrence("event-3", NOV_11, "all", { ...SPANISH_FORM, startTime: "18:30", endTime: "19:30" });

    expect(tx.event.update).toHaveBeenCalledWith({
      where: { id: "event-3", userId: "user-1" },
      data: expect.objectContaining({
        startAt: new Date("2026-10-28T22:30:00Z"),
        endAt: new Date("2026-10-28T23:30:00Z"),
      }),
    });
    expect(tx.eventException.deleteMany).toHaveBeenCalledWith({ where: { eventId: "event-3" } });
    expect(tx.eventException.createMany).toHaveBeenCalledWith({ data: [] });
  });

  it("this one: moves an occurrence past the series' end date", async () => {
    const rrule = "FREQ=WEEKLY;BYDAY=WE;UNTIL=20261111";
    event.findFirst.mockResolvedValue({ ...SPANISH, rrule } as never);

    const result = await updateEventOccurrence("event-3", NOV_11, "this", { ...SPANISH_FORM, rrule, date: "2026-11-14" });

    expect(result).toEqual({ success: true, data: { id: "event-3" } });
    expect(tx.eventException.upsert.mock.calls[0][0].create).toMatchObject({
      startAt: new Date("2026-11-15T00:00:00Z"),
    });
  });

  it("refuses a color change for one occurrence", async () => {
    const result = await updateEventOccurrence("event-3", NOV_11, "this", { ...SPANISH_FORM, color: "BLUE" });

    expect(result.success).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("this one: cancels the occurrence", async () => {
    await deleteEventOccurrence("event-3", NOV_11, "this");

    expect(tx.eventException.upsert.mock.calls[0][0].create).toMatchObject({ cancelled: true });
  });

  it("this and following: ends the series", async () => {
    await deleteEventOccurrence("event-3", NOV_11, "following");

    expect(tx.event.update.mock.calls[0][0].data).toEqual({ rrule: "FREQ=WEEKLY;BYDAY=WE;UNTIL=20261104" });
    expect(tx.event.create).not.toHaveBeenCalled();
  });

  it("all: deletes only the user's series", async () => {
    await deleteEventOccurrence("event-3", NOV_11, "all");

    expect(tx.event.deleteMany).toHaveBeenCalledWith({ where: { id: "event-3", userId: "user-1" } });
  });

  it("refuses an instant centuries out before loading the series", async () => {
    const result = await deleteEventOccurrence("event-3", "9999-11-11T23:30:00.000Z", "this");

    expect(result).toEqual({ success: false, error: expect.any(String) });
    expect(event.findFirst).not.toHaveBeenCalled();
  });

  it("refuses a start that isn't an occurrence, a bad instant, one-offs and other users' events", async () => {
    expect((await deleteEventOccurrence("event-3", "2026-11-12T01:00:00.000Z", "this")).success).toBe(false);
    expect((await deleteEventOccurrence("event-3", "next wednesday", "this")).success).toBe(false);

    event.findFirst.mockResolvedValueOnce({ ...SPANISH, rrule: null } as never);
    expect((await deleteEventOccurrence("event-3", NOV_11, "all")).success).toBe(false);

    event.findFirst.mockResolvedValueOnce(null);
    expect(await deleteEventOccurrence("event-9", NOV_11, "all")).toEqual({
      success: false,
      error: "That event doesn't exist or was deleted.",
    });

    vi.mocked(getSession).mockResolvedValue(null);
    expect((await deleteEventOccurrence("event-3", NOV_11, "all")).success).toBe(false);
    expect((await updateEventOccurrence("event-3", NOV_11, "all", SPANISH_FORM)).success).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
