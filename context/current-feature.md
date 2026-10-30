# Current Feature

<!-- Feature name and short description -->

## Status

<!-- Not Started | In Progress | Completed -->

## Goals

<!-- Goals and requirements -->

## Notes

<!-- Any extra notes -->

## History

<!-- Keep this updated.  Earliest to latest -->

- **2026-10-29 — Project Setup (01):** Next.js 16.4 (App Router, TypeScript, `src/`, `@/*`), Tailwind v4 theme tokens from the mockup (light/dark, shadcn names plus primary/success/warning extras), shadcn/ui `base-nova` with `button`, IBM Plex Sans/Mono, `next-themes` toggle, placeholder home page, Vitest (`TZ=Pacific/Auckland`, `cn()` test), `.env.example`, git with GitHub remote.
- **2026-10-29 — Database Setup (02):** Prisma 7.10.1 (latest stable; npm `latest` was an 8.0 RC) with `prisma-client` generator to `src/generated/prisma`, `prisma.config.ts` (dotenv, CLI on `DIRECT_URL`), shared Neon-adapter client in `src/lib/prisma.ts` (`server-only`, `globalThis` reuse), `User` model mapped to `user`, `init` migration applied to Neon `development`, `npm run db:test`, Neon IDs in `CLAUDE.md`, approved install scripts for prisma/esbuild/unrs-resolver.
- **2026-10-29 — Auth Email/Password (03):** Better Auth 1.7.14 + Prisma adapter (email/password 8–128, `timezone`/`reviewNotify` additional fields, `nextCookies()`), CLI-generated `Session`/`Account`/`Verification` + `auth` migration (CLI needs `server-only` removed temporarily from `auth.ts`/`prisma.ts` while it runs), `/api/auth/[...all]`, `auth-client.ts` (`inferAdditionalFields`), `session.ts` (`getSession` cached, `getCurrentUserId`, `requireUser`), `proxy.ts` cookie check with `callbackURL`, `(auth)` sign-in/sign-up pages from the mockup via `useAuthForm` hook, `(app)` layout guard, temporary `/today` with sign out, `safeCallbackUrl` + Zod auth schemas with tests, shadcn `input`/`label`/`sonner`, `--brand-check` logo token. Cache Components requires `export const instant = false` on segments that read the session or `searchParams` outside Suspense. Test user `test-auth03@example.com` / `password123` kept on `development`.
- **2026-10-29 — Auth Google (04):** Better Auth Google provider (`socialProviders.google`, reads `process.env` since `env.ts` does not exist yet), `accountLinking: { enabled: true }` without `trustedProviders` (in 1.7.14 a trusted provider links even unverified emails) and default `requireLocalEmailVerified`, so linking to a password account waits for spec 05 verification. `GoogleButton` (outlined, `/google-g.svg`, `errorCallbackURL` back to `/sign-in` keeping `callbackURL`) and `OrDivider` on sign-in/sign-up, `oauthErrorMessage` for the `?error=` param (cancel, `account_not_linked`, fallback) with tests, `onAPIError.errorURL = "/sign-in"`. Verified: Google sign-in lands on `/today` with `timezone` null. Google user `mhughesy23@gmail.com` now on `development`.
- **2026-10-29 — Auth Email Verification and Password Reset (05):** Resend 6.35 (`src/lib/email.ts`: `onboarding@resend.dev`, text + HTML link emails, `isEmailVerificationEnabled()` on unless exactly `"false"`, client created per send so a missing key only fails sends). Better Auth: explicit `baseURL` from `BETTER_AUTH_URL`, `requireEmailVerification`/`sendOnSignUp` follow the toggle, `autoSignInAfterVerification`, `sendResetPassword` + `revokeSessionsOnPasswordReset`, `rateLimit: { enabled: true }` (in-memory, per instance), `advanced.backgroundTasks` via Next `after()` so email timing doesn't reveal accounts (the resend-verification endpoint still awaits the send). `/forgot-password` (same message always), `/reset-password` (`RequestNewLink` for `?error=INVALID_TOKEN` or an `INVALID_TOKEN` on submit, success → `/sign-in?reset=1`). `signInNotice` (reset/verified/verification-link errors, falls back to `oauthErrorMessage`) with tests; verification links land on `/sign-in?verified=1` (`VERIFY_EMAIL_CALLBACK_URL`), where the `(auth)` layout's streamed redirect sends signed-in users to `/today`. `useAuthForm` gained `callbackURL: null` (stay, `succeeded`), `errorCode` and `submitted`; `ResendVerificationButton` on `EMAIL_NOT_VERIFIED`; sign-up shows "check your email" when verification is on. Forgot/reset Zod schemas with tests. Verified with a production build: reset flow, session revocation, reused/bogus links, verification on (sign-up, blocked sign-in, valid/invalid links). Real Resend delivery untested until `RESEND_API_KEY` is set. Test user `test-verify05@example.com` / `password123` (verified) on `development`.
