import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { generateRandomString, hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import type { EventColor, Priority } from "../src/generated/prisma/enums";
import { addDays, isBefore, todayIn, toDbDate, wallTimeToInstant, weekStartOf } from "../src/lib/dates";
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

interface SeedTask {
  title: string;
  priority?: Priority;
  // Ticked off, if its day has come. Past-day tasks without this count as missed.
  done?: { minutes?: number; note?: string };
}

// The mockup's one-off tasks, by weekday (0 = Monday). Repeating ones arrive with recurrence.
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

const WEEKLY: SeedTask[] = [
  { title: "Grocery run", done: { minutes: 50 } },
  { title: "Clean the bathroom" },
  {
    title: "Finish chapter 3 notes",
    priority: "HIGH",
    done: { minutes: 130, note: "Summarised sections 3.1 to 3.4. Diagrams still to do." },
  },
  { title: "Plan next week's meals" },
  { title: "Long run (10 km)" },
];

interface SeedEvent {
  title: string;
  start: string;
  end: string;
  color?: EventColor;
  location?: string;
}

// The mockup's events, by weekday (0 = Monday). Gym, deep work, Spanish class and the weekly
// review repeat in the mockup; they're one-off rows here until recurrence (spec 15).
const GYM: SeedEvent = { title: "Gym", start: "07:30", end: "08:15", color: "GREEN", location: "Northside Fitness" };
const deepWork = (end: string): SeedEvent => ({ title: "Deep work: project proposal", start: "09:00", end });

const EVENTS: SeedEvent[][] = [
  [GYM, deepWork("12:00"), { title: "Grocery pickup", start: "18:00", end: "18:45" }],
  [
    deepWork("12:00"),
    { title: "Call with insurance", start: "14:00", end: "14:30" },
    { title: "Dinner with friends", start: "19:00", end: "21:00", location: "Osteria on 5th" },
  ],
  [
    GYM,
    deepWork("12:00"),
    { title: "Lunch with Sam", start: "13:00", end: "13:30" },
    { title: "Dentist", start: "16:00", end: "16:45", location: "Dr. Patel, Suite 210" },
    { title: "Spanish class", start: "19:00", end: "20:00", color: "GREEN" },
  ],
  [deepWork("12:00"), { title: "Haircut", start: "17:30", end: "18:15" }],
  [GYM, deepWork("11:00"), { title: "Movie night", start: "20:00", end: "22:00" }],
  [
    { title: "Hike: Ridge Loop", start: "09:00", end: "13:00", color: "GREEN" },
    { title: "Halloween party", start: "19:30", end: "22:30" },
  ],
  [
    { title: "Meal prep", start: "15:00", end: "16:30", color: "GREEN" },
    { title: "Weekly review", start: "18:00", end: "18:30" },
  ],
];

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
function completion(task: SeedTask, day: string, today: string, now: Date, occurrenceDate: Date) {
  if (!task.done || isBefore(today, day)) return undefined;
  const completedAt = day === today ? now : wallTimeToInstant(day, "18:00", DEMO_USER_TIMEZONE);
  return {
    create: {
      occurrenceDate,
      completedAt,
      minutesSpent: task.done.minutes,
      workNote: task.done.note,
    },
  };
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("The demo seed is for development only");
  const now = new Date();
  const today = todayIn(DEMO_USER_TIMEZONE, now);
  const monday = weekStartOf(today);
  const userId = await upsertDemoUser();

  const daily = DAILY.flatMap((tasks, i) => {
    const day = addDays(monday, i);
    return tasks.map((task) => ({ task, day, scope: "DAILY" as const }));
  });
  const weekly = WEEKLY.map((task) => ({ task, day: monday, scope: "WEEKLY" as const }));
  const events = EVENTS.flatMap((dayEvents, i) => {
    const day = addDays(monday, i);
    return dayEvents.map((event) => ({
      userId,
      title: event.title,
      color: event.color,
      location: event.location,
      startAt: wallTimeToInstant(day, event.start, DEMO_USER_TIMEZONE),
      endAt: wallTimeToInstant(day, event.end, DEMO_USER_TIMEZONE),
    }));
  });

  await prisma.$transaction([
    prisma.task.deleteMany({ where: { userId } }),
    prisma.event.deleteMany({ where: { userId } }),
    prisma.event.createMany({ data: events }),
    ...[...daily, ...weekly].map(({ task, day, scope }, i, all) =>
      prisma.task.create({
        data: {
          userId,
          // Staggered so the list order (createdAt) matches the order above
          createdAt: new Date(now.getTime() - (all.length - i) * 1000),
          title: task.title,
          scope,
          priority: task.priority,
          date: toDbDate(day),
          completions: completion(task, scope === "DAILY" ? day : today, today, now, toDbDate(day)),
        },
      }),
    ),
  ]);

  console.log(
    `Seeded ${DEMO_USER_EMAIL}: ${daily.length} daily and ${weekly.length} weekly tasks and ${events.length} events for the week of ${monday}`,
  );
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
