import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { generateRandomString, hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import type { Priority } from "../src/generated/prisma/enums";
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

  await prisma.$transaction([
    prisma.task.deleteMany({ where: { userId } }),
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

  console.log(`Seeded ${DEMO_USER_EMAIL}: ${daily.length} daily and ${weekly.length} weekly tasks for the week of ${monday}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
