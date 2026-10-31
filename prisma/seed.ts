import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { generateRandomString, hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import type { EventColor, Priority } from "../src/generated/prisma/enums";
import { addDays, addWeeks, isBefore, todayIn, toDbDate, wallTimeToInstant, weekStartOf } from "../src/lib/dates";
import {
  DEMO_USER_EMAIL,
  DEMO_USER_NAME,
  DEMO_USER_PASSWORD,
  DEMO_USER_TIMEZONE,
} from "../src/lib/demo-user";

// Standalone client: src/lib/prisma.ts imports "server-only", which throws outside Next.js
const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
});

interface SeedDone {
  minutes?: number;
  note?: string;
  // Earlier weeks only: days after the occurrence's day (a weekly task's Monday) it was ticked.
  ticked?: number;
}

interface SeedTask {
  title: string;
  priority?: Priority;
  // Ticked off, if its day has come. Past-day tasks without this count as missed.
  done?: SeedDone;
}

// The mockup's one-off tasks, by weekday (0 = Monday).
const DAILY: SeedTask[][] = [
  [{ title: "Back up laptop", done: { minutes: 15 } }],
  [
    { title: "Reply to landlord", priority: "HIGH" },
    { title: "Book flights for December", done: { minutes: 40, note: "Found a direct flight on Dec 18." } },
  ],
  [{ title: "Pay electric bill", priority: "HIGH", done: { minutes: 20 } }, { title: "Call Mom" }],
  [{ title: "Return library books" }],
  [{ title: "Submit timesheet", priority: "HIGH" }],
  [{ title: "Wash the car" }],
  [{ title: "Plan next week" }],
];

interface SeedSeries {
  title: string;
  rrule: string;
  // Occurrences ticked off, by weekday (0 = Monday) this week.
  done: Record<number, SeedTask["done"]>;
}

