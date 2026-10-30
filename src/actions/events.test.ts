import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: { create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const { revalidatePath } = await import("next/cache");
const { getSession } = await import("@/lib/session");
const { prisma } = await import("@/lib/prisma");
const { createEvent, deleteEvent, deleteEventOccurrence, updateEvent, updateEventOccurrence } = await import(
  "./events"
);

const event = vi.mocked(prisma.event);

function signIn(timezone: string | null = "America/New_York") {
  vi.mocked(getSession).mockResolvedValue({ user: { id: "user-1", timezone } } as never);
}

const TIMED = {
  title: "  Dentist ",
  date: "2026-07-15",
  allDay: false,
  startTime: "16:00",
  endTime: "16:45",
  location: "Dr. Patel, Suite 210",
  color: "BLUE",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-30T15:00:00Z"));
  signIn();
  event.create.mockResolvedValue({ id: "event-new" } as never);
  event.updateMany.mockResolvedValue({ count: 1 });
  event.deleteMany.mockResolvedValue({ count: 1 });
});

describe("createEvent", () => {
  it("stores New York summer wall times as UTC (EDT, UTC−4)", async () => {
    const result = await createEvent(TIMED);

    expect(result).toEqual({ success: true, data: { id: "event-new" } });
    expect(event.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        title: "Dentist",
        notes: null,
        location: "Dr. Patel, Suite 210",
        color: "BLUE",
        allDay: false,
        startAt: new Date("2026-07-15T20:00:00Z"),
        endAt: new Date("2026-07-15T20:45:00Z"),
        rrule: null,
      },
      select: { id: true },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/today");
    expect(revalidatePath).toHaveBeenCalledWith("/calendar");
  });

  it("stores New York winter wall times as UTC (EST, UTC−5)", async () => {
    await createEvent({ ...TIMED, date: "2026-01-15" });

    expect(event.create.mock.calls[0][0].data).toMatchObject({
      startAt: new Date("2026-01-15T21:00:00Z"),
      endAt: new Date("2026-01-15T21:45:00Z"),
    });
  });

  it("handles the fall-back day, when the offset changes mid-event", async () => {
    // Nov 1 2026: 01:00–03:00 in New York spans 3 real hours.
    await createEvent({ ...TIMED, date: "2026-11-01", startTime: "01:00", endTime: "03:00" });

    expect(event.create.mock.calls[0][0].data).toMatchObject({
      startAt: new Date("2026-11-01T05:00:00Z"),
      endAt: new Date("2026-11-01T08:00:00Z"),
    });
  });

  it("uses UTC when the user has no timezone yet", async () => {
    signIn(null);

    await createEvent(TIMED);

    expect(event.create.mock.calls[0][0].data.startAt).toEqual(new Date("2026-07-15T16:00:00Z"));
  });

  it("stores an all-day event as its UTC date to the next day, ignoring times", async () => {
    await createEvent({ title: "Halloween", date: "2026-10-31", allDay: true, startTime: "09:00", color: "GREEN" });

    expect(event.create.mock.calls[0][0].data).toMatchObject({
      allDay: true,
      startAt: new Date("2026-10-31T00:00:00Z"),
      endAt: new Date("2026-11-01T00:00:00Z"),
    });
  });

  it.each([
    ["16:00", "15:00"],
    ["16:00", "16:00"],
  ])("rejects a %s start with a %s end", async (startTime, endTime) => {
    const result = await createEvent({ ...TIMED, startTime, endTime });

    expect(result).toMatchObject({ success: false, fieldErrors: { endTime: [expect.any(String)] } });
    expect(event.create).not.toHaveBeenCalled();
  });

  it("rejects a skipped spring-forward start that lands after the end", async () => {
    // Mar 8 2026: 02:30 doesn't exist in New York and moves forward to 03:30 EDT.
    const result = await createEvent({ ...TIMED, date: "2026-03-08", startTime: "02:30", endTime: "03:15" });

    expect(result).toMatchObject({ success: false, fieldErrors: { endTime: [expect.any(String)] } });
    expect(event.create).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...TIMED, title: "   " }, "title"],
    [{ ...TIMED, title: "x".repeat(201) }, "title"],
    [{ ...TIMED, date: "2026-02-30" }, "date"],
    [{ ...TIMED, startTime: "24:00" }, "startTime"],
    [{ ...TIMED, endTime: undefined }, "endTime"],
    [{ ...TIMED, location: "x".repeat(201) }, "location"],
    [{ ...TIMED, notes: "x".repeat(2001) }, "notes"],
    [{ ...TIMED, color: "RED" }, "color"],
  ])("rejects %j with a %s field error", async (input, field) => {
    const result = await createEvent(input);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.fieldErrors).toHaveProperty(field);
    expect(event.create).not.toHaveBeenCalled();
  });

  it("ignores a userId in the input", async () => {
    await createEvent({ ...TIMED, userId: "user-2" });

    expect(event.create.mock.calls[0][0].data.userId).toBe("user-1");
  });

  it("rejects signed-out callers", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const result = await createEvent(TIMED);

    expect(result.success).toBe(false);
    expect(event.create).not.toHaveBeenCalled();
  });

  it("returns a friendly error when the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    event.create.mockRejectedValue(new Error("connection reset"));

    expect(await createEvent(TIMED)).toEqual({ success: false, error: "Couldn't add the event. Try again." });
  });
});

