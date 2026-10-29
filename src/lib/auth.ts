import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  user: {
    additionalFields: {
      timezone: { type: "string", required: false, input: true },
      reviewNotify: { type: "boolean", required: false, defaultValue: true, input: false },
    },
  },
  // Must stay last so server actions can set the session cookie
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