// The mockup's repeating daily tasks, starting with the earliest past week. They come first in
// each day's list.
const REPEATING: SeedSeries[] = [
  { title: "Review inbox", rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", done: { 0: { minutes: 15 }, 1: {}, 2: { minutes: 20 } } },
  { title: "Read 20 pages", rrule: "FREQ=DAILY", done: { 0: {} } },
  { title: "Stretch for 10 minutes", rrule: "FREQ=DAILY", done: { 0: {}, 1: {}, 2: {} } },
];

const WEEKLY: (SeedTask & { rrule?: string })[] = [
  { title: "Grocery run", done: { minutes: 50 } },
  { title: "Clean the bathroom" },
  {
    title: "Finish chapter 3 notes",
    priority: "HIGH",
    done: { minutes: 130, note: "Summarised sections 3.1 to 3.4. Diagrams still to do." },
  },
  { title: "Plan next week's meals" },
  { title: "Long run (10 km)", rrule: "FREQ=WEEKLY" },
];

interface PastWeek {
  // Occurrences of the repeating tasks ticked off, by title and weekday (0 = Monday; a weekly
  // series' occurrence is its Monday).
  series: Record<string, Record<number, SeedDone>>;
  // One-off tasks by weekday (0 = Monday).
  daily: SeedTask[][];
  weekly: SeedTask[];
}

// Earlier weeks for the weekly review, newest first. Last week follows the mockup's review.
const PAST_WEEKS: PastWeek[] = [
  {
    series: {
      "Review inbox": { 0: { minutes: 15 }, 1: { minutes: 20 }, 2: { minutes: 20 }, 3: { minutes: 20 }, 4: { minutes: 20 } },
      "Read 20 pages": { 0: { ticked: 1 }, 2: {}, 4: {}, 6: {} },
      "Stretch for 10 minutes": { 0: {}, 1: {}, 2: {}, 4: {}, 5: {}, 6: {} },
      "Long run (10 km)": { 0: { minutes: 58, note: "Felt easier than last week.", ticked: 5 } },
    },
    daily: [
      [{ title: "Call the bank" }],
      [{ title: "Book dentist appointment", done: { minutes: 10 } }],
      [
        { title: "Pay phone bill", priority: "HIGH", done: { ticked: 2 } },
        { title: "Deep clean the kitchen", done: { minutes: 60, note: "Did the oven and the fridge." } },
      ],
      [{ title: "Spanish homework", done: { minutes: 40, note: "Past tense exercises, pages 54 to 57." } }],
      [{ title: "Renew car registration", done: { minutes: 25 } }],
      [],
      [{ title: "Water the plants" }],
    ],
    weekly: [
      { title: "Grocery run", done: { minutes: 45, ticked: 7 } },
      { title: "Clean the bathroom" },
      {
        title: "Finish chapter 2 notes",
        priority: "HIGH",
        done: { minutes: 215, note: "Outlined the whole chapter and started the summary.", ticked: 0 },
      },
      { title: "Update resume" },
    ],
  },
  {
    series: {
      "Review inbox": { 0: { minutes: 15 }, 1: { minutes: 15 }, 2: { minutes: 20 }, 3: { minutes: 15 } },
      "Read 20 pages": { 0: {}, 1: {}, 3: {}, 5: {} },
      "Stretch for 10 minutes": { 0: {}, 1: {}, 3: {}, 4: {}, 5: {} },
      "Long run (10 km)": { 0: { minutes: 62, ticked: 6 } },
    },
    daily: [
      [{ title: "Order printer ink", done: {} }],
      [],
      [{ title: "Cancel gym trial" }],
      [{ title: "Send birthday card", done: { minutes: 15 } }],
      [],
      [{ title: "Fix the bike tire", done: { minutes: 35, note: "New inner tube; the old one had two holes." } }],
      [],
    ],
    weekly: [
      { title: "Grocery run", done: { minutes: 50 } },
      { title: "Finish chapter 1 notes", done: { minutes: 180 } },
      { title: "Sort the closet" },
    ],
  },
];

interface SeedEvent {
  title: string;
  start: string;
  end: string;
  color?: EventColor;
  location?: string;
}

// The mockup's one-off events, by weekday (0 = Monday).
const EVENTS: SeedEvent[][] = [
  [{ title: "Grocery pickup", start: "18:00", end: "18:45" }],
  [
    { title: "Call with insurance", start: "14:00", end: "14:30" },
    { title: "Dinner with friends", start: "19:00", end: "21:00", location: "Osteria on 5th" },
  ],
  [
    { title: "Lunch with Sam", start: "13:00", end: "13:30" },
    { title: "Dentist", start: "16:00", end: "16:45", location: "Dr. Patel, Suite 210" },
  ],
  [{ title: "Haircut", start: "17:30", end: "18:15" }],
  [{ title: "Movie night", start: "20:00", end: "22:00" }],
  [
    { title: "Hike: Ridge Loop", start: "09:00", end: "13:00", color: "GREEN" },
    { title: "Halloween party", start: "19:30", end: "22:30" },
  ],
  [{ title: "Meal prep", start: "15:00", end: "16:30", color: "GREEN" }],
];

// The mockup's repeating events, each starting on its first weekday this week.
const REPEATING_EVENTS: (SeedEvent & { weekday: number; rrule: string })[] = [
  {
    title: "Gym",
    weekday: 0,
    start: "07:30",
    end: "08:15",
    color: "GREEN",
    location: "Northside Fitness",
    rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR",
  },
  { title: "Deep work: project proposal", weekday: 0, start: "09:00", end: "12:00", rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" },
  { title: "Spanish class", weekday: 2, start: "19:00", end: "20:00", color: "GREEN", rrule: "FREQ=WEEKLY;BYDAY=WE" },
  { title: "Weekly review", weekday: 6, start: "18:00", end: "18:30", rrule: "FREQ=WEEKLY;BYDAY=SU" },
];
// In the mockup, Friday's deep work ends at 11:00: an exception to this week's occurrence.
const DEEP_WORK_FRIDAY_END = "11:00";

// Existing users keep their id (and sessions); the password is reset to the demo one.
async function upsertDemoUser() {
  const user = await prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    create: {
      id: generateRandomString(32, "a-z", "A-Z", "0-9"),
      name: DEMO_USER_NAME,
      email: DEMO_USER_EMAIL,
      emailVerified: true,
      timezone: DEMO_USER_TIMEZONE,
    },
    update: { name: DEMO_USER_NAME, emailVerified: true, timezone: DEMO_USER_TIMEZONE },
  });

  const password = await hashPassword(DEMO_USER_PASSWORD);
  const account = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
    select: { id: true },
  });
  if (account) {
    await prisma.account.update({ where: { id: account.id }, data: { password } });
  } else {
    await prisma.account.create({
      data: {
        id: generateRandomString(32, "a-z", "A-Z", "0-9"),
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password,
      },
    });
  }
  return user.id;
}

// Past days were ticked that evening; today's (and weekly) ones just now.
function completionData(done: SeedTask["done"], day: string, today: string, now: Date, occurrenceDate: string) {
  if (!done || isBefore(today, day)) return [];
  const completedAt = day === today ? now : wallTimeToInstant(day, "18:00", DEMO_USER_TIMEZONE);
  return [
    {
      occurrenceDate: toDbDate(occurrenceDate),
      completedAt,
      minutesSpent: done.minutes,
      workNote: done.note,
    },
  ];
}

// Earlier weeks were ticked at 6 PM on the day given (but never after now).
function pastCompletion(done: SeedDone, occurrenceDate: string, defaultTicked: number, now: Date) {
  const ticked = wallTimeToInstant(addDays(occurrenceDate, done.ticked ?? defaultTicked), "18:00", DEMO_USER_TIMEZONE);
  return {
    occurrenceDate: toDbDate(occurrenceDate),
    completedAt: ticked < now ? ticked : now,
    minutesSpent: done.minutes,
    workNote: done.note,
  };
}

