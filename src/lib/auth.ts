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
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  account: {
    // No trustedProviders: Google links to an existing user only when it reports the email as
    // verified, and (Better Auth default) only when the local account's email is verified too.
    accountLinking: { enabled: true },
  },
  user: {
    additionalFields: {
      timezone: { type: "string", required: false, input: true },
      reviewNotify: { type: "boolean", required: false, defaultValue: true, input: false },
    },
  },
  // OAuth failures that happen before the client's errorCallbackURL is known land here too
  onAPIError: { errorURL: "/sign-in" },
  // Must stay last so server actions can set the session cookie
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
