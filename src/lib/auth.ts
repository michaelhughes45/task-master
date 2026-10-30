import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { after } from "next/server";
import { isEmailVerificationEnabled, sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

const verificationRequired = isEmailVerificationEnabled();

export const auth = betterAuth({
  // Email links are built from this, never from the request's Host header
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    requireEmailVerification: verificationRequired,
    sendResetPassword: ({ user, url }) => sendPasswordResetEmail(user.email, url),
    revokeSessionsOnPasswordReset: true,
  },
  emailVerification: {
    sendVerificationEmail: ({ user, url }) => sendVerificationEmail(user.email, url),
    sendOnSignUp: verificationRequired,
    autoSignInAfterVerification: true,
  },
  // In memory, per server instance. Better Auth only enables it in production by default.
  rateLimit: { enabled: true },
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
  // Send emails after the response so its timing doesn't reveal whether an account exists
  advanced: { backgroundTasks: { handler: (promise) => after(promise) } },
  // Must stay last so server actions can set the session cookie
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