describe("createEvent repeat rules", () => {
  it("stores the rule in its normal form", async () => {
    await createEvent({ ...TIMED, rrule: "byday=fr,mo;freq=weekly" });

    expect(event.create.mock.calls[0][0].data).toMatchObject({ rrule: "FREQ=WEEKLY;BYDAY=MO,FR" });
  });

  it("stores no rule for an empty one", async () => {
    await createEvent({ ...TIMED, rrule: "" });

    expect(event.create.mock.calls[0][0].data).toMatchObject({ rrule: null });
  });

  it.each([
    ["FREQ=HOURLY", "Choose a repeat option from the list"],
    // The rule from spec 15 that sent rrule searching to year 9999.
    ["FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=30", "Choose a repeat option from the list"],
    ["FREQ=DAILY;UNTIL=20260714", "The end date can't be before the start date"],
    // Wednesday Jul 15, Mondays only, ending that Sunday.
    ["FREQ=WEEKLY;BYDAY=MO;UNTIL=20260719", "That doesn't repeat on any day before the end date"],
    ["FREQ=DAILY;COUNT=0", "End after 1 to 999 times"],
  ])("rejects %s under rrule", async (rrule, message) => {
    const result = await createEvent({ ...TIMED, rrule });

    expect(result).toMatchObject({ success: false, fieldErrors: { rrule: [message] } });
    expect(event.create).not.toHaveBeenCalled();
  });

  it("keeps a repeating series on its date when updated", async () => {
    await updateEvent("event-1", { ...TIMED, rrule: "FREQ=WEEKLY;BYDAY=WE" });

    expect(event.updateMany.mock.calls[0][0].data).toMatchObject({
      rrule: "FREQ=WEEKLY;BYDAY=WE",
      startAt: new Date("2026-07-15T20:00:00Z"),
    });
  });

  it("stops repeating when the rule is cleared", async () => {
    await updateEvent("event-1", { ...TIMED, rrule: null });

    expect(event.updateMany.mock.calls[0][0].data).toMatchObject({ rrule: null });
  });
});

describe("updateEvent", () => {
  it("updates only the session user's event", async () => {
    const result = await updateEvent("event-1", { ...TIMED, notes: "  " });

    expect(result).toEqual({ success: true, data: { id: "event-1" } });
    expect(event.updateMany).toHaveBeenCalledWith({
      where: { id: "event-1", userId: "user-1" },
      data: expect.objectContaining({ title: "Dentist", notes: null, startAt: new Date("2026-07-15T20:00:00Z") }),
    });
  });

  it("returns not found for another user's event", async () => {
    event.updateMany.mockResolvedValue({ count: 0 });

    const result = await updateEvent("event-2", TIMED);

    expect(result).toEqual({ success: false, error: "That event doesn't exist or was deleted." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects an end before the start", async () => {
    const result = await updateEvent("event-1", { ...TIMED, endTime: "09:00" });

    expect(result.success).toBe(false);
    expect(event.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a bad id and signed-out callers", async () => {
    expect((await updateEvent(42, TIMED)).success).toBe(false);
    vi.mocked(getSession).mockResolvedValue(null);
    expect((await updateEvent("event-1", TIMED)).success).toBe(false);
    expect(event.updateMany).not.toHaveBeenCalled();
  });
});

describe("deleteEvent", () => {
  it("deletes only the session user's event", async () => {
    const result = await deleteEvent("event-1");

    expect(result).toEqual({ success: true, data: { id: "event-1" } });
    expect(event.deleteMany).toHaveBeenCalledWith({ where: { id: "event-1", userId: "user-1" } });
    expect(revalidatePath).toHaveBeenCalledWith("/calendar");
  });

  it("returns not found for another user's event", async () => {
    event.deleteMany.mockResolvedValue({ count: 0 });

    expect(await deleteEvent("event-2")).toEqual({ success: false, error: "That event doesn't exist or was deleted." });
  });

  it("rejects signed-out callers", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    expect((await deleteEvent("event-1")).success).toBe(false);
    expect(event.deleteMany).not.toHaveBeenCalled();
  });
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