// A repeating task's ticks in the earlier weeks.
function pastSeriesCompletions(title: string, monday: string, now: Date) {
  return PAST_WEEKS.flatMap((week, i) =>
    Object.entries(week.series[title] ?? {}).map(([weekday, done]) =>
      pastCompletion(done, addDays(addWeeks(monday, -(i + 1)), Number(weekday)), 0, now),
    ),
  );
}

// The earlier weeks' one-off tasks; weekly ones were ticked on Friday unless given.
function pastOneOffs(monday: string, now: Date) {
  return PAST_WEEKS.flatMap((week, i) => {
    const weekMonday = addWeeks(monday, -(i + 1));
    const daily = week.daily.flatMap((tasks, weekday) => {
      const day = addDays(weekMonday, weekday);
      return tasks.map((task) => ({
        task,
        scope: "DAILY" as const,
        day,
        rrule: undefined,
        completions: task.done ? [pastCompletion(task.done, day, 0, now)] : [],
      }));
    });
    const weekly = week.weekly.map((task) => ({
      task,
      scope: "WEEKLY" as const,
      day: weekMonday,
      rrule: undefined,
      completions: task.done ? [pastCompletion(task.done, weekMonday, 4, now)] : [],
    }));
    return [...daily, ...weekly];
  });
}

function eventTimes(day: string, event: SeedEvent) {
  return {
    startAt: wallTimeToInstant(day, event.start, DEMO_USER_TIMEZONE),
    endAt: wallTimeToInstant(day, event.end, DEMO_USER_TIMEZONE),
  };
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("The demo seed is for development only");
  const now = new Date();
  const today = todayIn(DEMO_USER_TIMEZONE, now);
  const monday = weekStartOf(today);
  const userId = await upsertDemoUser();

  const seriesStart = addWeeks(monday, -PAST_WEEKS.length);

  const repeating = REPEATING.map((series) => ({
    task: series,
    scope: "DAILY" as const,
    day: seriesStart,
    rrule: series.rrule,
    completions: [
      ...pastSeriesCompletions(series.title, monday, now),
      ...Object.entries(series.done).flatMap(([weekday, done]) => {
        const day = addDays(monday, Number(weekday));
        return completionData(done, day, today, now, day);
      }),
    ],
  }));
  const daily = DAILY.flatMap((tasks, i) => {
    const day = addDays(monday, i);
    return tasks.map((task) => ({
      task,
      scope: "DAILY" as const,
      day,
      rrule: undefined,
      completions: completionData(task.done, day, today, now, day),
    }));
  });
  const weekly = WEEKLY.map((task) => ({
    task,
    scope: "WEEKLY" as const,
    day: task.rrule ? seriesStart : monday,
    rrule: task.rrule,
    completions: [
      ...(task.rrule ? pastSeriesCompletions(task.title, monday, now) : []),
      ...completionData(task.done, today, today, now, monday),
    ],
  }));
  const tasks = [...pastOneOffs(monday, now), ...repeating, ...daily, ...weekly];

  const events = EVENTS.flatMap((dayEvents, i) =>
    dayEvents.map((event) => ({
      userId,
      title: event.title,
      color: event.color,
      location: event.location,
      ...eventTimes(addDays(monday, i), event),
    })),
  );
  const fridayDeepWork = eventTimes(addDays(monday, 4), { ...REPEATING_EVENTS[1], end: DEEP_WORK_FRIDAY_END });

  await prisma.$transaction([
    prisma.task.deleteMany({ where: { userId } }),
    prisma.event.deleteMany({ where: { userId } }),
    prisma.event.createMany({ data: events }),
    ...REPEATING_EVENTS.map((event) =>
      prisma.event.create({
        data: {
          userId,
          title: event.title,
          color: event.color,
          location: event.location,
          rrule: event.rrule,
          ...eventTimes(addDays(monday, event.weekday), event),
          exceptions:
            event === REPEATING_EVENTS[1]
              ? { create: { occurrenceStart: fridayDeepWork.startAt, endAt: fridayDeepWork.endAt } }
              : undefined,
        },
      }),
    ),
    ...tasks.map(({ task, scope, day, rrule, completions }, i) =>
      prisma.task.create({
        data: {
          userId,
          // Staggered so the list order (createdAt) matches the order above
          createdAt: new Date(now.getTime() - (tasks.length - i) * 1000),
          title: task.title,
          scope,
          priority: "priority" in task ? task.priority : undefined,
          date: toDbDate(day),
          rrule,
          completions: { create: completions },
        },
      }),
    ),
  ]);

  console.log(
    `Seeded ${DEMO_USER_EMAIL}: ${tasks.length} tasks (${repeating.length + 1} repeating) and ` +
      `${events.length + REPEATING_EVENTS.length} events (${REPEATING_EVENTS.length} repeating); tasks from the week of ` +
      `${seriesStart}, events from the week of ${monday}`,
  );
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
