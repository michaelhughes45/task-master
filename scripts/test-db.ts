import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";

// Standalone client: src/lib/prisma.ts imports "server-only", which throws outside Next.js
const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const [{ database }] = await prisma.$queryRaw<
    { database: string }[]
  >`SELECT current_database()::text AS database`;
  const users = await prisma.user.count();

  console.log(`Connected to database: ${database}`);
  console.log(`${users} users`);
}

main()
  .catch((error) => {
    console.error("Database test failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
